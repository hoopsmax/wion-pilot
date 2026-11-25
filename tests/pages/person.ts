import { expect, type BrowserContext, type Page } from '@playwright/test';
import { CREDENTIALS, type PersonName } from '../fixtures/people.ts';
import { ConflictPage } from './conflict-page.ts';
import { PlantFormPage } from './plant-form-page.ts';
import { PlantListPage } from './plant-list-page.ts';
import { SignInPage } from './sign-in-page.ts';
import { SyncBanner } from './sync-banner.ts';

/** Sprout refreshes from the server every 10 seconds; fast-forwarding past it triggers one. */
const BACKGROUND_REFRESH_MS = 11_000;

/** One person in their own browser, with the page objects for every Sprout screen. */
export class Person {
  readonly name: PersonName;
  readonly page: Page;
  readonly context: BrowserContext;
  readonly signInPage: SignInPage;
  readonly plantList: PlantListPage;
  readonly form: PlantFormPage;
  readonly conflict: ConflictPage;
  readonly banner: SyncBanner;
  #offline = false;

  constructor(name: PersonName, page: Page) {
    this.name = name;
    this.page = page;
    this.context = page.context();
    this.signInPage = new SignInPage(page);
    this.plantList = new PlantListPage(page);
    this.form = new PlantFormPage(page);
    this.conflict = new ConflictPage(page);
    this.banner = new SyncBanner(page);
  }

  async signIn(password: string = CREDENTIALS[this.name].password): Promise<void> {
    await this.signInPage.open();
    await this.signInPage.signIn(CREDENTIALS[this.name].email, password);
  }

  async signInAndWaitForSync(): Promise<void> {
    await this.signIn();
    await this.plantList.waitUntilShown();
    await this.banner.expectStatus('Synced');
  }

  /** Opens a plant's edit form from a freshly loaded list, so the list has synced first. */
  async startEditing(plantName: string): Promise<void> {
    await this.plantList.open();
    await this.plantList.editLink(plantName).click();
    await this.form.waitUntilReady();
  }

  /**
   * Saves the form. Online, it also waits until the change really reached the server: the list
   * comes back (change queued), then the banner says Synced and nothing is marked unsynced.
   */
  async saveForm(): Promise<void> {
    await this.form.saveAndReturnToList();
    if (!this.#offline) await this.expectAllSynced();
  }

  async expectAllSynced(): Promise<void> {
    await this.banner.expectStatus('Synced');
    await expect(this.plantList.anyNotSynced).toHaveCount(0);
  }

  async goOffline(): Promise<void> {
    await this.context.setOffline(true);
    this.#offline = true;
    await this.banner.expectStatus('Offline');
  }

  async goOnline(): Promise<void> {
    await this.context.setOffline(false);
    this.#offline = false;
  }

  /** Lets the test move this browser's time forward; must happen before the app is loaded. */
  async controlClock(): Promise<void> {
    await this.page.clock.install();
  }

  /**
   * Moves time past Sprout's 10-second refresh and waits until the refreshed plants are stored:
   * the refresh request comes back, then the banner settles on Synced again.
   */
  async letBackgroundRefreshRun(): Promise<void> {
    const refreshed = this.page.waitForResponse(
      (response) => response.url().endsWith('/api/plants') && response.request().method() === 'GET',
    );
    await this.page.clock.runFor(BACKGROUND_REFRESH_MS);
    await refreshed;
    await this.banner.expectStatus('Synced');
  }
}
