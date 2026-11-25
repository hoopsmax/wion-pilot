import { describe, expect, test } from 'vitest';
import type { Plant, PlantFields } from '../../shared/plant.ts';
import { afterSent, changeFor, enqueue, shownPlants, type Change } from './outbox.ts';

const fields = (name: string, days = 4): PlantFields => ({
  name,
  light: 'medium',
  wateringIntervalDays: days,
});

const fern: Plant = {
  id: 'fern',
  ...fields('Window fern'),
  version: 3,
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'ava',
  updatedByName: 'Ava',
};

const newId = () => 'new-id';

describe('changeFor', () => {
  test('a new plant becomes a create with a fresh id', () => {
    expect(changeFor([], [], undefined, fields('Basil'), newId)).toEqual({
      kind: 'create',
      plantId: 'new-id',
      fields: fields('Basil'),
    });
  });

  test('editing a server plant starts from the version this browser has', () => {
    expect(changeFor([fern], [], 'fern', fields('Big fern'), newId)).toEqual({
      kind: 'update',
      plantId: 'fern',
      baseVersion: 3,
      baseFields: fields('Window fern'),
      fields: fields('Big fern'),
    });
  });

  test('an edit starts from the version shown when the form opened, not a newer refresh', () => {
    const refreshed = { ...fern, ...fields('Ben renamed it'), version: 4 };
    const startedFrom = { version: 3, fields: fields('Window fern') };
    expect(
      changeFor([refreshed], [], 'fern', fields('Big fern'), newId, startedFrom),
    ).toMatchObject({
      baseVersion: 3,
      baseFields: fields('Window fern'),
    });
  });

  test('editing a plant that was only created offline stays a create', () => {
    const outbox: Change[] = [{ kind: 'create', plantId: 'basil', fields: fields('Basil') }];
    expect(changeFor([], outbox, 'basil', fields('Thai basil'), newId).kind).toBe('create');
  });

  test('an unknown plant fails loudly', () => {
    expect(() => changeFor([], [], 'ghost', fields('x'), newId)).toThrow(/ghost/);
  });
});

describe('enqueue', () => {
  test('two edits of one plant become one change that keeps the first base version', () => {
    const first: Change = {
      kind: 'update',
      plantId: 'fern',
      baseVersion: 3,
      baseFields: fields('Window fern'),
      fields: fields('A'),
    };
    const second: Change = {
      kind: 'update',
      plantId: 'fern',
      baseVersion: 4,
      baseFields: fields('Window fern'),
      fields: fields('B'),
    };
    expect(enqueue(enqueue([], first), second)).toEqual([{ ...first, fields: fields('B') }]);
  });

  test('an edit of an offline-created plant is merged into the create', () => {
    const create: Change = { kind: 'create', plantId: 'basil', fields: fields('Basil') };
    const edit: Change = { kind: 'create', plantId: 'basil', fields: fields('Basil', 2) };
    expect(enqueue([create], edit)).toEqual([{ ...create, fields: fields('Basil', 2) }]);
  });

  test('changes to different plants keep their order', () => {
    const a: Change = { kind: 'create', plantId: 'a', fields: fields('A') };
    const b: Change = { kind: 'create', plantId: 'b', fields: fields('B') };
    expect(enqueue([a], b)).toEqual([a, b]);
  });
});

describe('afterSent', () => {
  const sent: Change = {
    kind: 'update',
    plantId: 'fern',
    baseVersion: 3,
    baseFields: fields('Window fern'),
    fields: fields('A'),
  };
  const saved: Plant = { ...fern, ...fields('A'), version: 4 };

  test('removes the change that was sent', () => {
    expect(afterSent([sent], sent, saved)).toEqual([]);
  });

  test('keeps a newer save made while sending, now based on the new version', () => {
    const newer: Change = { ...sent, fields: fields('B') };
    expect(afterSent([newer], sent, saved)).toEqual([
      {
        kind: 'update',
        plantId: 'fern',
        baseVersion: 4,
        baseFields: fields('A'),
        fields: fields('B'),
      },
    ]);
  });
});

describe('shownPlants', () => {
  const fernOnServer = { version: 3, fields: fields('Window fern') };

  test('shows waiting changes on top of the server copy, marked as not synced', () => {
    const outbox: Change[] = [
      {
        kind: 'update',
        plantId: 'fern',
        baseVersion: 3,
        baseFields: fields('Window fern'),
        fields: fields('Big fern'),
      },
      { kind: 'create', plantId: 'basil', fields: fields('Basil') },
    ];
    expect(shownPlants([fern], outbox)).toEqual([
      { id: 'basil', ...fields('Basil'), synced: false, server: undefined },
      { id: 'fern', ...fields('Big fern'), synced: false, server: fernOnServer },
    ]);
  });

  test('a plant without waiting changes is synced', () => {
    expect(shownPlants([fern], [])).toEqual([
      { id: 'fern', ...fields('Window fern'), synced: true, server: fernOnServer },
    ]);
  });
});
