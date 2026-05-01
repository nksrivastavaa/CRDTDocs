import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Users } from 'lucide-react';
import type { WorkspaceSummary } from '@collab/types';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AppShell } from '../components/AppShell';

export function DashboardPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    void api.listWorkspaces(token).then(setWorkspaces);
  }, [token]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !name.trim()) {
      return;
    }

    const workspace = await api.createWorkspace(token, name.trim());
    setWorkspaces((items) => [workspace, ...items]);
    setName('');
    navigate(`/workspaces/${workspace.id}`);
  }

  async function joinWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token || !inviteCode.trim()) {
      return;
    }

    try {
      const workspace = await api.joinWorkspace(token, inviteCode.trim());
      setWorkspaces((items) => [workspace, ...items.filter((item) => item.id !== workspace.id)]);
      setInviteCode('');
      navigate(`/workspaces/${workspace.id}`);
    } catch {
      setError('Invite code not found.');
    }
  }

  return (
    <AppShell title="Workspaces">
      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Your workspaces</h2>
          </div>
          <div className="workspace-list">
            {workspaces.map((workspace) => (
              <Link className="workspace-row" key={workspace.id} to={`/workspaces/${workspace.id}`}>
                <div>
                  <strong>{workspace.name}</strong>
                  <span>{workspace.role}</span>
                </div>
                <ArrowRight size={17} />
              </Link>
            ))}
            {workspaces.length === 0 ? <p className="muted">Create or join a workspace to get started.</p> : null}
          </div>
        </div>
        <div className="side-stack">
          <form className="panel stack-form" onSubmit={createWorkspace}>
            <div className="panel-heading">
              <h2>Create workspace</h2>
            </div>
            <label>
              Workspace name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Product team" />
            </label>
            <button className="primary-button" type="submit">
              <Plus size={16} />
              Create
            </button>
          </form>
          <form className="panel stack-form" onSubmit={joinWorkspace}>
            <div className="panel-heading">
              <h2>Join workspace</h2>
            </div>
            <label>
              Invite code
              <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="acme-product-team" />
            </label>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="secondary-button" type="submit">
              <Users size={16} />
              Join
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
