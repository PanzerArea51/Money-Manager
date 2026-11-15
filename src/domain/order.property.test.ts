import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { accountBalance, combinedBalance } from './balance';
import { summarize } from './cashflow';
import { ledger, localDate, shuffle } from './testing/arbitraries';
import type { Period } from './types';

const NUM_RUNS = 100;

const period: fc.Arbitrary<Period> = fc
  .tuple(localDate, localDate, fc.constantFrom('day' as const, 'week' as const, 'month' as const))
  .map(([a, b, unit]) => (a <= b ? { unit, start: a, end: b } : { unit, start: b, end: a }));

const ledgerWithPermutation = ledger.chain((l) =>
  fc.record({
    accounts: fc.constant(l.accounts),
    transactions: fc.constant(l.transactions),
    permuted: shuffle(l.transactions),
    period,
  }),
);

describe('order independence properties', () => {
  // Feature: personal-finance-tracker, Property 17: Results do not depend on transaction order
  // **Validates: Requirements 10.10**
  it('Property 17: results do not depend on transaction order', () => {
    fc.assert(
      fc.property(ledgerWithPermutation, ({ accounts: accts, transactions, permuted, period: p }) => {
        for (const acct of accts) {
          expect(accountBalance(acct, permuted)).toEqual(accountBalance(acct, transactions));
        }
        expect(combinedBalance(accts, permuted)).toEqual(combinedBalance(accts, transactions));
        expect(summarize(permuted, p)).toEqual(summarize(transactions, p));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
