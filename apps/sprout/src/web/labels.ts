import type { LightLevel } from '../shared/plant.ts';

export const LIGHT_LABELS: Record<LightLevel, string> = {
  low: 'Low light',
  medium: 'Medium light',
  'bright-indirect': 'Bright, indirect light',
  direct: 'Direct sun',
};

export function everyDays(days: number): string {
  return days === 1 ? 'Water every day' : `Water every ${String(days)} days`;
}
