/** Links whose text or address says they delete, remove, sign out or pay are never followed. */
const DESTRUCTIVE =
  /\b(delete|remove|sign[\s-]?out|log[\s-]?out|logout|signout|pay|payment|checkout|purchase)\b/i;

/** A path segment that is an id (UUID, number or long hex) rather than a fixed part of a route. */
const ID_SEGMENT =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[0-9a-f]{16,})$/i;

/**
 * An absolute http(s) URL without its #fragment, or undefined for links that do not lead to a page
 * (mailto:, javascript:, an empty href, …).
 */
export function normalizeUrl(href: string, base: string): string | undefined {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  url.hash = '';
  return url.toString();
}

/** The start URL's own origin is always allowed; others only when listed (host or full origin). */
export function isAllowed(url: string, startUrl: string, allowedDomains: string[] = []): boolean {
  const target = new URL(url);
  if (target.origin === new URL(startUrl).origin) return true;
  return allowedDomains.some((domain) => domain === target.host || domain === target.origin);
}

export function isDestructive(linkText: string, url: string): boolean {
  return (
    DESTRUCTIVE.test(linkText) || DESTRUCTIVE.test(new URL(url).pathname.replace(/[/_]/g, ' '))
  );
}

/**
 * The route a URL belongs to: ids become ":id", so /plants/1f2e…/edit and /plants/9a8b…/edit are
 * the same screen and are mapped once. The query is ignored.
 */
export function routePattern(url: string): string {
  const { pathname } = new URL(url);
  const pattern = pathname
    .split('/')
    .map((segment) => (ID_SEGMENT.test(segment) ? ':id' : segment))
    .join('/');
  return pattern.length > 1 ? pattern.replace(/\/$/, '') : pattern;
}
