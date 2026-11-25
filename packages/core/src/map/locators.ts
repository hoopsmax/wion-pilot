import type { MappedElement, MappedTestId } from './app-map.ts';

/**
 * One node of Playwright's accessibility snapshot (page.ariaSnapshotJSON): a plain text, or an
 * element with a role, an accessible name and children.
 */
export type AriaNode =
  string | { role: string; name?: string; level?: number; text?: string; children?: AriaNode[] };

const FIELD_ROLES = new Set([
  'textbox',
  'searchbox',
  'combobox',
  'spinbutton',
  'checkbox',
  'radio',
  'slider',
  'switch',
  'listbox',
]);

/** A JavaScript string literal with single quotes, as Prettier would write it. */
function quoted(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function kindOf(role: string): MappedElement['kind'] | undefined {
  if (role === 'button') return 'button';
  if (role === 'link') return 'link';
  return FIELD_ROLES.has(role) ? 'field' : undefined;
}

/** Role and name first (as CLAUDE.md asks); fields by their label, the way a person finds them. */
function locatorFor(kind: MappedElement['kind'], role: string, name: string): string {
  return kind === 'field'
    ? `getByLabel(${quoted(name)}, { exact: true })`
    : `getByRole(${quoted(role)}, { name: ${quoted(name)}, exact: true })`;
}

function walk(nodes: AriaNode[], visit: (node: Exclude<AriaNode, string>) => boolean): void {
  for (const node of nodes) {
    if (typeof node === 'string') continue;
    // The visitor returns false to skip the node's children (a combobox's options, say).
    if (visit(node) && node.children) walk(node.children, visit);
  }
}

/**
 * Buttons, links and form fields with a locator each. An element without an accessible name gets
 * no locator but a "problem", which is itself worth knowing: people using a screen reader miss it.
 * When two elements share a role and name, the locator says which one with .nth().
 */
export function interactiveElements(nodes: AriaNode[]): MappedElement[] {
  const found: MappedElement[] = [];
  walk(nodes, (node) => {
    const kind = kindOf(node.role);
    if (!kind) return true;
    const name = (node.name ?? '').trim();
    found.push(
      name === ''
        ? {
            kind,
            role: node.role,
            name,
            locator: undefined,
            problem: 'No accessible name: add a label or text.',
          }
        : { kind, role: node.role, name, locator: locatorFor(kind, node.role, name) },
    );
    return false;
  });
  return found.map((element) => {
    if (!element.locator) return element;
    const same = found.filter((other) => other.locator === element.locator);
    return same.length > 1
      ? { ...element, locator: `${element.locator}.nth(${String(same.indexOf(element))})` }
      : element;
  });
}

export function headings(nodes: AriaNode[]): string[] {
  const texts: string[] = [];
  walk(nodes, (node) => {
    if (node.role === 'heading' && node.name) texts.push(node.name);
    return true;
  });
  return texts;
}

/** data-testid values found on a screen, counted, with their locator. */
export function testIdLocators(testIds: string[]): MappedTestId[] {
  const counts = new Map<string, number>();
  for (const id of testIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([testId, count]) => ({
    testId,
    count,
    locator: `getByTestId(${quoted(testId)})`,
  }));
}
