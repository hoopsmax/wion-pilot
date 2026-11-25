/** The shape of .wion/map/app-map.json, shared by the crawler, the viewer and later milestones. */

export interface MappedElement {
  kind: 'button' | 'link' | 'field';
  /** The ARIA role, for example "button", "textbox" or "combobox". */
  role: string;
  /** The accessible name; empty when the element has none. */
  name: string;
  /** A Playwright locator, or undefined when none can be suggested safely. */
  locator: string | undefined;
  /** Why there is no locator, for example a missing accessible name. */
  problem?: string;
}

export interface MappedField {
  label: string;
  type: string;
  required: boolean;
  min?: string;
  max?: string;
  options?: string[];
}

export interface MappedForm {
  fields: MappedField[];
}

export interface MappedTestId {
  testId: string;
  count: number;
  locator: string;
}

export interface Screen {
  /** The route pattern, for example "/plants/:id/edit"; one screen per pattern. */
  pattern: string;
  /** The first URL that showed this screen. */
  url: string;
  title: string;
  headings: string[];
  forms: MappedForm[];
  elements: MappedElement[];
  testIds: MappedTestId[];
  /** Relative to the map folder. */
  screenshot: string;
}

export interface SkippedLink {
  url: string;
  reason: string;
}

export interface AppMap {
  startUrl: string;
  createdAt: string;
  screens: Screen[];
  skipped: SkippedLink[];
}
