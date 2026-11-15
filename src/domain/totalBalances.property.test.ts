import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { accountBalance } from './balance';
import { ledger } from './testing/arbitraries';

const NUM_RUNS = 100;

describe('total of all balances properties', () => {
  // Feature: personal-finance-tracker, Property 16: Total of all balances ignores transfers
  // **Validates: Requirements 10.9**
  it('Property 16: sum of all account balances equals openings + income - expense', () => {
    fc.assert(
      fc.property(ledger, ({ accounts, transactions }) => {
        let expected = 0;
        for (const a of accounts) expected += a.openingBalance;
        for (const t of transactions) {
          if (t.kind === 'income') expected += t.amount;
          else if (t.kind === 'expense') expected -= t.amount;
        }

        let actual = 0;
        for (const a of accounts) {
          const result = accountBalance(a, transactions);
          // A single balance outside the supported range is reported as an error; the identity is only meaningful otherwise.
          if (!result.ok) return;
          actual += result.value;
        }
        expect(actual).toBe(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
