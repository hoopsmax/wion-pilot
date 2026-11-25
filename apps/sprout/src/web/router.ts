export type Route =
  | { name: 'sign-in' }
  | { name: 'plants' }
  | { name: 'new-plant' }
  | { name: 'edit-plant'; id: string }
  | { name: 'conflict'; id: string }
  | { name: 'not-found' };

/** Turns a URL path into a screen. Keeping this pure makes every route easy to unit-test. */
export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter((part) => part !== '');
  const [first, second, third] = parts;

  if (parts.length === 0) return { name: 'plants' };
  if (parts.length === 1 && first === 'sign-in') return { name: 'sign-in' };
  if (first !== 'plants') return { name: 'not-found' };
  if (parts.length === 1) return { name: 'plants' };
  if (parts.length === 2 && second === 'new') return { name: 'new-plant' };
  if (parts.length === 3 && second !== undefined && third === 'edit') {
    return { name: 'edit-plant', id: decodeURIComponent(second) };
  }
  if (parts.length === 3 && second !== undefined && third === 'conflict') {
    return { name: 'conflict', id: decodeURIComponent(second) };
  }
  return { name: 'not-found' };
}

export function pathFor(route: Route): string {
  switch (route.name) {
    case 'sign-in':
      return '/sign-in';
    case 'plants':
      return '/plants';
    case 'new-plant':
      return '/plants/new';
    case 'edit-plant':
      return `/plants/${encodeURIComponent(route.id)}/edit`;
    case 'conflict':
      return `/plants/${encodeURIComponent(route.id)}/conflict`;
    case 'not-found':
      return '/plants';
  }
}
