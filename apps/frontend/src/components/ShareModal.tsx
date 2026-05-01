import { FormEvent, useEffect, useState } from 'react';
import { Share2, X } from 'lucide-react';
import type { DocumentPermission, DocumentRole } from '@collab/types';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function ShareModal({
  open,
  documentId,
  onClose,
}: {
  open: boolean;
  documentId: string;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [target, setTarget] = useState('');
  const [role, setRole] = useState<DocumentRole>('viewer');
  const [permissions, setPermissions] = useState<DocumentPermission[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) {
      return;
    }

    void api.listPermissions(token, documentId).then(setPermissions).catch(() => setPermissions([]));
  }, [documentId, open, token]);

  if (!open) {
    return null;
  }

  async function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token || !target.trim()) {
      return;
    }

    try {
      const payload = target.includes('@') ? { email: target.trim(), role } : { userId: target.trim(), role };
      const permission = await api.shareDocument(token, documentId, payload);
      setPermissions((items) => [permission, ...items.filter((item) => item.user.id !== permission.user.id)]);
      setTarget('');
    } catch {
      setError('Unable to share with that user.');
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>Share document</h2>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form className="share-form" onSubmit={share}>
          <input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Email or user ID" />
          <select value={role} onChange={(event) => setRole(event.target.value as DocumentRole)}>
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </select>
          <button className="primary-button" type="submit">
            <Share2 size={16} />
            Share
          </button>
        </form>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="permission-list">
          {permissions.map((permission) => (
            <div className="permission-row" key={permission.user.id}>
              <div>
                <strong>{permission.user.displayName}</strong>
                <span>{permission.user.email}</span>
              </div>
              <small>{permission.role}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
