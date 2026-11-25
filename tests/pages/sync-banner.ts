import { expect, type Locator, type Page } from '@playwright/test';

export type SyncStatus = 'Offline' | 'Syncing' | 'Synced';

/** The status line at the top of every signed-in screen. */
export class SyncBanner {
  readonly root: Locator;
  readonly review: Locator;
  readonly needsDecision: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId('sync-banner');
    this.review = this.root.getByRole('link', { name: 'Review' });
    this.needsDecision = this.root.getByText(/needs? your decision/);
  }

  status(status: SyncStatus): Locator {
    return this.root.getByText(status, { exact: true });
  }

  async expectStatus(status: SyncStatus): Promise<void> {
    await expect(this.status(status)).toBeVisible();
  }
}
