import { useCallback, useEffect, useState } from 'react';
import { api, type Session } from './api.ts';
import { navigate, useRoute } from './navigation.ts';
import { SproutDataProvider } from './offline/SproutDataProvider.tsx';
import { SyncBanner } from './offline/SyncBanner.tsx';
import type { Route } from './router.ts';
import { PlantForm } from './screens/PlantForm.tsx';
import { PlantList } from './screens/PlantList.tsx';
import { SignIn } from './screens/SignIn.tsx';
import { clearSession, loadSession, saveSession } from './session-storage.ts';

function Screen({
  route,
  session,
  onSignOut,
}: {
  route: Route;
  session: Session;
  onSignOut: () => void;
}) {
  if (route.name === 'new-plant') return <PlantForm key="new" />;
  if (route.name === 'edit-plant') {
    // A new key gives each plant a fresh form instead of reusing the last one's state.
    return <PlantForm key={route.id} plantId={route.id} />;
  }
  return <PlantList session={session} onSignOut={onSignOut} />;
}

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

  // Used when the server no longer knows the token, for example after a restart. Waiting
  // changes stay in this browser and are sent after the next sign-in.
  const forgetSession = useCallback(() => {
    clearSession();
    setSession(undefined);
  }, []);

  if (signedOut) return <SignIn onSignedIn={signIn} />;

  const signOut = () => {
    void api.signOut(session.token).finally(forgetSession);
  };

  return (
    <SproutDataProvider session={session} onUnauthorized={forgetSession}>
      <SyncBanner />
      <Screen route={route} session={session} onSignOut={signOut} />
    </SproutDataProvider>
  );
}
