import { fieldsOf, sameFields, type Plant, type PlantFields } from '../../shared/plant.ts';

/** A change the user made that the server does not know about yet. */
export type Change =
  | { kind: 'create'; plantId: string; fields: PlantFields }
  | {
      kind: 'update';
      plantId: string;
      baseVersion: number;
      /** The fields at baseVersion: with them a conflict can tell who changed which field. */
      baseFields: PlantFields;
      fields: PlantFields;
    };

/** A change the server refused because someone else saved the plant first. */
export interface Conflict {
  change: Change;
  latest: Plant;
}

/** A plant as the user sees it: the server copy with their waiting changes applied. */
export interface ShownPlant extends PlantFields {
  id: string;
  synced: boolean;
}

/**
 * The change to queue when the user saves a plant. A plant the server knows is edited from the
 * version this browser last saw; one that only exists in the outbox is still a create.
 */
export function changeFor(
  serverPlants: readonly Plant[],
  outbox: readonly Change[],
  plantId: string | undefined,
  fields: PlantFields,
  newId: () => string,
): Change {
  if (plantId === undefined) return { kind: 'create', plantId: newId(), fields };
  const known = serverPlants.find((plant) => plant.id === plantId);
  if (known) {
    return {
      kind: 'update',
      plantId,
      baseVersion: known.version,
      baseFields: fieldsOf(known),
      fields,
    };
  }
  if (outbox.some((change) => change.plantId === plantId && change.kind === 'create')) {
    return { kind: 'create', plantId, fields };
  }
  throw new Error(`Cannot save plant ${plantId}: it is neither on the server nor waiting to be.`);
}

/**
 * Adds a change to the outbox. Several saves of one plant become one change, so the server gets
 * the final state once. An edit keeps the version it first started from: if someone else saved
 * in between, that is still a conflict.
 */
export function enqueue(outbox: readonly Change[], change: Change): Change[] {
  const index = outbox.findIndex((waiting) => waiting.plantId === change.plantId);
  const waiting = outbox[index];
  if (waiting === undefined) return [...outbox, change];
  const merged: Change = { ...waiting, fields: change.fields };
  return outbox.map((existing, i) => (i === index ? merged : existing));
}

/**
 * Updates the outbox after `sent` reached the server. If the user saved the plant again while
 * the request was on its way, that newer change stays, now based on the server's new version.
 */
export function afterSent(outbox: readonly Change[], sent: Change, saved: Plant): Change[] {
  return outbox.flatMap((change): Change[] => {
    if (change.plantId !== sent.plantId) return [change];
    if (sameFields(change.fields, sent.fields)) return [];
    return [
      {
        kind: 'update',
        plantId: change.plantId,
        baseVersion: saved.version,
        baseFields: fieldsOf(saved),
        fields: change.fields,
      },
    ];
  });
}

export function withoutPlant(outbox: readonly Change[], plantId: string): Change[] {
  return outbox.filter((change) => change.plantId !== plantId);
}

export function upsertPlant(plants: readonly Plant[], plant: Plant): Plant[] {
  return plants.some((p) => p.id === plant.id)
    ? plants.map((p) => (p.id === plant.id ? plant : p))
    : [...plants, plant];
}

export function shownPlants(
  serverPlants: readonly Plant[],
  outbox: readonly Change[],
): ShownPlant[] {
  const shown = new Map<string, ShownPlant>(
    serverPlants.map((plant) => [plant.id, { id: plant.id, ...fieldsOf(plant), synced: true }]),
  );
  for (const change of outbox) {
    shown.set(change.plantId, { id: change.plantId, ...change.fields, synced: false });
  }
  return [...shown.values()].sort((a, b) => a.name.localeCompare(b.name));
}
