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
  /** The same button under either name: the app renames it "Saving…" while it saves. */
  readonly saveOrSaving: Locator;
  readonly cancel: Locator;

  constructor(page: Page) {
    this.#page = page;
    this.name = page.getByLabel('Name', { exact: true });
    this.light = page.getByLabel('Light', { exact: true });
    this.interval = page.getByLabel('Watering interval (days)', { exact: true });
    // Exact: the conflict screen's "Save my choices" must not count as this form's Save button.
    this.save = page.getByRole('button', { name: 'Save', exact: true });
    this.saveOrSaving = page.getByRole('button', { name: /^(Save|Saving…)$/ });
    this.cancel = page.getByRole('link', { name: 'Cancel' });
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
   * Saves and waits until the form is gone. The app queues the change before it leaves the form,
   * so after this the change is in the outbox, not just typed in. It waits for the form to go,
   * not for the list to appear: when a conflict is found at once, the list shows for only a few
   * milliseconds before the conflict screen opens, and a test could miss it.
   *
   * It waits for the button under either name. Waiting for "Save" alone ended right after the
   * click, because the button is renamed "Saving…" before the change is queued: the test went on
   * too early, and another person's change could reach the server first.
   */
  async saveAndLeave(): Promise<void> {
    await this.save.click();
    await expect(this.saveOrSaving).toBeHidden();
  }
}
