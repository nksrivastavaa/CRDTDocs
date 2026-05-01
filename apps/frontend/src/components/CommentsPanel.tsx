import { FormEvent, useMemo, useState } from 'react';
import { Check, MessageSquare, Send } from 'lucide-react';
import type { CommentItem } from '@collab/types';

export interface ActiveSelection {
  from: number;
  to: number;
  text: string;
}

export function CommentsPanel({
  comments,
  canEdit,
  selection,
  onAdd,
  onReply,
  onResolve,
}: {
  comments: CommentItem[];
  canEdit: boolean;
  selection: ActiveSelection;
  onAdd: (body: string) => Promise<void>;
  onReply: (commentId: string, body: string) => Promise<void>;
  onResolve: (commentId: string) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const roots = useMemo(() => comments.filter((comment) => !comment.parentId), [comments]);
  const replies = useMemo(() => {
    const grouped = new Map<string, CommentItem[]>();
    comments
      .filter((comment) => comment.parentId)
      .forEach((comment) => {
        grouped.set(comment.parentId!, [...(grouped.get(comment.parentId!) ?? []), comment]);
      });
    return grouped;
  }, [comments]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!body.trim()) {
      return;
    }

    await onAdd(body.trim());
    setBody('');
  }

  async function submitReply(commentId: string) {
    const reply = replyDrafts[commentId]?.trim();

    if (!reply) {
      return;
    }

    await onReply(commentId, reply);
    setReplyDrafts((drafts) => ({ ...drafts, [commentId]: '' }));
  }

  return (
    <aside className="comments-panel">
      <div className="panel-heading">
        <h2>Comments</h2>
      </div>
      {canEdit ? (
        <form className="comment-form" onSubmit={submit}>
          <div className="selection-chip">
            <MessageSquare size={14} />
            {selection.text ? selection.text.slice(0, 72) : 'Cursor position'}
          </div>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add a comment" />
          <button className="primary-button" type="submit">
            <Send size={15} />
            Comment
          </button>
        </form>
      ) : null}
      <div className="comment-list">
        {roots.length === 0 ? <p className="muted">No comments yet.</p> : null}
        {roots.map((comment) => (
          <article className={comment.resolvedAt ? 'comment resolved' : 'comment'} key={comment.id}>
            <header>
              <strong>{comment.user.displayName}</strong>
              <small>{new Date(comment.createdAt).toLocaleString()}</small>
            </header>
            {comment.selectedText ? <blockquote>{comment.selectedText}</blockquote> : null}
            <p>{comment.body}</p>
            <div className="comment-actions">
              {canEdit && !comment.resolvedAt ? (
                <button className="ghost-button" type="button" onClick={() => onResolve(comment.id)}>
                  <Check size={14} />
                  Resolve
                </button>
              ) : null}
            </div>
            {(replies.get(comment.id) ?? []).map((reply) => (
              <div className="reply" key={reply.id}>
                <strong>{reply.user.displayName}</strong>
                <p>{reply.body}</p>
              </div>
            ))}
            {canEdit ? (
              <div className="reply-form">
                <input
                  value={replyDrafts[comment.id] ?? ''}
                  onChange={(event) => setReplyDrafts((drafts) => ({ ...drafts, [comment.id]: event.target.value }))}
                  placeholder="Reply"
                />
                <button className="icon-button" type="button" aria-label="Reply" onClick={() => submitReply(comment.id)}>
                  <Send size={15} />
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </aside>
  );
}
