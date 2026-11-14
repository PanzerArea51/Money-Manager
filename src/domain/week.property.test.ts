import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { splitDate, weekday } from './date';
import { localDate } from './testing/arbitraries';
import { isWithin, periodFor } from './week';

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
});
