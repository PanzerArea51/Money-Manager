import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays } from './date';
import { findWeekForMonth, groupByWeek } from './history';
import { localDate, transaction } from './testing/arbitraries';
import type { LocalDate, Transaction } from './types';
import { isWithin, periodFor } from './week';

const NUM_RUNS = 100;

/** Transactions clustered within ~10 weeks of a base date so months span several week groups. */
const clusteredTransactions: fc.Arbitrary<Transaction[]> = fc
  .tuple(localDate, fc.array(fc.tuple(transaction(['a', 'b', 'c']), fc.integer({ min: 0, max: 70 })), { maxLength: 30 }))
  .map(([base, items]) => items.map(([tx, offset]) => ({ ...tx, date: addDays(base, offset) })));

const spreadTransactions: fc.Arbitrary<Transaction[]> = fc.array(transaction(['a', 'b', 'c']), { maxLength: 30 });

/** Transactions plus a month anchor that is often one of their own dates (so a match exists). */
const scenario: fc.Arbitrary<{ txs: Transaction[]; anchor: LocalDate }> = fc
  .oneof(clusteredTransactions, spreadTransactions)
  .chain((txs) => {
    const random = localDate;
    const anchor = txs.length > 0 ? fc.oneof(fc.constantFrom(...txs.map((t) => t.date)), random) : random;
    return anchor.map((a) => ({ txs, anchor: a }));
  });

describe('month lookup', () => {
  // Feature: personal-finance-tracker, Property 24: Month lookup finds the newest week touching the month
  // **Validates: Requirements 7.9**
  it('Property 24: returns the newest group with a date in the month, or undefined when none', () => {
    fc.assert(
      fc.property(scenario, ({ txs, anchor }) => {
        const month = periodFor('month', anchor);
        const groups = groupByWeek(txs);
        const found = findWeekForMonth(groups, month);
        const touching = groups.filter((g) => g.transactions.some((t) => isWithin(t.date, month)));

        if (touching.length === 0) {
          expect(found).toBeUndefined();
          return;
        }
        expect(found).toBeDefined();
        if (found === undefined) return;
        expect(touching).toContain(found);
        for (const g of touching) expect(g.weekStart <= found.weekStart).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
