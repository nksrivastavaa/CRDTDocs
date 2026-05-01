import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { token, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('owner@example.com');
  const [displayName, setDisplayName] = useState('Olivia Owner');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, displayName, password);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to continue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <FileText size={28} />
          <div>
            <h1>Collab</h1>
            <p>Shared documents for focused teams.</p>
          </div>
        </div>
        <div className="segmented">
          <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => setMode('login')}>
            Login
          </button>
          <button className={mode === 'register' ? 'active' : ''} type="button" onClick={() => setMode('register')}>
            Register
          </button>
        </div>
        <form className="stack-form" onSubmit={submit}>
          {mode === 'register' ? (
            <label>
              Name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} required />
            </label>
          ) : null}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Working...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>
      </section>
    </main>
  );
}
