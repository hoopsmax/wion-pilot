import type { Session } from './api.ts';

const KEY = 'sprout.session';

export function loadSession(): Session | undefined {
  const stored = window.localStorage.getItem(KEY);
  return stored === null ? undefined : (JSON.parse(stored) as Session);
}

export function saveSession(session: Session): void {
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(KEY);
}
