import { describe, expect, test } from 'vitest';
import { addDays, dayOf, daysBetween, daysUntilWatering, isDay, reminderText } from './watering.ts';

describe('isDay', () => {
  test.each(['2026-06-15', '2028-02-29'])('%s is a day', (day) => {
    expect(isDay(day)).toBe(true);
  });

  test.each(['2026-02-30', '2026-13-01', '2026-6-15', '15.06.2026', '', 20260615, undefined])(
    '%s is not a day',
    (value) => {
      expect(isDay(value)).toBe(false);
    },
  );
});

describe('day maths', () => {
  test('crosses month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('counts whole days across a summer-time change', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-06-15', '2026-06-10')).toBe(-5);
  });

  test('the local day of a moment', () => {
    expect(dayOf(new Date(2026, 5, 15, 23, 59))).toBe('2026-06-15');
  });
});

describe('reminders', () => {
  test.each([
    // last watered, every, today, days left
    ['2026-06-15', 7, '2026-06-15', 7],
    ['2026-06-12', 3, '2026-06-15', 0],
    ['2026-06-13', 3, '2026-06-15', 1],
    ['2026-06-10', 3, '2026-06-15', -2],
    ['2026-12-30', 5, '2027-01-02', 2],
  ])('watered %s, every %d days, on %s: %d days left', (last, every, today, left) => {
    expect(daysUntilWatering(last, every, today)).toBe(left);
  });

  test.each([
    [5, 'Water in 5 days'],
    [1, 'Water tomorrow'],
    [0, 'Water today'],
    [-1, '1 day overdue'],
    [-3, '3 days overdue'],
  ])('%d days left reads "%s"', (left, text) => {
    expect(reminderText(left)).toBe(text);
  });
});
