import { FileText, LogOut, Plus, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ReactNode, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { NotificationBell } from './NotificationBell';
import { SearchDialog } from './SearchDialog';

export function AppShell({
  children,
  title,
  action,
}: {
  children: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <FileText size={20} />
          <span>Collab</span>
        </Link>
        <button className="sidebar-search" type="button" onClick={() => setSearchOpen(true)}>
          <Search size={16} />
          <span>Search</span>
        </button>
        <button className="sidebar-button" type="button" onClick={() => navigate('/')}>
          <Plus size={16} />
          <span>Workspace</span>
        </button>
        <div className="sidebar-user">
          <div className="avatar">{user?.displayName?.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user?.displayName}</strong>
            <small>{user?.email}</small>
          </div>
        </div>
        <button className="sidebar-button" type="button" onClick={logout}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="topbar-actions">
            <NotificationBell />
            {action}
          </div>
        </header>
        {children}
      </main>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={navigate} />
    </div>
  );
}
