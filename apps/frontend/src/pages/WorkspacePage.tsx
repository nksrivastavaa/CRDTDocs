import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Copy, FileText, Plus } from 'lucide-react';
import type { DocumentSummary, WorkspaceSummary } from '@collab/types';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AppShell } from '../components/AppShell';

export function WorkspacePage() {
  const { workspaceId } = useParams();
  const { token } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [title, setTitle] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const canCreateDocuments = workspace?.accessType !== 'shared';
  const canManageInvite = workspace?.role === 'owner' || workspace?.role === 'admin';

  useEffect(() => {
    if (!token || !workspaceId) {
      return;
    }

    void Promise.all([api.getWorkspace(token, workspaceId), api.listDocuments(token, workspaceId)]).then(([workspaceData, docs]) => {
      setWorkspace(workspaceData);
      setDocuments(docs);
      setInviteCode(workspaceData.inviteCode ?? null);
    });
  }, [token, workspaceId]);

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !workspaceId || !title.trim()) {
      return;
    }

    const document = await api.createDocument(token, workspaceId, title.trim());
    setDocuments((items) => [document, ...items]);
    setTitle('');
  }

  async function refreshInvite() {
    if (!token || !workspaceId) {
      return;
    }

    const response = await api.createInvite(token, workspaceId);
    setInviteCode(response.inviteCode);
  }

  return (
    <AppShell title={workspace?.name ?? 'Workspace'}>
      <section className="workspace-layout">
        <div className="panel">
          <div className="panel-heading">
            <h2>Documents</h2>
          </div>
          <div className="document-list">
            {documents.map((document) => (
              <Link className="document-row" to={`/documents/${document.id}`} key={document.id}>
                <FileText size={18} />
                <div>
                  <strong>{document.title}</strong>
                  <span>Updated {new Date(document.updatedAt).toLocaleString()}</span>
                </div>
                <small>{document.role}</small>
              </Link>
            ))}
            {documents.length === 0 ? <p className="muted">No documents in this workspace.</p> : null}
          </div>
        </div>
        <aside className="workspace-side">
          {canCreateDocuments ? (
            <form className="panel stack-form" onSubmit={createDocument}>
              <div className="panel-heading">
                <h2>New document</h2>
              </div>
              <label>
                Title
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled" />
              </label>
              <button className="primary-button" type="submit">
                <Plus size={16} />
                Create
              </button>
            </form>
          ) : null}
          {canManageInvite ? (
            <div className="panel stack-form">
              <div className="panel-heading">
                <h2>Invite</h2>
              </div>
              <div className="invite-code">{inviteCode ?? 'No invite available'}</div>
              <button className="secondary-button" type="button" onClick={refreshInvite}>
                <Copy size={16} />
                Rotate invite
              </button>
            </div>
          ) : null}
        </aside>
      </section>
    </AppShell>
  );
}
