import type { Page } from '@playwright/test';
import type { Screen } from './app-map.ts';
import type { PageLink } from './crawl-rules.ts';
import { readForms } from './forms.ts';
import type { DomAnchor, PageGlobals } from './in-page.ts';
import { headings, interactiveElements, testIdLocators, type AriaNode } from './locators.ts';

/** Runs in the browser (see in-page.ts): the page's links and its data-testid values. */
function linksAndTestIdsInPage(): { links: PageLink[]; testIds: string[] } {
  const { document } = globalThis as unknown as PageGlobals;
  const anchors = Array.from(document.querySelectorAll('a[href]')) as DomAnchor[];
  return {
    links: anchors.map((anchor) => ({
      text: (anchor.getAttribute('aria-label') ?? anchor.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
      href: anchor.href,
    })),
    testIds: Array.from(
      document.querySelectorAll('[data-testid]'),
      (element) => element.getAttribute('data-testid') ?? '',
    ),
  };
}

async function accessibilityTree(page: Page): Promise<AriaNode[]> {
  // Playwright types the snapshot loosely (any); it is checked before use.
  const snapshot: unknown = await page.ariaSnapshotJSON();
  if (!Array.isArray(snapshot)) {
    throw new Error(`The accessibility snapshot of ${page.url()} is not a list of nodes.`);
  }
  return snapshot as AriaNode[];
}

/**
 * Everything the map keeps about the page that is open now, plus its links for the crawler.
 * It only reads: no click, no typing, no submit.
 */
export async function readScreen(
  page: Page,
  pattern: string,
): Promise<{ screen: Omit<Screen, 'screenshot'>; links: PageLink[] }> {
  const tree = await accessibilityTree(page);
  const { links, testIds } = await page.evaluate(linksAndTestIdsInPage);
  return {
    screen: {
      pattern,
      url: page.url(),
      title: await page.title(),
      headings: headings(tree),
      forms: await readForms(page),
      elements: interactiveElements(tree),
      testIds: testIdLocators(testIds.filter((id) => id !== '')),
    },
    links,
  };
}
