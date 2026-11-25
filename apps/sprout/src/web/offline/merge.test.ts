import { describe, expect, test } from 'vitest';
import type { PlantFields } from '../../shared/plant.ts';
import { mergeFields } from './merge.ts';

const base: PlantFields = { name: 'Window fern', light: 'medium', wateringIntervalDays: 4 };

describe('mergeFields', () => {
  test('a field I did not change takes their value', () => {
    const theirs = { ...base, wateringIntervalDays: 7 };
    expect(mergeFields(base, base, theirs)).toEqual({ merged: theirs, clashes: [] });
  });

  test('a field only I changed keeps my value', () => {
    const mine = { ...base, light: 'low' as const };
    expect(mergeFields(base, mine, base)).toEqual({ merged: mine, clashes: [] });
  });

  test('different fields changed by each person are both kept, with no clash', () => {
    const mine = { ...base, light: 'low' as const };
    const theirs = { ...base, wateringIntervalDays: 7 };
    expect(mergeFields(base, mine, theirs)).toEqual({
      merged: { ...base, light: 'low', wateringIntervalDays: 7 },
      clashes: [],
    });
  });

  test('the same field changed to the same value is not a clash', () => {
    const same = { ...base, wateringIntervalDays: 10 };
    expect(mergeFields(base, same, same)).toEqual({ merged: same, clashes: [] });
  });

  test('the same field changed to different values is a clash', () => {
    const mine = { ...base, name: 'Fern (Ava)' };
    const theirs = { ...base, name: 'Fern (Ben)' };
    expect(mergeFields(base, mine, theirs)).toEqual({ merged: theirs, clashes: ['name'] });
  });

  test('only the clashing fields are listed; agreeing and one-sided ones are merged', () => {
    const mine = { name: 'Fern (Ava)', light: 'low' as const, wateringIntervalDays: 10 };
    const theirs = { name: 'Fern (Ben)', light: 'medium' as const, wateringIntervalDays: 10 };
    expect(mergeFields(base, mine, theirs)).toEqual({
      merged: { name: 'Fern (Ben)', light: 'low', wateringIntervalDays: 10 },
      clashes: ['name'],
    });
  });

  test('everything equal: nothing to decide', () => {
    expect(mergeFields(base, base, base)).toEqual({ merged: base, clashes: [] });
  });
});
