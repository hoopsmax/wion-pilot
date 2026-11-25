import { fieldsOf, sameFields, type Plant, type PlantFields } from '../../shared/plant.ts';
import { mergeFields, type FieldName } from './merge.ts';
import { enqueue, upsertPlant, withoutPlant, type Change } from './outbox.ts';

/** An edit that clashes with someone else's: kept here, next to theirs, until the user decides. */
export interface Conflict {
  plantId: string;
  /** Everything the user saved. */
  mine: PlantFields;
  latest: Plant;
  /** The only fields to ask about. */
  clashes: FieldName[];
  /** All other fields, already combined; clashing fields hold the latest value. */
  merged: PlantFields;
}

export type Choice = 'mine' | 'latest';

interface Lists {
  plants: Plant[];
  outbox: Change[];
  conflicts: Conflict[];
}

function editOnTopOf(latest: Plant, fields: PlantFields): Change {
  return {
    kind: 'update',
    plantId: latest.id,
    baseVersion: latest.version,
    baseFields: fieldsOf(latest),
    fields,
  };
}

/** Queues `fields` on top of the latest version, unless they already are the latest. */
function queueUnlessSame(outbox: Change[], latest: Plant, fields: PlantFields): Change[] {
  return sameFields(fields, fieldsOf(latest))
    ? outbox
    : enqueue(outbox, editOnTopOf(latest, fields));
}

/**
 * The server refused `sent` because someone else saved first. Without clashing fields the
 * combined edit is queued again at once; with them, the edit waits for the user's decision.
 */
export function settleConflict(state: Lists, sent: Change, latest: Plant): Lists {
  const mine = state.outbox.find((change) => change.plantId === sent.plantId) ?? sent;
  if (mine.kind === 'create') {
    throw new Error(`A new plant cannot be in conflict (plant ${sent.plantId}).`);
  }
  const outbox = withoutPlant(state.outbox, sent.plantId);
  const plants = upsertPlant(state.plants, latest);
  const conflicts = state.conflicts.filter((conflict) => conflict.plantId !== sent.plantId);
  const { merged, clashes } = mergeFields(mine.baseFields, mine.fields, fieldsOf(latest));

  if (clashes.length === 0)
    return { plants, conflicts, outbox: queueUnlessSame(outbox, latest, merged) };
  return {
    plants,
    outbox,
    conflicts: [
      ...conflicts,
      { plantId: sent.plantId, mine: mine.fields, latest, clashes, merged },
    ],
  };
}

/** The plant the user ends up with after choosing, per clashing field, their value or the latest. */
export function fieldsAfterChoices(
  conflict: Conflict,
  choices: Partial<Record<FieldName, Choice>>,
): PlantFields {
  function pick<K extends FieldName>(field: K): PlantFields[K] {
    return choices[field] === 'mine' ? conflict.mine[field] : conflict.merged[field];
  }
  return {
    name: pick('name'),
    light: pick('light'),
    wateringIntervalDays: pick('wateringIntervalDays'),
  };
}

/** Closes a conflict with the user's decision and queues it on top of the latest version. */
export function decideConflict(state: Lists, plantId: string, fields: PlantFields): Lists {
  const conflict = state.conflicts.find((open) => open.plantId === plantId);
  if (!conflict) throw new Error(`There is no open conflict for plant ${plantId}.`);
  return {
    plants: state.plants,
    conflicts: state.conflicts.filter((open) => open.plantId !== plantId),
    outbox: queueUnlessSame(withoutPlant(state.outbox, plantId), conflict.latest, fields),
  };
}
