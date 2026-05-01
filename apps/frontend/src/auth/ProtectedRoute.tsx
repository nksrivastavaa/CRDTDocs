import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { ready, token } = useAuth();

  if (!ready) {
    return <div className="boot-screen">Loading workspace</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
