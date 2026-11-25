import type { Locator, Page } from '@playwright/test';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The screen that asks which value to keep when two people changed the same field. */
export class ConflictPage {
  readonly #page: Page;
  readonly anyHeading: Locator;
  readonly askedFields: Locator;
  readonly saveChoices: Locator;
  readonly keepAllMine: Locator;
  readonly takeAllLatest: Locator;

  constructor(page: Page) {
    this.#page = page;
    this.anyHeading = page.getByRole('heading', {
      name: /changed this plant while you were editing$/,
    });
    // Each asked field is a fieldset, which is a "group" with the field's name.
    this.askedFields = page.getByRole('group');
    this.saveChoices = page.getByRole('button', { name: 'Save my choices' });
    this.keepAllMine = page.getByRole('button', { name: 'Keep all mine' });
    this.takeAllLatest = page.getByRole('button', { name: 'Take all latest' });
  }

  heading(changedBy: string): Locator {
    return this.#page.getByRole('heading', {
      name: `${changedBy} changed this plant while you were editing`,
    });
  }

  field(name: string): Locator {
    return this.#page.getByRole('group', { name, exact: true });
  }

  /** A choice for one field, by the start of its label: "Yours" or "Latest (Ben)". */
  choice(field: string, side: string): Locator {
    return this.field(field).getByRole('radio', { name: new RegExp(`^${escapeRegExp(side)}:`) });
  }
}
