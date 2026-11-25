import { useState, type SubmitEvent } from 'react';
import { api, ApiError, type Session } from '../api.ts';

export function SignIn({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      onSignedIn(await api.signIn(email, password));
    } catch (problem) {
      if (!(problem instanceof ApiError)) throw problem;
      setError(problem.message);
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <h1>Sign in to Sprout</h1>
      <form className="card" onSubmit={(event) => void submit(event)} noValidate>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />
        </div>
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted">
          Demo users: ava@sprout.test / sprout-ava, ben@sprout.test / sprout-ben
        </p>
      </form>
    </main>
  );
}
