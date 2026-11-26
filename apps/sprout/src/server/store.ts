import type { Editor, Plant, PlantFields } from '../shared/plant.ts';
import { addDays, dayOf, daysBetween } from '../shared/watering.ts';
import { readJsonFile, writeJsonFileAtomic } from './json-file.ts';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

export interface SproutData {
  users: User[];
  plants: Plant[];
}

export type UpdateResult =
  | { status: 'updated'; plant: Plant }
  | { status: 'conflict'; latest: Plant }
  | { status: 'not-found' };

export type Store = ReturnType<typeof createStore>;

/**
 * The day the seed data is written for. Its waterings are dated around this day and moved to the
 * real today when the seed is loaded, so a fresh demo always shows a mix of due, overdue and
 * upcoming plants instead of growing more overdue every month.
 */
export const SEED_DAY = '2026-01-01';

/** The made-up seed data, with its waterings moved from SEED_DAY to `today`. */
export async function readSeed(seedFile: string, today = dayOf(new Date())): Promise<SproutData> {
  const seed = await readSproutData(seedFile);
  const shift = daysBetween(SEED_DAY, today);
  return {
    ...seed,
    plants: seed.plants.map((plant) => ({
      ...plant,
      lastWateredOn: addDays(plant.lastWateredOn, shift),
    })),
  };
}

/** Writes the made-up seed data to the data file; used on a first run and by npm run demo:reset. */
export async function copySeed(seedFile: string, dataFile: string): Promise<void> {
  await writeJsonFileAtomic(dataFile, await readSeed(seedFile));
}

function isSproutData(value: unknown): value is SproutData {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as SproutData).users) &&
    Array.isArray((value as SproutData).plants)
  );
}

/**
 * Data files written before watering reminders have no lastWateredOn. Such a plant counts as
 * watered on the day it was last saved, so old data keeps working without a reset.
 */
function withLastWatered(plant: Plant): Plant {
  return (plant as Partial<Plant>).lastWateredOn === undefined
    ? { ...plant, lastWateredOn: plant.updatedAt.slice(0, 10) }
    : plant;
}

/** Reads a data or seed file and checks its shape, so a broken file fails with a clear message. */
export async function readSproutData(path: string): Promise<SproutData> {
  const data = await readJsonFile(path);
  if (!isSproutData(data)) {
    throw new Error(`Sprout data file ${path} has the wrong shape. Run npm run demo:reset.`);
  }
  return { ...data, plants: data.plants.map(withLastWatered) };
}

/**
 * Keeps all Sprout data in one JSON file. The file is read on every call, so
 * `npm run demo:reset` takes effect even while the server is running.
 */
export function createStore(filePath: string, now: () => string = () => new Date().toISOString()) {
  let lastWrite: Promise<unknown> = Promise.resolve();

  // Changes run one after another; two edits arriving together must not both
  // read version 3 and both write version 4.
  function oneAtATime<T>(change: () => Promise<T>): Promise<T> {
    const result = lastWrite.then(change);
    lastWrite = result.catch(() => undefined);
    return result;
  }

  const load = () => readSproutData(filePath);

  return {
    async findUserByEmail(email: string): Promise<User | undefined> {
      const { users } = await load();
      return users.find((user) => user.email.toLowerCase() === email.trim().toLowerCase());
    },

    async listPlants(): Promise<Plant[]> {
      const { plants } = await load();
      return [...plants].sort((a, b) => a.name.localeCompare(b.name));
    },

    /** Creating the same id twice returns the first plant: a retried request makes no duplicate. */
    createPlant(id: string, fields: PlantFields, editor: Editor): Promise<Plant> {
      return oneAtATime(async () => {
        const data = await load();
        const existing = data.plants.find((plant) => plant.id === id);
        if (existing) return existing;
        const plant: Plant = {
          id,
          ...fields,
          version: 1,
          updatedAt: now(),
          updatedBy: editor.id,
          updatedByName: editor.name,
        };
        await writeJsonFileAtomic(filePath, { ...data, plants: [...data.plants, plant] });
        return plant;
      });
    },

    /** Saves only if nobody else saved since `baseVersion`; otherwise reports a conflict. */
    updatePlant(
      id: string,
      baseVersion: number,
      fields: PlantFields,
      editor: Editor,
    ): Promise<UpdateResult> {
      return oneAtATime(async () => {
        const data = await load();
        const current = data.plants.find((plant) => plant.id === id);
        if (!current) return { status: 'not-found' };
        if (current.version !== baseVersion) return { status: 'conflict', latest: current };
        const plant: Plant = {
          ...current,
          ...fields,
          version: current.version + 1,
          updatedAt: now(),
          updatedBy: editor.id,
          updatedByName: editor.name,
        };
        const plants = data.plants.map((p) => (p.id === id ? plant : p));
        await writeJsonFileAtomic(filePath, { ...data, plants });
        return { status: 'updated', plant };
      });
    },

    /** Deleting a plant that is already gone is fine: a retried request does no harm. */
    deletePlant(id: string): Promise<void> {
      return oneAtATime(async () => {
        const data = await load();
        const plants = data.plants.filter((plant) => plant.id !== id);
        if (plants.length !== data.plants.length) {
          await writeJsonFileAtomic(filePath, { ...data, plants });
        }
      });
    },

    replaceAll(data: SproutData): Promise<void> {
      return oneAtATime(() => writeJsonFileAtomic(filePath, data));
    },
  };
}
