import { addDays, daysInMonth, makeDate, splitDate, weekday } from './date';
import type { LocalDate, Period, PeriodUnit } from './types';

/** First day of the week: 0 = Sunday, 1 = Monday. */
export const WEEK_START = 1;

/** The week-start day on or before `d`. */
export function weekStart(d: LocalDate): LocalDate {
  const offset = (weekday(d) - WEEK_START + 7) % 7;
  return addDays(d, -offset);
}

/** The last day of the week containing `d`. */
export function weekEnd(d: LocalDate): LocalDate {
  return addDays(weekStart(d), 6);
}

export function monthStart(d: LocalDate): LocalDate {
  const { year, month } = splitDate(d);
  return makeDate(year, month, 1);
}

export function monthEnd(d: LocalDate): LocalDate {
  const { year, month } = splitDate(d);
  return makeDate(year, month, daysInMonth(year, month));
}

export function periodFor(unit: PeriodUnit, anchor: LocalDate): Period {
  switch (unit) {
    case 'day':
      return { unit, start: anchor, end: anchor };
    case 'week':
      return { unit, start: weekStart(anchor), end: weekEnd(anchor) };
    case 'month':
      return { unit, start: monthStart(anchor), end: monthEnd(anchor) };
  }
}

export function shiftPeriod(p: Period, direction: -1 | 1): Period {
  switch (p.unit) {
    case 'day':
      return periodFor('day', addDays(p.start, direction));
    case 'week':
      return periodFor('week', addDays(p.start, 7 * direction));
    case 'month': {
      // Use the first day of the adjacent month to avoid day-of-month overflow.
      const adjacent = direction === 1 ? addDays(p.end, 1) : addDays(p.start, -1);
      return periodFor('month', adjacent);
    }
  }
}

/** Inclusive on both ends. YYYY-MM-DD strings compare lexicographically. */
export function isWithin(d: LocalDate, p: Period): boolean {
  return d >= p.start && d <= p.end;
}
