import { api, ApiError } from '../api.ts';
import type { Transport } from './sync.ts';

/**
 * Network problems and an expired sign-in are normal while syncing and become a status.
 * Anything else (a server error, a bug) is thrown, so it is shown instead of hidden.
 */
function expectedFailure(problem: unknown): { status: 'offline' } | { status: 'unauthorized' } {
  if (problem instanceof ApiError && problem.status === 401) return { status: 'unauthorized' };
  // fetch() rejects with a TypeError when there is no connection at all.
  if (problem instanceof TypeError) return { status: 'offline' };
  throw problem;
}

export function apiTransport(token: string): Transport {
  return {
    async send(change) {
      try {
        const plant =
          change.kind === 'create'
            ? await api.createPlant(token, change.plantId, change.fields)
            : await api.updatePlant(token, change.plantId, change.baseVersion, change.fields);
        return { status: 'sent', plant };
      } catch (problem) {
        if (problem instanceof ApiError && problem.status === 409 && problem.latest) {
          return { status: 'conflict', latest: problem.latest };
        }
        return expectedFailure(problem);
      }
    },
    async fetchPlants() {
      try {
        return { status: 'fetched', plants: await api.listPlants(token) };
      } catch (problem) {
        return expectedFailure(problem);
      }
    },
  };
}
