import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { summarize } from './cashflow';
import { groupByWeek } from './history';
import { isSen } from './money';
import { accounts, localDate, transaction } from './testing/arbitraries';
import type { PeriodUnit, Transaction } from './types';
import { periodFor } from './week';

const NUM_RUNS = 100;

const periodUnit: fc.Arbitrary<PeriodUnit> = fc.constantFrom('day', 'week', 'month');

/** Transactions over a few accounts (some archived), with dates clustered so many fall inside the period. */
const sample = accounts({ minLength: 2, maxLength: 4 }).chain((accts) =>
  fc.record({
    transactions: fc.array(transaction(accts.map((a) => a.id)), { maxLength: 40 }),
    unit: periodUnit,
    anchor: localDate,
  }),
);

describe('cash flow properties', () => {
  // Feature: personal-finance-tracker, Property 18: Cash flow totals follow their definition
  // **Validates: Requirements 8.2, 8.3, 8.7, 8.10, 8.12**
  it('Property 18: cash flow totals follow their definition', () => {
    fc.assert(
      fc.property(sample, ({ transactions, unit, anchor }) => {
        // Pull some transactions into the period so the sums are not trivially zero.
        const period = periodFor(unit, anchor);
        const moved: Transaction[] = transactions.map((t, i) => (i % 2 === 0 ? { ...t, date: anchor } : t));

        for (const txs of [transactions, moved]) {
          let income = 0;
          let expenses = 0;
          for (const t of txs) {
            if (t.date < period.start || t.date > period.end) continue;
            if (t.kind === 'income') income += t.amount;
            else if (t.kind === 'expense') expenses += t.amount;
          }
          const net = income - expenses;
          const result = summarize(txs, period);

          expect(result.ok).toBe(isSen(income) && isSen(expenses) && isSen(net));
          if (result.ok) {
            expect(result.value.totalIncome).toBe(income);
            expect(result.value.totalExpenses).toBe(expenses);
            expect(result.value.net).toBe(result.value.totalIncome - result.value.totalExpenses);
          }
        }

      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: personal-finance-tracker, Property 18: Cash flow totals follow their definition
  // **Validates: Requirements 8.2, 8.3, 8.7, 8.10, 8.12**
  it('Property 18: a period with no income or expense gives zeros', () => {
    fc.assert(
      fc.property(
        fc.array(transaction(['a', 'b']), { maxLength: 20 }),
        periodUnit,
        localDate,
        (txs, unit, anchor) => {
          const period = periodFor(unit, anchor);
          const transfersOnly = txs.filter((t) => t.kind === 'transfer');
          const result = summarize(transfersOnly, period);
          expect(result).toEqual({ ok: true, value: { totalIncome: 0, totalExpenses: 0, net: 0 } });

          const outside = txs.filter((t) => t.date < period.start || t.date > period.end);
          expect(summarize(outside, period)).toEqual({
            ok: true,
            value: { totalIncome: 0, totalExpenses: 0, net: 0 },
          });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});


describe('transfer exclusion properties', () => {
  const transfers = fc
    .array(transaction(['a', 'b', 'c']), { maxLength: 20 })
    .map((txs) => txs.filter((t) => t.kind === 'transfer'));

  // Feature: personal-finance-tracker, Property 19: Transfers never affect cash flow
  // **Validates: Requirements 5.8, 7.4, 7.8, 8.6**
  it('Property 19: adding transfers leaves the cash flow summary unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(transaction(['a', 'b', 'c']), { maxLength: 30 }),
        transfers,
        periodUnit,
        localDate,
        (original, added, unit, anchor) => {
          // Cluster dates on the anchor so added transfers fall inside the period.
          const inPeriod = added.map((t) => ({ ...t, date: anchor }));
          const period = periodFor(unit, anchor);
          const before = summarize(original, period);
          expect(summarize([...original, ...added, ...inPeriod], period)).toEqual(before);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: personal-finance-tracker, Property 19: Transfers never affect cash flow
  // **Validates: Requirements 5.8, 7.4, 7.8, 8.6**
  it('Property 19: week net in history ignores transfers', () => {
    fc.assert(
      fc.property(
        fc.array(transaction(['a', 'b', 'c']), { maxLength: 30 }),
        transfers,
        (original, added) => {
          const nets = (txs: Transaction[]) =>
            groupByWeek(txs.filter((t) => t.kind !== 'transfer')).map((g): [string, number] => [g.weekStart, g.net]);
          const withTransfers = groupByWeek([...original, ...added]);
          const expected = new Map(nets(original));
          for (const g of withTransfers) {
            expect(g.net).toBe(expected.get(g.weekStart) ?? 0);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
