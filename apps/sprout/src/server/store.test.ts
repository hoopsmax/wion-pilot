import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { PlantFields } from '../shared/plant.ts';
import { createStore, readSeed, SEED_DAY, type Store } from './store.ts';

const fern: PlantFields = {
  name: 'Window fern',
  light: 'medium',
  wateringIntervalDays: 7,
  lastWateredOn: '2026-06-10',
};
const plantId = '11111111-1111-4111-8111-111111111111';
const ava = { id: 'ava', name: 'Ava' };
const ben = { id: 'ben', name: 'Ben' };

let folder: string;
let file: string;
let store: Store;

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'sprout-store-'));
  file = join(folder, 'db.json');
  await writeFile(file, JSON.stringify({ users: [], plants: [] }));
  store = createStore(file, () => '2026-01-01T00:00:00.000Z');
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe('createPlant', () => {
  test('starts a new plant at version 1', async () => {
    const plant = await store.createPlant(plantId, fern, ava);
    expect(plant).toMatchObject({
      id: plantId,
      ...fern,
      version: 1,
      updatedBy: 'ava',
      updatedByName: 'Ava',
    });
    expect(await store.listPlants()).toEqual([plant]);
  });

  test('creating the same id twice keeps one plant', async () => {
    const first = await store.createPlant(plantId, fern, ava);
    const second = await store.createPlant(plantId, { ...fern, name: 'Other' }, ava);
    expect(second).toEqual(first);
    expect(await store.listPlants()).toHaveLength(1);
  });
});

describe('updatePlant', () => {
  beforeEach(async () => {
    await store.createPlant(plantId, fern, ava);
  });

  test('saves an edit based on the current version and raises the version', async () => {
    const result = await store.updatePlant(plantId, 1, { ...fern, name: 'Big fern' }, ben);
    expect(result).toMatchObject({
      status: 'updated',
      plant: { name: 'Big fern', version: 2, updatedBy: 'ben' },
    });
  });

  test('reports a conflict when the edit is based on an old version', async () => {
    await store.updatePlant(plantId, 1, { ...fern, name: 'Ava was here' }, ava);
    const result = await store.updatePlant(plantId, 1, { ...fern, name: 'Ben was here' }, ben);
    expect(result).toMatchObject({
      status: 'conflict',
      latest: { name: 'Ava was here', version: 2 },
    });
    expect((await store.listPlants())[0]?.name).toBe('Ava was here');
  });

  test('two edits sent at the same moment: one wins, the other is a conflict', async () => {
    const results = await Promise.all([
      store.updatePlant(plantId, 1, { ...fern, name: 'First' }, ava),
      store.updatePlant(plantId, 1, { ...fern, name: 'Second' }, ben),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['conflict', 'updated']);
  });

  test('reports a missing plant', async () => {
    const otherId = '22222222-2222-4222-8222-222222222222';
    expect(await store.updatePlant(otherId, 1, fern, ava)).toEqual({ status: 'not-found' });
  });
});

describe('deletePlant', () => {
  test('removes the plant, and deleting it again does no harm', async () => {
    await store.createPlant(plantId, fern, ava);
    await store.deletePlant(plantId);
    await store.deletePlant(plantId);
    expect(await store.listPlants()).toEqual([]);
  });
});

describe('a broken data file', () => {
  test('fails with a message that says how to fix it', async () => {
    await writeFile(file, '{ not json');
    await expect(store.listPlants()).rejects.toThrow(/npm run demo:reset/);
  });
});

describe('watering dates', () => {
  test('a plant saved before reminders existed counts as watered on its last save', async () => {
    const oldPlant = {
      id: plantId,
      name: fern.name,
      light: fern.light,
      wateringIntervalDays: fern.wateringIntervalDays,
      version: 3,
      updatedAt: '2026-05-20T18:30:00.000Z',
    };
    await writeFile(file, JSON.stringify({ users: [], plants: [oldPlant] }));
    const [plant] = await store.listPlants();
    expect(plant?.lastWateredOn).toBe('2026-05-20');
  });

  test('seed waterings move from the seed day to today, keeping their distance', async () => {
    const seed = { users: [], plants: [{ id: plantId, ...fern, lastWateredOn: '2025-12-30' }] };
    await writeFile(file, JSON.stringify(seed));
    expect(SEED_DAY).toBe('2026-01-01');
    const { plants } = await readSeed(file, '2026-06-15');
    expect(plants[0]?.lastWateredOn).toBe('2026-06-13');
  });
});
