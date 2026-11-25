import { expect, type Locator, type Page } from '@playwright/test';

export interface FormValues {
  name?: string;
  /** The visible label of the light level, for example "Direct sun". Empty leaves it unchosen. */
  light?: string;
  interval?: number | string;
}

/** The "Add plant" and "Edit plant" form: one screen for both. */
export class PlantFormPage {
  readonly #page: Page;
  readonly name: Locator;
  readonly light: Locator;
  readonly interval: Locator;
  readonly save: Locator;
  readonly cancel: Locator;
  readonly #listHeading: Locator;

  constructor(page: Page) {
    this.#page = page;
    this.name = page.getByLabel('Name', { exact: true });
    this.light = page.getByLabel('Light', { exact: true });
    this.interval = page.getByLabel('Watering interval (days)', { exact: true });
    this.save = page.getByRole('button', { name: 'Save' });
    this.cancel = page.getByRole('link', { name: 'Cancel' });
    this.#listHeading = page.getByRole('heading', { name: 'Plants', exact: true });
  }

  heading(title: 'Add plant' | 'Edit plant'): Locator {
    return this.#page.getByRole('heading', { name: title, exact: true });
  }

  /** A form field found by its visible label, as a person would find it. */
  field(label: string): Locator {
    return this.#page.getByLabel(label, { exact: true });
  }

  /** Editing loads the plant first; Save is enabled only once the form is filled in. */
  async waitUntilReady(): Promise<void> {
    await expect(this.save).toBeEnabled();
  }

  async fill({ name, light, interval }: FormValues): Promise<void> {
    if (name !== undefined) await this.name.fill(name);
    if (light !== undefined && light !== '') await this.light.selectOption({ label: light });
    if (interval !== undefined) await this.interval.fill(String(interval));
  }

  /**
   * Saves and waits until the plant list is back. The app queues the change before it shows the
   * list, so after this the change is in the outbox, not just typed into the form.
   */
  async saveAndReturnToList(): Promise<void> {
    await this.save.click();
    await expect(this.#listHeading).toBeVisible();
  }
}
