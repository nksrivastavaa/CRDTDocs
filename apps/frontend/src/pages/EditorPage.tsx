import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Link from '@tiptap/extension-link';
import { ArrowLeft, Eye, MessageSquare, Pencil, Share2, Trash2 } from 'lucide-react';
import type { CommentItem, DocumentDetail, FileAttachment } from '@collab/types';
import { api } from '../api/client';
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
  const [title, setTitle] = useState('');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [selection, setSelection] = useState<ActiveSelection>({ from: 0, to: 0, text: '' });
  const initializedDocuments = useRef(new Set<string>());
  const saveTimer = useRef<number | null>(null);

  const collaboration = useCollaboration(documentId, token, user);
  const effectiveRole = collaboration.role ?? document?.role ?? null;
  const canEdit = collaboration.synced && (effectiveRole === 'owner' || effectiveRole === 'editor');
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

    void Promise.all([api.getDocument(token, documentId), api.listComments(token, documentId), api.listFiles(token, documentId)]).then(
      ([doc, commentItems, fileItems]) => {
        setDocument(doc);
        setTitle(doc.title);
        setComments(commentItems);
        setFiles(fileItems);
      },
    );
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
    if (!canEdit) {
      return 'View only';
    }

    return collaboration.status === 'connected' ? 'Live' : 'Offline';
  }, [canEdit, collaboration.status]);

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
    setComments((items) => [...items, comment]);
  }

  async function replyComment(commentId: string, body: string) {
    if (!token) {
      return;
    }

    const reply = await api.replyComment(token, commentId, body);
    setComments((items) => [...items, reply]);
  }

  async function resolveComment(commentId: string) {
    if (!token) {
      return;
    }

    const resolved = await api.resolveComment(token, commentId);
    setComments((items) => items.map((item) => (item.id === resolved.id ? resolved : item)));
  }

  if (!documentId || !document) {
    return (
      <AppShell title="Document">
        <div className="boot-screen">Loading document</div>
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
