import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { summarize } from './cashflow';
import { groupByWeek } from './history';
import { ledger } from './testing/arbitraries';

describe('week net', () => {
  // Feature: personal-finance-tracker, Property 23: Week net matches the cash flow of the week
  // **Validates: Requirements 7.4**
  it('each group net equals the cash flow net of its week computed from all transactions', () => {
    fc.assert(
      fc.property(ledger, ({ transactions }) => {
        for (const group of groupByWeek(transactions)) {
          const summary = summarize(transactions, { unit: 'week', start: group.weekStart, end: group.weekEnd });
          // Overflow beyond the sen limit is reported by summarize; groupByWeek falls back to the raw sum.
          if (!summary.ok) continue;
          expect(group.net).toBe(summary.value.net);
        }
      }),
      { numRuns: 100 },
    );
  });
});
