import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { accountBalance, combinedBalance } from './balance';
import { localDate, localTime, positiveSen, accounts, transaction } from './testing/arbitraries';
import type { Account, Transaction } from './types';

const NUM_RUNS = 100;

/** Accounts (at least two active), existing transactions, and a new transfer between two distinct active accounts. */
const scenario = accounts({ minLength: 2, maxLength: 6 }).chain((accts) => {
  const withActive = accts.map((a, i) => (i < 2 ? ({ ...a, archived: false } as Account) : a));
  const ids = withActive.map((a) => a.id);
  return fc.record({
    accounts: fc.constant(withActive),
    transactions: fc.array(transaction(ids), { maxLength: 20 }),
    pair: fc.shuffledSubarray(
      withActive.filter((a) => !a.archived).map((a) => a.id),
      { minLength: 2, maxLength: 2 },
    ),
    amount: positiveSen,
    date: localDate,
    time: localTime,
    newId: fc.uuid(),
  });
});

describe('transfer and combined balance properties', () => {
  // Feature: personal-finance-tracker, Property 15: Transfers preserve the combined balance
  // **Validates: Requirements 5.7**
  it('Property 15: adding a transfer between two active accounts preserves the combined balance', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const [fromAccountId, toAccountId] = s.pair as [string, string];
        const base = { id: `new-${s.newId}`, title: 'Transfer', date: s.date, time: s.time, createdAt: '2024-01-01T00:00:00.000Z' };
        const transfer = { ...base, kind: 'transfer', amount: s.amount, fromAccountId, toAccountId } as unknown as Transaction;
        const after = [...s.transactions, transfer];

        const before = combinedBalance(s.accounts, s.transactions);
        const afterResult = combinedBalance(s.accounts, after);

        const active = s.accounts.filter((a) => !a.archived);
        const allInRange = active.every((a) => accountBalance(a, after).ok);
        if (before.ok && allInRange) {
          // Every per-account balance stays in range, so the sums are exact and must match.
          expect(afterResult).toEqual(before);
        } else if (before.ok && afterResult.ok) {
          expect(afterResult.value).toBe(before.value);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
