import { describe, expect, test } from 'vitest';
import type { Plant, PlantFields } from '../../shared/plant.ts';
import { decideConflict, fieldsAfterChoices, settleConflict, type Conflict } from './conflicts.ts';
import type { Change } from './outbox.ts';

const base: PlantFields = { name: 'Window fern', light: 'medium', wateringIntervalDays: 4 };
const edit = (fields: Partial<PlantFields>): Change => ({
  kind: 'update',
  plantId: 'fern',
  baseVersion: 1,
  baseFields: base,
  fields: { ...base, ...fields },
});
const latest = (fields: Partial<PlantFields>): Plant => ({
  id: 'fern',
  ...base,
  ...fields,
  version: 2,
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'ben',
});
const empty = { plants: [], outbox: [], conflicts: [] };

describe('settleConflict', () => {
  test('different fields: no conflict, the combined edit is queued on the latest version', () => {
    const sent = edit({ light: 'low' });
    const theirs = latest({ wateringIntervalDays: 7 });
    const result = settleConflict({ ...empty, outbox: [sent] }, sent, theirs);
    expect(result.conflicts).toEqual([]);
    expect(result.outbox).toEqual([
      {
        kind: 'update',
        plantId: 'fern',
        baseVersion: 2,
        baseFields: { ...base, wateringIntervalDays: 7 },
        fields: { ...base, light: 'low', wateringIntervalDays: 7 },
      },
    ]);
    expect(result.plants).toEqual([theirs]);
  });

  test('both typed the same: nothing is queued and nothing is asked', () => {
    const sent = edit({ wateringIntervalDays: 10 });
    const result = settleConflict(
      { ...empty, outbox: [sent] },
      sent,
      latest({ wateringIntervalDays: 10 }),
    );
    expect(result).toMatchObject({ outbox: [], conflicts: [] });
  });

  test('same field, different values: a conflict that lists only that field', () => {
    const sent = edit({ name: 'Fern (Ava)', wateringIntervalDays: 10 });
    const theirs = latest({ name: 'Fern (Ben)', wateringIntervalDays: 10 });
    const result = settleConflict({ ...empty, outbox: [sent] }, sent, theirs);
    expect(result.outbox).toEqual([]);
    expect(result.conflicts).toEqual([
      {
        plantId: 'fern',
        mine: sent.fields,
        latest: theirs,
        clashes: ['name'],
        merged: { ...base, name: 'Fern (Ben)', wateringIntervalDays: 10 },
      },
    ]);
  });

  test('uses the newest save of the plant if the user saved again while it was sending', () => {
    const sent = edit({ name: 'Fern (Ava)' });
    const newer = edit({ name: 'Fern (Ava, later)' });
    const result = settleConflict(
      { ...empty, outbox: [newer] },
      sent,
      latest({ name: 'Fern (Ben)' }),
    );
    expect(result.conflicts[0]?.mine.name).toBe('Fern (Ava, later)');
  });
});

describe('deciding', () => {
  const conflict: Conflict = {
    plantId: 'fern',
    mine: { name: 'Fern (Ava)', light: 'low', wateringIntervalDays: 4 },
    latest: latest({ name: 'Fern (Ben)', light: 'direct' }),
    clashes: ['name', 'light'],
    merged: { name: 'Fern (Ben)', light: 'direct', wateringIntervalDays: 4 },
  };

  test('each clashing field takes the chosen side', () => {
    expect(fieldsAfterChoices(conflict, { name: 'mine', light: 'latest' })).toEqual({
      name: 'Fern (Ava)',
      light: 'direct',
      wateringIntervalDays: 4,
    });
  });

  test('a decision closes the conflict and queues it on top of the latest version', () => {
    const fields = fieldsAfterChoices(conflict, { name: 'mine', light: 'mine' });
    const result = decideConflict({ ...empty, conflicts: [conflict] }, 'fern', fields);
    expect(result.conflicts).toEqual([]);
    expect(result.outbox).toEqual([
      {
        kind: 'update',
        plantId: 'fern',
        baseVersion: 2,
        baseFields: { ...base, name: 'Fern (Ben)', light: 'direct' },
        fields,
      },
    ]);
  });

  test('taking everything latest sends nothing', () => {
    const fields = fieldsAfterChoices(conflict, { name: 'latest', light: 'latest' });
    expect(decideConflict({ ...empty, conflicts: [conflict] }, 'fern', fields).outbox).toEqual([]);
  });

  test('deciding a conflict that does not exist fails loudly', () => {
    expect(() => decideConflict(empty, 'fern', base)).toThrow(/no open conflict/);
  });
});
