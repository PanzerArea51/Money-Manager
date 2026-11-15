import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { splitDate, weekday } from './date';
import { localDate } from './testing/arbitraries';
import type { PeriodUnit } from './types';
import { isWithin, periodFor, shiftPeriod } from './week';

const NUM_RUNS = 100;
const MS_PER_DAY = 86_400_000;

/** Whole days between two YYYY-MM-DD dates, computed independently via Date.UTC. */
function daysBetween(from: string, to: string): number {
  const a = splitDate(from);
  const b = splitDate(to);
  return (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / MS_PER_DAY;
}

describe('period properties', () => {
  // Feature: personal-finance-tracker, Property 20: A week period is Monday to Sunday and contains its anchor
  // **Validates: Requirements 7.1, 8.5**
  it('Property 20: a week period is Monday to Sunday and contains its anchor', () => {
    fc.assert(
      fc.property(localDate, (anchor) => {
        const week = periodFor('week', anchor);
        expect(week.unit).toBe('week');
        expect(weekday(week.start)).toBe(1);
        expect(weekday(week.end)).toBe(0);
        expect(daysBetween(week.start, week.end)).toBe(6);
        expect(isWithin(anchor, week)).toBe(true);

        const month = periodFor('month', anchor);
        const { year, month: m } = splitDate(anchor);
        const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
        expect(month.unit).toBe('month');
        expect(splitDate(month.start)).toEqual({ year, month: m, day: 1 });
        expect(splitDate(month.end)).toEqual({ year, month: m, day: lastDay });
        expect(isWithin(anchor, month)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: personal-finance-tracker, Property 21: Shifting a period is reversible and moves by one unit
  // **Validates: Requirements 7.10, 8.4**
  it('Property 21: shifting a period is reversible and moves by one unit', () => {
    const unit = fc.constantFrom<PeriodUnit>('day', 'week', 'month');
    fc.assert(
      fc.property(unit, localDate, fc.constantFrom<-1 | 1>(-1, 1), (u, anchor, dir) => {
        const p = periodFor(u, anchor);
        const shifted = shiftPeriod(p, dir);
        expect(shiftPeriod(shifted, dir === 1 ? -1 : 1)).toEqual(p);
        expect(shifted.unit).toBe(u);

        if (u === 'day') {
          expect(daysBetween(p.start, shifted.start)).toBe(dir);
        } else if (u === 'week') {
          expect(daysBetween(p.start, shifted.start)).toBe(7 * dir);
        } else {
          const a = splitDate(p.start);
          const b = splitDate(shifted.start);
          expect(b.year * 12 + b.month - (a.year * 12 + a.month)).toBe(dir);
          expect(b.day).toBe(1);
          const lastDay = new Date(Date.UTC(b.year, b.month, 0)).getUTCDate();
          expect(splitDate(shifted.end)).toEqual({ year: b.year, month: b.month, day: lastDay });
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});