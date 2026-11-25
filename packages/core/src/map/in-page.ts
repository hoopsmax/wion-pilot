/**
 * The few parts of the browser's DOM that the crawler reads inside the page.
 *
 * Wion-Pilot is Node code and has no DOM types, so these describe just what the in-page functions
 * touch. Functions passed to page.evaluate() are sent to the browser as source text: they must
 * reach the document through globalThis and cannot call anything else in this module.
 */

export interface DomText {
  textContent: string | null;
}

export interface DomElement extends DomText {
  tagName: string;
  getAttribute(name: string): string | null;
}

export interface DomField extends DomElement {
  type?: string;
  required?: boolean;
  labels?: ArrayLike<DomText> | null;
  options?: ArrayLike<DomText>;
}

export interface DomAnchor extends DomElement {
  /** The absolute address, already resolved by the browser. */
  href: string;
}

export interface DomForm {
  querySelectorAll(selector: string): ArrayLike<DomField>;
}

export interface DomDocument {
  forms: ArrayLike<DomForm>;
  getElementById(id: string): DomText | null;
  querySelectorAll(selector: string): ArrayLike<DomElement>;
}

export interface PageGlobals {
  document: DomDocument;
}
