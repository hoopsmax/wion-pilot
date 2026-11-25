import type { BrowserContext, Page } from '@playwright/test';
import { CREDENTIALS, type PersonName } from '../fixtures/people.ts';
import { PlantListPage } from './plant-list-page.ts';
import { SignInPage } from './sign-in-page.ts';
import { SyncBanner } from './sync-banner.ts';

/** One person in their own browser, with the page objects for every Sprout screen. */
export class Person {
  readonly name: PersonName;
  readonly page: Page;
  readonly context: BrowserContext;
  readonly signInPage: SignInPage;
  readonly plantList: PlantListPage;
  readonly banner: SyncBanner;

  constructor(name: PersonName, page: Page) {
    this.name = name;
    this.page = page;
    this.context = page.context();
    this.signInPage = new SignInPage(page);
    this.plantList = new PlantListPage(page);
    this.banner = new SyncBanner(page);
  }

  async signIn(password: string = CREDENTIALS[this.name].password): Promise<void> {
    await this.signInPage.open();
    await this.signInPage.signIn(CREDENTIALS[this.name].email, password);
  }

  async goOffline(): Promise<void> {
    await this.context.setOffline(true);
  }

  async goOnline(): Promise<void> {
    await this.context.setOffline(false);
  }
}
