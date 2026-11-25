import { describe, expect, test } from 'vitest';
import { headings, interactiveElements, testIdLocators, type AriaNode } from './locators.ts';

// Shaped like Playwright's ariaSnapshotJSON of Sprout's "Add plant" screen.
const addPlant: AriaNode[] = [
  {
    role: 'main',
    children: [
      { role: 'heading', name: 'Add plant', level: 1 },
      'Name',
      { role: 'textbox', name: 'Name' },
      {
        role: 'combobox',
        name: 'Light',
        children: [
          { role: 'option', name: 'Choose…' },
          { role: 'option', name: 'Direct sun' },
        ],
      },
      { role: 'spinbutton', name: 'Watering interval (days)' },
      { role: 'button', name: 'Save' },
      { role: 'link', name: 'Cancel' },
    ],
  },
];

describe('interactiveElements', () => {
  test('gives buttons and links a role locator and fields a label locator', () => {
    expect(interactiveElements(addPlant).map((e) => [e.kind, e.locator])).toEqual([
      ['field', "getByLabel('Name', { exact: true })"],
      ['field', "getByLabel('Light', { exact: true })"],
      ['field', "getByLabel('Watering interval (days)', { exact: true })"],
      ['button', "getByRole('button', { name: 'Save', exact: true })"],
      ['link', "getByRole('link', { name: 'Cancel', exact: true })"],
    ]);
  });

  test('does not list the options inside a combobox as separate elements', () => {
    expect(interactiveElements(addPlant).some((e) => e.name === 'Direct sun')).toBe(false);
  });

  test('an element without an accessible name gets no locator but a problem', () => {
    const [element] = interactiveElements([{ role: 'button' }]);
    expect(element).toMatchObject({ kind: 'button', locator: undefined });
    expect(element?.problem).toMatch(/No accessible name/);
  });

  test('elements with the same role and name are told apart with nth()', () => {
    const twoEdits: AriaNode[] = [
      { role: 'button', name: 'Edit' },
      { role: 'button', name: 'Edit' },
    ];
    expect(interactiveElements(twoEdits).map((e) => e.locator)).toEqual([
      "getByRole('button', { name: 'Edit', exact: true }).nth(0)",
      "getByRole('button', { name: 'Edit', exact: true }).nth(1)",
    ]);
  });

  test("quotes are escaped, so the locator is valid code (Ava's plant)", () => {
    const [element] = interactiveElements([{ role: 'link', name: "Edit Ava's fern" }]);
    expect(element?.locator).toBe("getByRole('link', { name: 'Edit Ava\\'s fern', exact: true })");
  });
});

describe('headings', () => {
  test('lists every heading text in order', () => {
    expect(headings(addPlant)).toEqual(['Add plant']);
  });
});

describe('testIdLocators', () => {
  test('counts each test id and gives its locator', () => {
    expect(testIdLocators(['plant-row', 'plant-row', 'sync-banner'])).toEqual([
      { testId: 'plant-row', count: 2, locator: "getByTestId('plant-row')" },
      { testId: 'sync-banner', count: 1, locator: "getByTestId('sync-banner')" },
    ]);
  });
});
