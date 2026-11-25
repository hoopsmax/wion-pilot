import type { Screen, SkippedLink } from './app-map.ts';
import { isAllowed, isDestructive, normalizeUrl } from './urls.ts';

/** A link as found on a page: its text and its address. */
export interface PageLink {
  text: string;
  href: string;
}

export interface LinkTriage {
  follow: string[];
  skipped: SkippedLink[];
}

/**
 * Splits a page's links into those the crawler may open and those it must not, with the reason.
 * Links that do not lead to a page (mailto:, javascript:) are dropped without a note.
 */
export function triageLinks(
  links: PageLink[],
  startUrl: string,
  allowedDomains: string[] = [],
): LinkTriage {
  const follow = new Set<string>();
  const skipped = new Map<string, string>();
  for (const link of links) {
    const url = normalizeUrl(link.href, startUrl);
    if (url === undefined) continue;
    if (!isAllowed(url, startUrl, allowedDomains)) {
      skipped.set(url, 'outside the allowed domains (add one with --allow-domain)');
    } else if (isDestructive(link.text, url)) {
      skipped.set(url, 'looks destructive (delete, sign out, pay…), so it is never opened');
    } else {
      follow.add(url);
    }
  }
  return {
    follow: [...follow],
    skipped: [...skipped].map(([url, reason]) => ({ url, reason })),
  };
}

/** A file name for a screen's screenshot: "/plants/:id/edit" → "screens/plants-id-edit.png". */
export function screenshotPath(pattern: string, taken: ReadonlySet<string> = new Set()): string {
  const slug =
    pattern
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'home';
  let path = `screens/${slug}.png`;
  // Two patterns can make the same slug ("/a-b" and "/a/b"); neither screenshot may be lost.
  for (let n = 2; taken.has(path); n += 1) path = `screens/${slug}-${String(n)}.png`;
  return path;
}

type ScreenContent = Pick<Screen, 'title' | 'headings' | 'forms' | 'elements' | 'testIds'>;

/** Two routes show the same screen when everything the map keeps about them is equal. */
export function sameScreen(a: ScreenContent, b: ScreenContent): boolean {
  const content = ({ title, headings, forms, elements, testIds }: ScreenContent): string =>
    JSON.stringify({ title, headings, forms, elements, testIds });
  return content(a) === content(b);
}
