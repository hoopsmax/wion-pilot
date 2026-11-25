import type { Page } from '@playwright/test';
import type { MappedField, MappedForm } from './app-map.ts';
import type { DomField, PageGlobals } from './in-page.ts';

/** A form field as read in the browser, before it is cleaned up. */
export interface RawField {
  tag: string;
  type: string;
  label: string;
  required: boolean;
  min: string | null;
  max: string | null;
  options: string[];
}

/** Inputs a person does not fill in: they are buttons or carry hidden data. */
const NOT_FILLED = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

/** Runs in the browser (see in-page.ts): every form, with each field's label and rules. */
function rawFormsInPage(): RawField[][] {
  const { document } = globalThis as unknown as PageGlobals;
  const clean = (text: string | null | undefined): string =>
    (text ?? '').replace(/\s+/g, ' ').trim();
  const labelOf = (field: DomField): string => {
    const byLabel = field.labels?.[0]?.textContent;
    if (byLabel) return clean(byLabel);
    const ariaLabel = field.getAttribute('aria-label');
    if (ariaLabel) return clean(ariaLabel);
    const ids = (field.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
    return clean(ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' '));
  };
  return Array.from(document.forms, (form) =>
    Array.from(form.querySelectorAll('input, select, textarea'), (field) => ({
      tag: field.tagName.toLowerCase(),
      type: field.type ?? '',
      label: labelOf(field),
      required: field.required === true,
      min: field.getAttribute('min'),
      max: field.getAttribute('max'),
      options: Array.from(field.options ?? [], (option) => clean(option.textContent)),
    })),
  );
}

function toMappedField(raw: RawField): MappedField | undefined {
  if (raw.tag === 'input' && NOT_FILLED.has(raw.type)) return undefined;
  const type = raw.tag === 'input' ? raw.type || 'text' : raw.tag;
  return {
    label: raw.label,
    type,
    required: raw.required,
    ...(raw.min === null ? {} : { min: raw.min }),
    ...(raw.max === null ? {} : { max: raw.max }),
    ...(raw.tag === 'select' ? { options: raw.options } : {}),
  };
}

/** Keeps the fields a person fills in; forms left without any (a lone button) are dropped. */
export function toMappedForms(raw: RawField[][]): MappedForm[] {
  return raw
    .map((fields) => ({
      fields: fields.map(toMappedField).filter((field) => field !== undefined),
    }))
    .filter((form) => form.fields.length > 0);
}

export async function readForms(page: Page): Promise<MappedForm[]> {
  return toMappedForms(await page.evaluate(rawFormsInPage));
}
