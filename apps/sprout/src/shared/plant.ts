export const LIGHT_LEVELS = ['low', 'medium', 'bright-indirect', 'direct'] as const;
export type LightLevel = (typeof LIGHT_LEVELS)[number];

export const NAME_MAX_LENGTH = 60;
export const INTERVAL_MIN_DAYS = 1;
export const INTERVAL_MAX_DAYS = 60;

/** The fields a person edits in the plant form. */
export interface PlantFields {
  name: string;
  light: LightLevel;
  wateringIntervalDays: number;
}

export interface Plant extends PlantFields {
  id: string;
  /** Goes up by one on every saved edit; an edit based on an older version is a conflict. */
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export type FieldErrors = Partial<Record<keyof PlantFields, string>>;

export type Validation = { ok: true; fields: PlantFields } | { ok: false; errors: FieldErrors };

function isLightLevel(value: unknown): value is LightLevel {
  return LIGHT_LEVELS.some((level) => level === value);
}

function nameError(name: unknown): string | undefined {
  if (typeof name !== 'string' || name.trim() === '') return 'Name is required.';
  if (name.trim().length > NAME_MAX_LENGTH) {
    return `Name must be at most ${String(NAME_MAX_LENGTH)} characters.`;
  }
  return undefined;
}

function intervalError(interval: unknown): string | undefined {
  const inRange =
    typeof interval === 'number' &&
    Number.isInteger(interval) &&
    interval >= INTERVAL_MIN_DAYS &&
    interval <= INTERVAL_MAX_DAYS;
  return inRange
    ? undefined
    : `Watering interval must be a whole number from ${String(INTERVAL_MIN_DAYS)} to ${String(INTERVAL_MAX_DAYS)} days.`;
}

/**
 * Checks untrusted input (a form or a request body). The server and the
 * browser both use this, so they always agree on what is valid.
 */
export function validatePlantFields(input: Record<string, unknown>): Validation {
  const { name, light, wateringIntervalDays } = input;
  const errors: FieldErrors = {};

  const nameProblem = nameError(name);
  if (nameProblem) errors.name = nameProblem;
  if (!isLightLevel(light)) errors.light = 'Choose a light level from the list.';
  const intervalProblem = intervalError(wateringIntervalDays);
  if (intervalProblem) errors.wateringIntervalDays = intervalProblem;

  if (Object.keys(errors).length > 0 || typeof name !== 'string' || !isLightLevel(light)) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    fields: { name: name.trim(), light, wateringIntervalDays: wateringIntervalDays as number },
  };
}
