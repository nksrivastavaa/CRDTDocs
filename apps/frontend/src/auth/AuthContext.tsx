import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { UserSummary } from '@collab/types';
import { api } from '../api/client';

interface AuthState {
  token: string | null;
  user: UserSummary | null;
}

interface AuthContextValue extends AuthState {
  ready: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, displayName: string, password: string): Promise<void>;
  logout(): void;
}

const STORAGE_KEY = 'collab-system-auth';
const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredAuth(): AuthState {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return { token: null, user: null };
  }

  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => readStoredAuth());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!state.token) {
      setReady(true);
      return;
    }

    let cancelled = false;

    api
      .me(state.token)
      .then((user) => {
        if (!cancelled) {
          const next = { token: state.token, user };
          setState(next);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(STORAGE_KEY);
          setState({ token: null, user: null });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      ready,
      async login(email: string, password: string) {
        const response = await api.login(email, password);
        const next = { token: response.accessToken, user: response.user };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setState(next);
      },
      async register(email: string, displayName: string, password: string) {
        const response = await api.register(email, displayName, password);
        const next = { token: response.accessToken, user: response.user };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setState(next);
      },
      logout() {
        localStorage.removeItem(STORAGE_KEY);
        setState({ token: null, user: null });
      },
    }),
    [ready, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
