import { beforeEach, describe, expect, test } from 'vitest';
import type { Plant, PlantFields } from '../../shared/plant.ts';
import { createLocalStore, type KeyValue, type LocalStore } from './local-store.ts';
import type { Change } from './outbox.ts';
import { syncOnce, type FetchResult, type SendResult, type Transport } from './sync.ts';

function memoryKeyValue(): KeyValue {
  const data = new Map<string, unknown>();
  return {
    read: (key) => Promise.resolve(structuredClone(data.get(key))),
    writeAll: (entries) => {
      for (const [key, value] of Object.entries(entries)) data.set(key, structuredClone(value));
      return Promise.resolve();
    },
  };
}

const fields = (name: string): PlantFields => ({
  name,
  light: 'medium',
  wateringIntervalDays: 4,
});
const plant = (id: string, name: string, version: number): Plant => ({
  id,
  ...fields(name),
  version,
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'ben',
});

/** A fake server: answers each send with the next queued answer, and records what it got. */
function fakeTransport(
  answers: SendResult[],
  fetched: FetchResult = { status: 'fetched', plants: [] },
) {
  const sent: Change[] = [];
  const transport: Transport = {
    send: (change) => {
      sent.push(change);
      const answer = answers.shift();
      if (!answer) throw new Error('The fake server got more changes than the test expected.');
      return Promise.resolve(answer);
    },
    fetchPlants: () => Promise.resolve(fetched),
  };
  return { transport, sent };
}

const basil: Change = { kind: 'create', plantId: 'basil', fields: fields('Basil') };
const fernEdit: Change = {
  kind: 'update',
  plantId: 'fern',
  baseVersion: 1,
  fields: fields('Big fern'),
};

let store: LocalStore;
beforeEach(() => {
  store = createLocalStore(memoryKeyValue());
});

describe('syncOnce', () => {
  test('sends waiting changes oldest first, then refreshes the server copy', async () => {
    await store.enqueue(basil);
    await store.enqueue(fernEdit);
    const fresh = [plant('basil', 'Basil', 1), plant('fern', 'Big fern', 2)];
    const { transport, sent } = fakeTransport(
      [
        { status: 'sent', plant: plant('basil', 'Basil', 1) },
        { status: 'sent', plant: plant('fern', 'Big fern', 2) },
      ],
      { status: 'fetched', plants: fresh },
    );

    expect(await syncOnce(store, transport)).toBe('synced');
    expect(sent.map((change) => change.plantId)).toEqual(['basil', 'fern']);
    expect(await store.load()).toEqual({ plants: fresh, outbox: [], conflicts: [] });
  });

  test('offline: stops and keeps every change for the next round', async () => {
    await store.enqueue(basil);
    await store.enqueue(fernEdit);
    const { transport } = fakeTransport([{ status: 'offline' }]);

    expect(await syncOnce(store, transport)).toBe('offline');
    expect((await store.load()).outbox).toEqual([basil, fernEdit]);
  });

  test('conflict: the change moves to the conflicts with the latest plant, nothing is lost', async () => {
    await store.enqueue(fernEdit);
    const latest = plant('fern', 'Ben renamed it', 2);
    const { transport } = fakeTransport([{ status: 'conflict', latest }]);

    expect(await syncOnce(store, transport)).toBe('synced');
    const state = await store.load();
    expect(state.outbox).toEqual([]);
    expect(state.conflicts).toEqual([{ change: fernEdit, latest }]);
  });

  test('a conflict does not stop the changes behind it', async () => {
    await store.enqueue(fernEdit);
    await store.enqueue(basil);
    const { transport, sent } = fakeTransport([
      { status: 'conflict', latest: plant('fern', 'Ben', 2) },
      { status: 'sent', plant: plant('basil', 'Basil', 1) },
    ]);

    await syncOnce(store, transport);
    expect(sent.map((change) => change.plantId)).toEqual(['fern', 'basil']);
  });

  test('sign-in expired: stops and keeps the changes', async () => {
    await store.enqueue(basil);
    const { transport } = fakeTransport([{ status: 'unauthorized' }]);

    expect(await syncOnce(store, transport)).toBe('unauthorized');
    expect((await store.load()).outbox).toEqual([basil]);
  });

  test('a newer save made during sending is kept and sent in the same round', async () => {
    await store.enqueue(fernEdit);
    const newer: Change = { ...fernEdit, fields: fields('Even bigger fern') };
    const sent: Change[] = [];
    const transport: Transport = {
      send: async (change) => {
        sent.push(change);
        if (sent.length === 1) await store.enqueue(newer);
        return { status: 'sent', plant: plant('fern', change.fields.name, sent.length + 1) };
      },
      fetchPlants: () => Promise.resolve({ status: 'fetched', plants: [] }),
    };

    await syncOnce(store, transport);
    expect(sent).toEqual([fernEdit, { ...newer, baseVersion: 2 }]);
    expect((await store.load()).outbox).toEqual([]);
  });
});
