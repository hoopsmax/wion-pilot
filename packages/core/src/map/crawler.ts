import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import type { SignInConfig } from '../shared/config.ts';
import type { AppMap, Screen } from './app-map.ts';
import { sameScreen, screenshotPath, triageLinks } from './crawl-rules.ts';
import { readScreen } from './screen-reader.ts';
import { routePattern } from './urls.ts';
import { buildViewer } from './viewer.ts';

export interface CrawlOptions {
  startUrl: string;
  /** Where app-map.json, index.html and screens/ are written. */
  outDir: string;
  maxPages: number;
  maxDepth: number;
  allowedDomains: string[];
  signIn?: SignInConfig;
  /** A browser binary to use instead of Playwright's own (PW_CHROMIUM_PATH). */
  chromiumPath?: string;
  log: (line: string) => void;
}

export const CRAWL_DEFAULTS = { maxPages: 30, maxDepth: 3 } as const;

/** Long enough for a slow page, short enough that a wrong label does not hang the run. */
const STEP_TIMEOUT_MS = 15_000;

interface QueuedPage {
  url: string;
  depth: number;
}

interface CrawlState {
  options: CrawlOptions;
  screens: Screen[];
  skipped: Map<string, string>;
  /** Route patterns already mapped or waiting in the queue: each is opened once. */
  known: Set<string>;
  mapped: Set<string>;
  screenshots: Set<string>;
  queue: QueuedPage[];
  pagesOpened: number;
}

/** Opens one page by its address, maps it if its route is new, and queues its links. */
async function visit(page: Page, state: CrawlState, { url, depth }: QueuedPage): Promise<void> {
  const { options } = state;
  await page.goto(url, { waitUntil: 'networkidle' });
  state.pagesOpened += 1;
  // A redirect can land on a route that is already mapped, for example "/" → "/plants".
  const pattern = routePattern(page.url());
  state.known.add(pattern);
  if (state.mapped.has(pattern)) return;
  state.mapped.add(pattern);

  const { screen, links } = await readScreen(page, pattern);
  const twin = state.screens.find((mapped) => sameScreen(mapped, screen));
  if (twin) {
    // The same screen under a second address is noted on the first, not mapped again.
    twin.alsoAt = [...(twin.alsoAt ?? []), pattern];
    options.log(`${pattern} shows the same screen as ${twin.pattern}`);
    return;
  }
  const screenshot = screenshotPath(pattern, state.screenshots);
  state.screenshots.add(screenshot);
  await page.screenshot({ path: join(options.outDir, screenshot), fullPage: true });
  state.screens.push({ ...screen, screenshot });
  options.log(`Mapped ${pattern} (${screen.headings[0] ?? screen.title})`);

  const { follow, skipped } = triageLinks(links, options.startUrl, options.allowedDomains);
  for (const link of skipped) state.skipped.set(link.url, link.reason);
  for (const next of follow) {
    const nextPattern = routePattern(next);
    if (state.known.has(nextPattern)) continue;
    state.known.add(nextPattern);
    if (depth + 1 > options.maxDepth) {
      state.skipped.set(next, `deeper than --max-depth ${String(options.maxDepth)}`);
    } else {
      state.queue.push({ url: next, depth: depth + 1 });
    }
  }
}

async function step(action: () => Promise<unknown>, problem: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    throw new Error(problem, { cause: error });
  }
}

/** The only place the crawler types or clicks: it fills the sign-in form and presses its button. */
async function signIn(page: Page, signInConfig: SignInConfig): Promise<void> {
  const signInPattern = routePattern(page.url());
  const fix = 'Check map.signIn in wion.config.json.';
  for (const [label, value] of Object.entries(signInConfig.fields)) {
    await step(
      () => page.getByLabel(label, { exact: true }).fill(value),
      `Sign-in: no field labelled "${label}" on ${page.url()}. ${fix}`,
    );
  }
  await step(
    () => page.getByRole('button', { name: signInConfig.submit, exact: true }).click(),
    `Sign-in: no button named "${signInConfig.submit}" on ${page.url()}. ${fix}`,
  );
  await step(
    () => page.waitForURL((url) => routePattern(url.toString()) !== signInPattern),
    `Sign-in did not leave ${signInPattern}. Is the password right? ${fix}`,
  );
  await page.waitForLoadState('networkidle');
}

async function crawlPages(page: Page, state: CrawlState): Promise<void> {
  const { options } = state;
  const signInConfig = options.signIn;
  if (signInConfig) {
    // The sign-in screen is mapped first, while it can still be seen.
    await visit(page, state, { url: new URL(signInConfig.url, options.startUrl).href, depth: 0 });
    await signIn(page, signInConfig);
  }
  state.queue.unshift({ url: options.startUrl, depth: 0 });
  state.known.add(routePattern(options.startUrl));
  for (let next = state.queue.shift(); next; next = state.queue.shift()) {
    if (state.pagesOpened >= options.maxPages) {
      state.skipped.set(next.url, `over --max-pages ${String(options.maxPages)}`);
      continue;
    }
    await visit(page, state, next);
  }
}

/**
 * Maps a web app breadth-first: each route once, with its fields, locators and a screenshot.
 * It opens pages only by their address and never clicks or submits, apart from signing in.
 */
export async function crawl(options: CrawlOptions): Promise<AppMap> {
  await mkdir(join(options.outDir, 'screens'), { recursive: true });
  const browser = await chromium.launch(
    options.chromiumPath ? { executablePath: options.chromiumPath } : {},
  );
  const state: CrawlState = {
    options,
    screens: [],
    skipped: new Map(),
    known: new Set(),
    mapped: new Set(),
    screenshots: new Set(),
    queue: [],
    pagesOpened: 0,
  };
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(STEP_TIMEOUT_MS);
    await crawlPages(page, state);
  } finally {
    await browser.close();
  }
  return {
    startUrl: options.startUrl,
    createdAt: new Date().toISOString(),
    screens: state.screens,
    skipped: [...state.skipped].map(([url, reason]) => ({ url, reason })),
  };
}

/** Writes app-map.json and the viewer, index.html, next to the screenshots. */
export async function writeMap(map: AppMap, outDir: string): Promise<void> {
  await writeFile(join(outDir, 'app-map.json'), `${JSON.stringify(map, null, 2)}\n`);
  await writeFile(join(outDir, 'index.html'), buildViewer(map));
}
