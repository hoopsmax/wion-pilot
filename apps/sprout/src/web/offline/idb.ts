import type { KeyValue } from './local-store.ts';

const STORE = 'state';

function failure(error: Error | null, what: string): Error {
  return error ?? new Error(`IndexedDB failed to ${what}.`);
}

function keyValueOver(db: IDBDatabase): KeyValue {
  return {
    read: (key) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(STORE).objectStore(STORE).get(key);
        request.onsuccess = () => {
          resolve(request.result as unknown);
        };
        request.onerror = () => {
          reject(failure(request.error, `read "${key}"`));
        };
      }),
    writeAll: (entries) =>
      new Promise((resolve, reject) => {
        // One transaction: IndexedDB saves all entries together or none of them.
        const transaction = db.transaction(STORE, 'readwrite');
        const store = transaction.objectStore(STORE);
        for (const [key, value] of Object.entries(entries)) store.put(value, key);
        transaction.oncomplete = () => {
          resolve();
        };
        transaction.onerror = () => {
          reject(failure(transaction.error, 'save'));
        };
        transaction.onabort = () => {
          reject(failure(transaction.error, 'save (aborted)'));
        };
      }),
  };
}

/** Opens (or creates) a browser database. Each user gets their own, so data never mixes. */
export function openKeyValue(name: string): Promise<KeyValue> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      resolve(keyValueOver(request.result));
    };
    request.onerror = () => {
      reject(failure(request.error, `open "${name}"`));
    };
  });
}
