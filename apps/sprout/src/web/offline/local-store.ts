import type { Plant, PlantFields } from '../../shared/plant.ts';
import { decideConflict, settleConflict, type Conflict } from './conflicts.ts';
import { afterSent, enqueue, upsertPlant, type Change } from './outbox.ts';

/** Where the browser keeps its data: IndexedDB in the app, a Map in unit tests. */
export interface KeyValue {
  read(key: string): Promise<unknown>;
  /** Writes all entries together: either every one is saved or none is. */
  writeAll(entries: Record<string, unknown>): Promise<void>;
}

export interface LocalState {
  /** The server's plants, as this browser last saw them. */
  plants: Plant[];
  outbox: Change[];
  conflicts: Conflict[];
}

export type LocalStore = ReturnType<typeof createLocalStore>;

export function createLocalStore(keyValue: KeyValue) {
  let lastChange: Promise<unknown> = Promise.resolve();

  async function load(): Promise<LocalState> {
    const [plants, outbox, conflicts] = await Promise.all([
      keyValue.read('plants'),
      keyValue.read('outbox'),
      keyValue.read('conflicts'),
    ]);
    return {
      plants: (plants ?? []) as Plant[],
      outbox: (outbox ?? []) as Change[],
      conflicts: (conflicts ?? []) as Conflict[],
    };
  }

  // A save and a sync can overlap; one read-change-write must finish before the next starts,
  // or one of them would overwrite the other's change.
  function update(next: (state: LocalState) => Partial<LocalState>): Promise<void> {
    const result = lastChange.then(async () => keyValue.writeAll(next(await load())));
    lastChange = result.catch(() => undefined);
    return result;
  }

  return {
    load,

    enqueue: (change: Change) => update((state) => ({ outbox: enqueue(state.outbox, change) })),

    firstWaiting: async (): Promise<Change | undefined> => (await load()).outbox[0],

    markSent: (sent: Change, saved: Plant) =>
      update((state) => ({
        outbox: afterSent(state.outbox, sent, saved),
        plants: upsertPlant(state.plants, saved),
      })),

    /** Combines the edits automatically, or keeps them side by side for the user to decide. */
    settleConflict: (sent: Change, latest: Plant) =>
      update((state) => settleConflict(state, sent, latest)),

    decideConflict: (plantId: string, fields: PlantFields) =>
      update((state) => decideConflict(state, plantId, fields)),

    replacePlants: (plants: Plant[]) => update(() => ({ plants })),
  };
}
