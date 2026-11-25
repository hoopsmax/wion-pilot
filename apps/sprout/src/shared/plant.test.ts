import { describe, expect, test } from 'vitest';
import { validatePlantFields } from './plant.ts';

const valid = { name: 'Window fern', light: 'medium', wateringIntervalDays: 7 };

describe('validatePlantFields', () => {
  test('accepts valid fields and trims the name', () => {
    expect(validatePlantFields({ ...valid, name: '  Window fern  ' })).toEqual({
      ok: true,
      fields: valid,
    });
  });

  test.each([
    ['missing', undefined],
    ['empty', ''],
    ['only spaces', '   '],
    ['too long', 'x'.repeat(61)],
  ])('rejects a name that is %s', (_case, name) => {
    const result = validatePlantFields({ ...valid, name });
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.errors.name).toBeDefined();
  });

  test('accepts a name of exactly 60 characters', () => {
    expect(validatePlantFields({ ...valid, name: 'x'.repeat(60) }).ok).toBe(true);
  });

  test.each([1, 60])('accepts the boundary interval %d', (days) => {
    expect(validatePlantFields({ ...valid, wateringIntervalDays: days }).ok).toBe(true);
  });

  test.each([0, 61, 2.5, -1, '7', undefined])('rejects the interval %s', (days) => {
    const result = validatePlantFields({ ...valid, wateringIntervalDays: days });
    expect(result.ok ? undefined : result.errors.wateringIntervalDays).toMatch(/1 to 60 days/);
  });

  test.each(['sunny', '', undefined])('rejects the light level %s', (light) => {
    const result = validatePlantFields({ ...valid, light });
    expect(result.ok ? undefined : result.errors.light).toBe('Choose a light level from the list.');
  });

  test('reports every invalid field at once', () => {
    const result = validatePlantFields({});
    expect(result.ok ? [] : Object.keys(result.errors).sort()).toEqual([
      'light',
      'name',
      'wateringIntervalDays',
    ]);
  });
});
