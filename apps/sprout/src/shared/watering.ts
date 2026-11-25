/**
 * Watering reminders work with calendar days ("2026-06-15"), not timestamps: "water today" means
 * the person's own today, whatever the hour or time zone.
 */

const DAY_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Milliseconds at midnight UTC of a day; UTC so that summer time never makes a day 23 hours. */
function utcMs(day: string): number {
  const match = DAY_FORMAT.exec(day);
  if (!match) throw new Error(`"${day}" is not a day in the form YYYY-MM-DD.`);
  const [, year, month, date] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(date));
}

/** A real calendar day in the form YYYY-MM-DD (so "2026-02-30" is not one). */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_FORMAT.test(value)) return false;
  return new Date(utcMs(value)).toISOString().slice(0, 10) === value;
}

/** The local calendar day of a moment, as the person sees it on their device. */
export function dayOf(moment: Date): string {
  const month = String(moment.getMonth() + 1).padStart(2, '0');
  const date = String(moment.getDate()).padStart(2, '0');
  return `${String(moment.getFullYear())}-${month}-${date}`;
}

export function addDays(day: string, days: number): string {
  return new Date(utcMs(day) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMs(to) - utcMs(from)) / MS_PER_DAY);
}

/** Days until the next watering: 0 is today, negative is overdue. */
export function daysUntilWatering(
  lastWateredOn: string,
  intervalDays: number,
  today: string,
): number {
  return daysBetween(today, addDays(lastWateredOn, intervalDays));
}

export function reminderText(daysLeft: number): string {
  if (daysLeft === 0) return 'Water today';
  if (daysLeft === 1) return 'Water tomorrow';
  if (daysLeft > 1) return `Water in ${String(daysLeft)} days`;
  return daysLeft === -1 ? '1 day overdue' : `${String(-daysLeft)} days overdue`;
}
