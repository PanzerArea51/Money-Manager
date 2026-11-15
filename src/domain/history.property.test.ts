import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays, weekday } from './date';
import { compareTransactionsNewestFirst, groupByWeek } from './history';
import { localDate, transaction } from './testing/arbitraries';
import type { Transaction } from './types';

const NUM_RUNS = 100;

/** Transactions with dates clustered near a base date so several share weeks and days. */
const clusteredTransactions: fc.Arbitrary<Transaction[]> = fc
  .tuple(localDate, fc.array(fc.tuple(transaction(['a', 'b', 'c']), fc.integer({ min: 0, max: 20 })), { maxLength: 30 }))
  .map(([base, items]) => items.map(([tx, offset]) => ({ ...tx, date: addDays(base, offset) })));

const spreadTransactions: fc.Arbitrary<Transaction[]> = fc.array(transaction(['a', 'b', 'c']), { maxLength: 30 });

const anyTransactions = fc.oneof(clusteredTransactions, spreadTransactions);

describe('history grouping properties', () => {
  // Feature: personal-finance-tracker, Property 22: History grouping partitions transactions by week and orders them
  // **Validates: Requirements 7.1, 7.2, 7.3**
  it('Property 22: grouping partitions transactions by week and orders them', () => {
    fc.assert(
      fc.property(anyTransactions, (txs) => {
        const groups = groupByWeek(txs);

        // Every transaction appears in exactly one group.
        const grouped = groups.flatMap((g) => g.transactions);
        expect(grouped).toHaveLength(txs.length);
        expect(new Set(grouped.map((t) => t.id)).size).toBe(new Set(txs.map((t) => t.id)).size);
        expect([...grouped].map((t) => t.id).sort()).toEqual(txs.map((t) => t.id).sort());

        for (const g of groups) {
          // Monday-to-Sunday range, and each transaction's date lies within it.
          expect(weekday(g.weekStart)).toBe(1);
          expect(weekday(g.weekEnd)).toBe(0);
          expect(g.weekEnd).toBe(addDays(g.weekStart, 6));
          expect(g.transactions.length).toBeGreaterThan(0);
          for (const t of g.transactions) {
            expect(t.date >= g.weekStart && t.date <= g.weekEnd).toBe(true);
          }
          // Within a group: newest first by date, time, then creation time.
          for (let i = 1; i < g.transactions.length; i++) {
            const prev = g.transactions[i - 1];
            const cur = g.transactions[i];
            const key = (t: Transaction) => [t.date, t.time, t.createdAt];
            expect(key(prev) >= key(cur) || compareTransactionsNewestFirst(prev, cur) <= 0).toBe(true);
            if (prev.date !== cur.date) expect(prev.date > cur.date).toBe(true);
            else if (prev.time !== cur.time) expect(prev.time > cur.time).toBe(true);
            else if (prev.createdAt !== cur.createdAt) expect(prev.createdAt > cur.createdAt).toBe(true);
          }
        }

        // Groups are newest week first with no duplicate weeks.
        for (let i = 1; i < groups.length; i++) {
          expect(groups[i - 1].weekStart > groups[i].weekStart).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
