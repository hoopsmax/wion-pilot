import { describe, expect, test } from 'vitest';
import { toMappedForms, type RawField } from './forms.ts';

function raw(overrides: Partial<RawField>): RawField {
  return {
    tag: 'input',
    type: 'text',
    label: 'Name',
    required: false,
    min: null,
    max: null,
    options: [],
    ...overrides,
  };
}

describe('toMappedForms', () => {
  test('keeps label, type and rules; options only for a select', () => {
    const forms = toMappedForms([
      [
        raw({ label: 'Name', required: true }),
        raw({ tag: 'select', type: 'select-one', label: 'Light', options: ['Choose…', 'Low'] }),
        raw({ type: 'number', label: 'Days', min: '1', max: '60' }),
        raw({ tag: 'textarea', type: 'textarea', label: 'Notes' }),
      ],
    ]);
    expect(forms).toEqual([
      {
        fields: [
          { label: 'Name', type: 'text', required: true },
          { label: 'Light', type: 'select', required: false, options: ['Choose…', 'Low'] },
          { label: 'Days', type: 'number', required: false, min: '1', max: '60' },
          { label: 'Notes', type: 'textarea', required: false },
        ],
      },
    ]);
  });

  test('leaves out hidden inputs and buttons, and forms left with no field', () => {
    const forms = toMappedForms([
      [raw({ type: 'hidden', label: '' }), raw({ label: 'Email', type: 'email' })],
      [raw({ type: 'submit', label: '' })],
    ]);
    expect(forms).toEqual([{ fields: [{ label: 'Email', type: 'email', required: false }] }]);
  });

  test('an input without a type is a text field', () => {
    expect(toMappedForms([[raw({ type: '' })]])).toEqual([
      { fields: [{ label: 'Name', type: 'text', required: false }] },
    ]);
  });
});
