import { expect, type Locator, type Page } from '@playwright/test';

export class SignInPage {
  readonly #page: Page;
  readonly heading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.#page = page;
    this.heading = page.getByRole('heading', { name: 'Sign in to Sprout' });
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Sign in' });
    this.error = page.getByRole('alert');
  }

  async open(): Promise<void> {
    await this.#page.goto('/sign-in');
    await expect(this.heading).toBeVisible();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
