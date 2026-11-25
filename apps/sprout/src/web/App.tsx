import { useEffect, useState } from 'react';
import type { Session } from './api.ts';
import { navigate, useRoute } from './navigation.ts';
import { SignIn } from './screens/SignIn.tsx';
import { clearSession, loadSession, saveSession } from './session-storage.ts';

export function App() {
  const route = useRoute();
  const [session, setSession] = useState(loadSession);

  const signedOut = session === undefined;
  useEffect(() => {
    if (signedOut && route.name !== 'sign-in') navigate('/sign-in', { replace: true });
    if (!signedOut && route.name === 'sign-in') navigate('/plants', { replace: true });
  }, [signedOut, route.name]);

  const signIn = (next: Session) => {
    saveSession(next);
    setSession(next);
  };

  const signOut = () => {
    clearSession();
    setSession(undefined);
  };

  if (signedOut) return <SignIn onSignedIn={signIn} />;

  return (
    <main className="page">
      <div className="topbar">
        <h1>Plants</h1>
        <button type="button" className="secondary" onClick={signOut}>
          Sign out
        </button>
      </div>
      <p className="muted">Signed in as {session.user.name}.</p>
    </main>
  );
}
