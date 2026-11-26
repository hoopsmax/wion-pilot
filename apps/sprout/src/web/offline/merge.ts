import type { PlantFields } from '../../shared/plant.ts';

export type FieldName = keyof PlantFields;

export interface MergeResult {
  /** The combined plant. A clashing field holds the latest value until the user decides. */
  merged: PlantFields;
  /** Fields both people changed to different values: only these need a decision. */
  clashes: FieldName[];
}

/** Watering is a fact, not an opinion: the later of two waterings is simply true. */
function laterDay(a: string, b: string): string {
  return a > b ? a : b;
}

/**
 * Combines my edit with someone else's, field by field:
 * - I did not change a field: take theirs.
 * - I changed it and they did not: keep mine.
 * - We both changed it to the same value: take it.
 * - We both changed it to different values: a clash for the user to decide.
 */
export function mergeFields(
  base: PlantFields,
  mine: PlantFields,
  theirs: PlantFields,
): MergeResult {
  const clashes: FieldName[] = [];

  function decide<K extends FieldName>(field: K): PlantFields[K] {
    const iChanged = mine[field] !== base[field];
    const theyChanged = theirs[field] !== base[field];
    if (!iChanged) return theirs[field];
    if (!theyChanged || mine[field] === theirs[field]) return mine[field];
    clashes.push(field);
    return theirs[field];
  }

  const merged: PlantFields = {
    name: decide('name'),
    light: decide('light'),
    wateringIntervalDays: decide('wateringIntervalDays'),
    // Never a question for the user: if both watered, the later day wins.
    lastWateredOn:
      mine.lastWateredOn === base.lastWateredOn
        ? theirs.lastWateredOn
        : laterDay(mine.lastWateredOn, theirs.lastWateredOn),
  };
  return { merged, clashes };
}
