import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { FileText, Search, Users, X } from 'lucide-react';
import type { DocumentSummary, WorkspaceSummary } from '@collab/types';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface SearchDocumentResult extends DocumentSummary {
  workspaceName: string;
}

export function SearchDialog({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [documents, setDocuments] = useState<SearchDocumentResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !token) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    api
      .listWorkspaces(token)
      .then(async (workspaceItems) => {
        const documentGroups = await Promise.all(
          workspaceItems.map(async (workspace) => {
            const docs = await api.listDocuments(token, workspace.id).catch(() => []);
            return docs.map((document) => ({
              ...document,
              workspaceName: workspace.name,
            }));
          }),
        );

        if (!cancelled) {
          setWorkspaces(workspaceItems);
          setDocuments(documentGroups.flat());
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, token]);

  useEffect(() => {
    if (open) {
      setQuery('');
    }
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredWorkspaces = useMemo(
    () =>
      workspaces.filter((workspace) => {
        if (!normalizedQuery) {
          return true;
        }

        return workspace.name.toLowerCase().includes(normalizedQuery);
      }),
    [normalizedQuery, workspaces],
  );
  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) => {
        if (!normalizedQuery) {
          return true;
        }

        return (
          document.title.toLowerCase().includes(normalizedQuery) ||
          document.workspaceName.toLowerCase().includes(normalizedQuery)
        );
      }),
    [documents, normalizedQuery],
  );

  if (!open) {
    return null;
  }

  function go(path: string) {
    onNavigate(path);
    onClose();
  }

  function updateQuery(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search">
        <div className="search-input-wrap">
          <Search size={18} />
          <input autoFocus value={query} onChange={updateQuery} placeholder="Search workspaces and documents" />
          <button className="icon-button" type="button" aria-label="Close search" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="search-results">
          {loading ? <p className="muted">Loading results...</p> : null}
          {!loading && filteredWorkspaces.length === 0 && filteredDocuments.length === 0 ? (
            <p className="muted">No matching workspaces or documents.</p>
          ) : null}
          {filteredDocuments.length > 0 ? (
            <div className="search-group">
              <h3>Documents</h3>
              {filteredDocuments.slice(0, 12).map((document) => (
                <button className="search-result" key={document.id} type="button" onClick={() => go(`/documents/${document.id}`)}>
                  <FileText size={17} />
                  <span>
                    <strong>{document.title}</strong>
                    <small>{document.workspaceName}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {filteredWorkspaces.length > 0 ? (
            <div className="search-group">
              <h3>Workspaces</h3>
              {filteredWorkspaces.slice(0, 8).map((workspace) => (
                <button
                  className="search-result"
                  key={workspace.id}
                  type="button"
                  onClick={() => go(`/workspaces/${workspace.id}`)}
                >
                  <Users size={17} />
                  <span>
                    <strong>{workspace.name}</strong>
                    <small>{workspace.accessType === 'shared' ? 'shared with me' : workspace.role}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
