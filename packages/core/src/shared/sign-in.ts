import type { Page } from '@playwright/test';
import type { SignInConfig } from './config.ts';

const FIX = 'Check map.signIn in wion.config.json.';

/** A URL's path without a trailing slash: "/sign-in/" and "/sign-in" are the same page. */
function pathOf(url: string | URL): string {
  const { pathname } = new URL(url);
  return pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
}

async function step(action: () => Promise<unknown>, problem: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    throw new Error(problem, { cause: error });
  }
}

/**
 * Waits for whichever comes first: the page leaves the sign-in page (undefined), or an error
 * alert appears (its text), as forms usually show "wrong password". Without the alert a wrong
 * password would only show up as a timeout.
 */
async function signInOutcome(
  page: Page,
  signInPath: string,
  watchAlerts: boolean,
): Promise<string | undefined> {
  const left = page.waitForURL((url) => pathOf(url) !== signInPath).then(() => undefined);
  if (!watchAlerts) return left;
  const alert = page.getByRole('alert').filter({ hasText: /\S/ }).first();
  const alerted = alert.waitFor({ state: 'visible' }).then(async () => {
    const text = await alert.innerText();
    return text.replace(/\s+/g, ' ').trim();
  });
  // Promise.any settles with the first success; the other wait ends with the browser, unheard.
  return Promise.any([left, alerted]);
}

/**
 * Signs in on the sign-in page that is open now: the fields by their label, the button by its
 * name, as wion.config.json says. Used by wion map and wion teach, before they look or record.
 */
export async function signIn(page: Page, config: SignInConfig): Promise<void> {
  const signInPath = pathOf(page.url());
  for (const [label, value] of Object.entries(config.fields)) {
    await step(
      () => page.getByLabel(label, { exact: true }).fill(value),
      `Sign-in: no field labelled "${label}" on ${page.url()}. ${FIX}`,
    );
  }
  // An alert that is already there before signing in says nothing about the sign-in.
  const watchAlerts = !(await page.getByRole('alert').first().isVisible());
  await step(
    () => page.getByRole('button', { name: config.submit, exact: true }).click(),
    `Sign-in: no button named "${config.submit}" on ${page.url()}. ${FIX}`,
  );
  let alertText: string | undefined;
  await step(async () => {
    alertText = await signInOutcome(page, signInPath, watchAlerts);
  }, `Sign-in did not leave ${signInPath}. Is the password right? ${FIX}`);
  if (alertText !== undefined) throw new Error(`Sign-in failed: ${alertText} ${FIX}`);
  await page.waitForLoadState('networkidle');
}

/** Opens the app's sign-in page (its address relative to the start URL) and signs in. */
export async function openAndSignIn(
  page: Page,
  startUrl: string,
  config: SignInConfig,
): Promise<void> {
  await page.goto(new URL(config.url, startUrl).href, { waitUntil: 'networkidle' });
  await signIn(page, config);
}
