import { expect, type Locator, type Page } from '@playwright/test';

export class PlantListPage {
  readonly heading: Locator;
  readonly addPlant: Locator;
  readonly signOutButton: Locator;
  readonly signOutHint: Locator;
  readonly #page: Page;

  constructor(page: Page) {
    this.#page = page;
    this.heading = page.getByRole('heading', { name: 'Plants', exact: true });
    this.addPlant = page.getByRole('link', { name: 'Add plant' });
    this.signOutButton = page.getByRole('button', { name: 'Sign out' });
    this.signOutHint = page.getByText('You can sign out once all your changes are synced.');
  }

  /** One plant's row, found by its exact name (each row has data-testid="plant-row"). */
  row(name: string): Locator {
    return this.#page
      .getByTestId('plant-row')
      .filter({ has: this.#page.getByRole('heading', { name, exact: true }) });
  }

  editLink(name: string): Locator {
    return this.#page.getByRole('link', { name: `Edit ${name}`, exact: true });
  }

  /** The plant's row shows exactly these details, for example "Direct sun · Water every 3 days". */
  async expectPlant(name: string, details: string): Promise<void> {
    await expect(this.row(name).getByText(details, { exact: true })).toBeVisible();
  }

  notSynced(name: string): Locator {
    return this.row(name).getByText('Not synced yet');
  }

  async waitUntilShown(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async open(): Promise<void> {
    await this.#page.goto('/plants');
    await this.waitUntilShown();
  }

  async signOut(): Promise<void> {
    await this.signOutButton.click();
  }
}
