import type { LightLevel, PlantFields } from '../shared/plant.ts';

export const LIGHT_LABELS: Record<LightLevel, string> = {
  low: 'Low light',
  medium: 'Medium light',
  'bright-indirect': 'Bright, indirect light',
  direct: 'Direct sun',
};

export function everyDays(days: number): string {
  return days === 1 ? 'Water every day' : `Water every ${String(days)} days`;
}

export const FIELD_LABELS: Record<keyof PlantFields, string> = {
  name: 'Name',
  light: 'Light',
  wateringIntervalDays: 'Watering interval',
};

/** A field's value as a person reads it, for example "Direct sun" or "7 days". */
export function shownValue<K extends keyof PlantFields>(field: K, value: PlantFields[K]): string {
  if (field === 'light') return LIGHT_LABELS[value as LightLevel];
  if (field === 'wateringIntervalDays') return value === 1 ? '1 day' : `${String(value)} days`;
  return String(value);
}
