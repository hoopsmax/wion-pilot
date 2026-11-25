import type { Page, TestInfo } from '@playwright/test';
import {
  BROWSER_LOG_ATTACHMENT,
  type BrowserLog,
} from '../../packages/core/src/report/bug-report-reporter.ts';

function shortUrl(url: string): string {
  const { pathname, search } = new URL(url);
  return `${pathname}${search}`;
}

/** Records one person's console errors and failed requests, labelled with their name. */
export function recordBrowserLog(page: Page, who: string, log: BrowserLog): void {
  page.on('console', (message) => {
    if (message.type() === 'error') log.consoleErrors.push(`${who}: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    log.consoleErrors.push(`${who}: uncaught error: ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? 'failed';
    log.failedRequests.push(
      `${who}: ${request.method()} ${shortUrl(request.url())} → no answer (${reason})`,
    );
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      const request = response.request();
      log.failedRequests.push(
        `${who}: ${request.method()} ${shortUrl(response.url())} → ${String(response.status())} ${response.statusText()}`,
      );
    }
  });
}

/** Adds the log to a failed test, where the bug-report reporter reads it. Passing tests skip it. */
export async function attachIfFailed(testInfo: TestInfo, log: BrowserLog): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) return;
  await testInfo.attach(BROWSER_LOG_ATTACHMENT, {
    body: JSON.stringify(log, null, 2),
    contentType: 'application/json',
  });
}
