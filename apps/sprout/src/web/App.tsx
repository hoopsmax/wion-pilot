import { useCallback, useEffect, useState } from 'react';
import { api, type Session } from './api.ts';
import { navigate, useRoute } from './navigation.ts';
import { PlantList } from './screens/PlantList.tsx';
import { SignIn } from './screens/SignIn.tsx';
import { clearSession, loadSession, saveSession } from './session-storage.ts';

export function App() {
  const route = useRoute();
  const [session, setSession] = useState(loadSession);

  const signedOut = session === undefined;
  useEffect(() => {
    if (signedOut && route.name !== 'sign-in') navigate('/sign-in', { replace: true });
    if (!signedOut && route.name === 'sign-in') navigate('/plants', { replace: true });
    if (!signedOut && route.name === 'not-found') navigate('/plants', { replace: true });
  }, [signedOut, route.name]);

  const signIn = (next: Session) => {
    saveSession(next);
    setSession(next);
  };

  // Used when the server no longer knows the token, for example after a restart.
  const forgetSession = useCallback(() => {
    clearSession();
    setSession(undefined);
  }, []);

  if (signedOut) return <SignIn onSignedIn={signIn} />;

  const signOut = () => {
    void api.signOut(session.token).finally(forgetSession);
  };

  return <PlantList session={session} onSignOut={signOut} onUnauthorized={forgetSession} />;
}
