import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PlantFields } from '../../shared/plant.ts';
import type { Session } from '../api.ts';
import { openKeyValue } from './idb.ts';
import { createLocalStore, type LocalState, type LocalStore } from './local-store.ts';
import type { Conflict } from './conflicts.ts';
import { changeFor, shownPlants, type ShownPlant, type StartedFrom } from './outbox.ts';
import { syncOnce } from './sync.ts';
import { apiTransport } from './transport.ts';

const RETRY_EVERY_MS = 10_000;

export type SyncStatus = 'offline' | 'syncing' | 'synced';

export interface SproutData {
  ready: boolean;
  plants: ShownPlant[];
  status: SyncStatus;
  /** How many changes this browser still has to send. */
  waiting: number;
  conflicts: Conflict[];
  /** An unexpected sync failure, shown to the user instead of being hidden. */
  problem: string | undefined;
  /** `startedFrom` is the plant as it was when the user opened the form. */
  save: (
    plantId: string | undefined,
    fields: PlantFields,
    startedFrom?: StartedFrom,
  ) => Promise<void>;
  /** Closes a conflict with the values the user chose. */
  decide: (plantId: string, fields: PlantFields) => Promise<void>;
}

const SproutDataContext = createContext<SproutData | undefined>(undefined);

export function useSproutData(): SproutData {
  const data = useContext(SproutDataContext);
  if (!data) throw new Error('useSproutData must be used inside <SproutDataProvider>.');
  return data;
}

interface ProviderProps {
  session: Session;
  onUnauthorized: () => void;
  children: ReactNode;
}

export function SproutDataProvider({ session, onUnauthorized, children }: ProviderProps) {
  const [store, setStore] = useState<LocalStore>();
  const [state, setState] = useState<LocalState>();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<string>();
  // "Synced" is a promise to the user, so it waits for a round that really reached the server.
  const [hasSynced, setHasSynced] = useState(false);
  const syncing = useRef(false);
  const syncAgain = useRef(false);
  // Read through a function: a save can set the flag while a round awaits the network,
  // which TypeScript's flow analysis cannot see.
  const anotherRoundWanted = () => syncAgain.current;

  const report = useCallback((error: unknown) => {
    console.error(error);
    setProblem(error instanceof Error ? error.message : String(error));
  }, []);

  useEffect(() => {
    let active = true;
    openKeyValue(`sprout-${session.user.id}`)
      .then(async (keyValue) => {
        const opened = createLocalStore(keyValue);
        const loaded = await opened.load();
        if (!active) return;
        setStore(opened);
        setState(loaded);
      })
      .catch(report);
    return () => {
      active = false;
    };
  }, [session.user.id, report]);

  const runSync = useCallback(async () => {
    if (!store) return;
    if (!navigator.onLine) {
      setOnline(false);
      return;
    }
    // A save during a sync round asks for one more round instead of starting a second one.
    if (syncing.current) {
      syncAgain.current = true;
      return;
    }
    syncing.current = true;
    setRunning(true);
    try {
      do {
        syncAgain.current = false;
        const outcome = await syncOnce(store, apiTransport(session.token));
        setState(await store.load());
        if (outcome === 'unauthorized') {
          onUnauthorized();
          return;
        }
        setProblem(undefined);
        setOnline(outcome === 'synced');
        if (outcome === 'synced') setHasSynced(true);
        if (outcome === 'offline') return;
      } while (anotherRoundWanted());
    } catch (error) {
      report(error);
    } finally {
      syncing.current = false;
      setRunning(false);
    }
  }, [store, session.token, onUnauthorized, report]);

  useEffect(() => {
    void runSync();
    const goOnline = () => {
      setOnline(true);
      void runSync();
    };
    const goOffline = () => {
      setOnline(false);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // Retries waiting changes and picks up other people's changes.
    const timer = window.setInterval(() => void runSync(), RETRY_EVERY_MS);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.clearInterval(timer);
    };
  }, [runSync]);

  const save = useCallback(
    async (plantId: string | undefined, fields: PlantFields, startedFrom?: StartedFrom) => {
      if (!store) throw new Error('Sprout data is not loaded yet.');
      const current = await store.load();
      const newId = () => crypto.randomUUID();
      await store.enqueue(
        changeFor(current.plants, current.outbox, plantId, fields, newId, startedFrom),
      );
      setState(await store.load());
      void runSync();
    },
    [store, runSync],
  );

  const decide = useCallback(
    async (plantId: string, fields: PlantFields) => {
      if (!store) throw new Error('Sprout data is not loaded yet.');
      await store.decideConflict(plantId, fields);
      setState(await store.load());
      void runSync();
    },
    [store, runSync],
  );

  const value = useMemo((): SproutData => {
    const waiting = state?.outbox.length ?? 0;
    const status: SyncStatus = !online
      ? 'offline'
      : running || waiting > 0 || !hasSynced
        ? 'syncing'
        : 'synced';
    // On a first visit the browser copy is empty until the first sync; that is not "no plants".
    const firstVisitLoading = state?.plants.length === 0 && !hasSynced && online;
    return {
      ready: state !== undefined && !firstVisitLoading,
      plants: state ? shownPlants(state.plants, state.outbox) : [],
      status,
      waiting,
      conflicts: state?.conflicts ?? [],
      problem,
      save,
      decide,
    };
  }, [state, online, running, problem, hasSynced, save, decide]);

  return <SproutDataContext.Provider value={value}>{children}</SproutDataContext.Provider>;
}
