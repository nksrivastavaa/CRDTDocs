import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Link from '@tiptap/extension-link';
import { ArrowLeft, Eye, MessageSquare, Pencil, Share2, Trash2 } from 'lucide-react';
import type { CommentItem, CommentRealtimeEvent, DocumentDetail, FileAttachment } from '@collab/types';
import { ApiError, api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCollaboration } from '../collaboration/useCollaboration';
import { AppShell } from '../components/AppShell';
import { Collaborators } from '../components/Collaborators';
import { CommentsPanel, type ActiveSelection } from '../components/CommentsPanel';
import { FileAttachments } from '../components/FileAttachments';
import { ShareModal } from '../components/ShareModal';

export function EditorPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [selection, setSelection] = useState<ActiveSelection>({ from: 0, to: 0, text: '' });
  const initializedDocuments = useRef(new Set<string>());
  const saveTimer = useRef<number | null>(null);

  const upsertComment = useCallback((comment: CommentItem) => {
    setComments((items) => {
      const index = items.findIndex((item) => item.id === comment.id);

      if (index === -1) {
        return [...items, comment];
      }

      return items.map((item) => (item.id === comment.id ? comment : item));
    });
  }, []);
  const handleCommentUpsert = useCallback((event: CommentRealtimeEvent) => upsertComment(event.comment), [upsertComment]);
  const collaboration = useCollaboration(document ? documentId : undefined, token, user, { onCommentUpsert: handleCommentUpsert });
  const effectiveRole = collaboration.role ?? document?.role ?? null;
  const hasEditAccess = effectiveRole === 'owner' || effectiveRole === 'editor';
  const canEdit = collaboration.synced && hasEditAccess && editMode;
  const canShare = effectiveRole === 'owner';

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Placeholder.configure({ placeholder: 'Start writing...' }),
        Link.configure({ openOnClick: true, autolink: true }),
        Collaboration.configure({ document: collaboration.ydoc }),
        CollaborationCursor.configure({
          provider: collaboration.provider as any,
          user: user
            ? {
                name: user.displayName,
                color: collaboration.collaborators.find((item) => item.userId === user.id)?.color ?? '#1f7a5c',
              }
            : { name: 'Guest', color: '#1f7a5c' },
        }),
      ],
      editable: canEdit,
      editorProps: {
        attributes: {
          class: 'editor-surface',
        },
      },
    },
    [collaboration.ydoc],
  );

  useEffect(() => {
    if (!token || !documentId) {
      return;
    }

    let cancelled = false;
    setDocument(null);
    setTitle('');
    setComments([]);
    setFiles([]);
    setLoadError(null);
    setLoadingDocument(true);

    void Promise.all([api.getDocument(token, documentId), api.listComments(token, documentId), api.listFiles(token, documentId)])
      .then(([doc, commentItems, fileItems]) => {
        if (cancelled) {
          return;
        }

        setDocument(doc);
        setTitle(doc.title);
        setComments(commentItems);
        setFiles(fileItems);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && error.statusCode === 403) {
          setLoadError('You do not have access to this document. Ask the owner to share it with you.');
          return;
        }

        if (error instanceof ApiError && error.statusCode === 404) {
          setLoadError('This document could not be found. It may have been deleted or the link may be wrong.');
          return;
        }

        setLoadError('Unable to load this document right now.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDocument(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, token]);

  useEffect(() => {
    editor?.setEditable(Boolean(canEdit));
  }, [canEdit, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const updateSelection = () => {
      const current = editor.state.selection;
      setSelection({
        from: current.from,
        to: current.to,
        text: editor.state.doc.textBetween(current.from, current.to, ' '),
      });
    };

    editor.on('selectionUpdate', updateSelection);
    updateSelection();

    return () => {
      editor.off('selectionUpdate', updateSelection);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || !document || !collaboration.synced || initializedDocuments.current.has(document.id)) {
      return;
    }

    const fragment = collaboration.ydoc.getXmlFragment('default');

    if (fragment.length === 0) {
      editor.commands.setContent(document.content);
    }

    initializedDocuments.current.add(document.id);
  }, [collaboration.synced, collaboration.ydoc, document, editor]);

  useEffect(() => {
    if (!editor || !document || !token || !canEdit) {
      return;
    }

    const scheduleSave = () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }

      saveTimer.current = window.setTimeout(() => {
        void api.updateDocument(token, document.id, { content: editor.getJSON() });
      }, 1200);
    };

    editor.on('update', scheduleSave);

    return () => {
      editor.off('update', scheduleSave);
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [canEdit, document, editor, token]);

  const statusLabel = useMemo(() => {
    if (!hasEditAccess) {
      return 'View only';
    }

    if (!collaboration.synced) {
      return collaboration.status === 'offline' ? 'Offline' : 'Connecting';
    }

    return editMode ? 'Editing live' : 'Viewing';
  }, [collaboration.status, collaboration.synced, editMode, hasEditAccess]);

  async function saveTitle() {
    if (!token || !document || !canEdit || title.trim() === document.title) {
      return;
    }

    const updated = await api.updateDocument(token, document.id, { title: title.trim() || 'Untitled' });
    setDocument(updated);
    setTitle(updated.title);
  }

  async function deleteDocument() {
    if (!token || !document || !canShare) {
      return;
    }

    await api.deleteDocument(token, document.id);
    navigate(`/workspaces/${document.workspaceId}`);
  }

  async function addComment(body: string) {
    if (!token || !documentId) {
      return;
    }

    const comment = await api.createComment(token, documentId, {
      body,
      rangeFrom: selection.from,
      rangeTo: selection.to,
      selectedText: selection.text,
    });
    upsertComment(comment);
  }

  async function replyComment(commentId: string, body: string) {
    if (!token) {
      return;
    }

    const reply = await api.replyComment(token, commentId, body);
    upsertComment(reply);
  }

  async function resolveComment(commentId: string) {
    if (!token) {
      return;
    }

    const resolved = await api.resolveComment(token, commentId);
    upsertComment(resolved);
  }

  if (!documentId || loadingDocument || loadError || !document) {
    return (
      <AppShell title="Document">
        {loadError ? (
          <section className="access-state">
            <h2>Document unavailable</h2>
            <p>{loadError}</p>
            <button className="secondary-button" type="button" onClick={() => navigate('/')}>
              <ArrowLeft size={16} />
              Back to workspaces
            </button>
          </section>
        ) : (
          <div className="boot-screen">Loading document</div>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Document"
      action={
        <>
          <Collaborators collaborators={collaboration.collaborators} />
          <span className={canEdit ? 'status-pill live' : 'status-pill'}>{statusLabel}</span>
          {hasEditAccess ? (
            <button
              className="secondary-button"
              type="button"
              disabled={!collaboration.synced}
              onClick={() => setEditMode((value) => !value)}
            >
              {editMode ? <Eye size={16} /> : <Pencil size={16} />}
              {editMode ? 'View' : 'Edit'}
            </button>
          ) : null}
          {canShare ? (
            <button className="secondary-button" type="button" onClick={() => setShareOpen(true)}>
              <Share2 size={16} />
              Share
            </button>
          ) : null}
        </>
      }
    >
      <section className="editor-page">
        <div className="editor-main">
          <div className="document-toolbar">
            <button className="ghost-button" type="button" onClick={() => navigate(`/workspaces/${document.workspaceId}`)}>
              <ArrowLeft size={16} />
              Back
            </button>
            <div className="toolbar-spacer" />
            {canEdit ? <Pencil size={16} /> : <Eye size={16} />}
            {canShare ? (
              <button className="icon-button danger" type="button" aria-label="Delete document" onClick={deleteDocument}>
                <Trash2 size={17} />
              </button>
            ) : null}
          </div>
          <input
            className="title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveTitle}
            readOnly={!canEdit}
          />
          <EditorContent editor={editor} />
        </div>
        <div className="editor-side">
          <CommentsPanel
            comments={comments}
            canEdit={Boolean(canEdit)}
            selection={selection}
            onAdd={addComment}
            onReply={replyComment}
            onResolve={resolveComment}
          />
          <FileAttachments
            documentId={documentId}
            files={files}
            canEdit={Boolean(canEdit)}
            editor={editor}
            onUploaded={(file) => setFiles((items) => [file, ...items])}
          />
          <div className="keyboard-hint">
            <MessageSquare size={14} />
            {comments.filter((comment) => !comment.resolvedAt).length} open comments
          </div>
        </div>
      </section>
      <ShareModal open={shareOpen} documentId={documentId} onClose={() => setShareOpen(false)} />
    </AppShell>
  );
}
