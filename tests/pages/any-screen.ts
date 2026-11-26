import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Whatever screen a person is on, for the generic steps that recorded scenarios use (wion teach).
 * Everything is found by the name a person sees: a button's or link's text, a field's label, the
 * same names the app map records. The other page objects stay one per screen; this one serves the
 * steps that are not about one screen.
 */
export class AnyScreen {
  readonly #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  /** The button or link with exactly this name. */
  target(name: string): Locator {
    return this.#page
      .getByRole('button', { name, exact: true })
      .or(this.#page.getByRole('link', { name, exact: true }));
  }

  /** The form field with exactly this label. */
  field(label: string): Locator {
    return this.#page.getByLabel(label, { exact: true });
  }

  async click(name: string): Promise<void> {
    await this.target(name).click();
  }

  async fill(label: string, value: string): Promise<void> {
    await this.field(label).fill(value);
  }

  async choose(label: string, option: string): Promise<void> {
    await this.field(label).selectOption({ label: option });
  }

  /** The text is shown somewhere on the screen, exactly as written. */
  async expectText(text: string): Promise<void> {
    await expect(this.#page.getByText(text, { exact: true }).first()).toBeVisible();
  }
}
