import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { accountBalance, combinedBalance } from './balance';
import { ledger } from './testing/arbitraries';

const NUM_RUNS = 100;

/** Exact sum of active balances, or undefined when any balance or the sum is out of range. */
function activeSum(
  accts: Parameters<typeof combinedBalance>[0],
  txs: Parameters<typeof combinedBalance>[1],
): number | undefined {
  let total = 0;
  for (const a of accts) {
    if (a.archived) continue;
    const b = accountBalance(a, txs);
    if (!b.ok) return undefined;
    total += b.value;
  }
  return total;
}

describe('combined balance properties', () => {
  // Feature: personal-finance-tracker, Property 14: Combined balance sums active accounts only
  // **Validates: Requirements 2.4, 2.5, 3.2, 3.7, 3.8**
  it('Property 14: combined balance sums active accounts only', () => {
    fc.assert(
      fc.property(ledger, fc.nat(), ({ accounts, transactions }, pick) => {
        const combined = combinedBalance(accounts, transactions);
        const expected = activeSum(accounts, transactions);

        if (expected !== undefined && combined.ok) expect(combined.value).toBe(expected);
        if (expected !== undefined && Math.abs(expected) <= 99_999_999_999) expect(combined.ok).toBe(true);

        // No active accounts: combined balance is 0.
        const allArchived = accounts.map((a) => ({ ...a, archived: true }));
        expect(combinedBalance(allArchived, transactions)).toEqual({ ok: true, value: 0 });

        // Archiving removes exactly the account's balance; restoring adds it back.
        const target = accounts[pick % accounts.length];
        const targetBalance = accountBalance(target, transactions);
        const active = accounts.map((a) => (a.id === target.id ? { ...a, archived: false } : a));
        const archived = accounts.map((a) => (a.id === target.id ? { ...a, archived: true } : a));
        const withTarget = combinedBalance(active, transactions);
        const withoutTarget = combinedBalance(archived, transactions);
        if (targetBalance.ok && withTarget.ok && withoutTarget.ok) {
          expect(withTarget.value - withoutTarget.value).toBe(targetBalance.value);
        }
        // Restoring returns to the same value as before archiving.
        expect(combinedBalance(active, transactions)).toEqual(withTarget);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
