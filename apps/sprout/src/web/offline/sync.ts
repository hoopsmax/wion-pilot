import type { Plant } from '../../shared/plant.ts';
import type { LocalStore } from './local-store.ts';
import type { Change } from './outbox.ts';

export type SendResult =
  | { status: 'sent'; plant: Plant }
  | { status: 'conflict'; latest: Plant }
  | { status: 'offline' }
  | { status: 'unauthorized' };

export type FetchResult =
  { status: 'fetched'; plants: Plant[] } | { status: 'offline' } | { status: 'unauthorized' };

/** How sync talks to the server; the unit tests pass a fake. */
export interface Transport {
  send(change: Change): Promise<SendResult>;
  fetchPlants(): Promise<FetchResult>;
}

export type SyncOutcome = 'synced' | 'offline' | 'unauthorized';

/**
 * One sync round: sends waiting changes oldest first, then refreshes the server copy. It stops
 * at the first network problem and leaves the rest in the outbox for the next round.
 */
export async function syncOnce(store: LocalStore, transport: Transport): Promise<SyncOutcome> {
  for (let change = await store.firstWaiting(); change; change = await store.firstWaiting()) {
    const result = await transport.send(change);
    if (result.status === 'offline' || result.status === 'unauthorized') return result.status;
    if (result.status === 'sent') await store.markSent(change, result.plant);
    else await store.moveToConflicts(change, result.latest);
  }

  const fetched = await transport.fetchPlants();
  if (fetched.status !== 'fetched') return fetched.status;
  await store.replacePlants(fetched.plants);
  return 'synced';
}
