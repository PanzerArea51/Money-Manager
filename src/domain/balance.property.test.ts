import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { selectableAccountIds } from './accounts';
import { accountBalance, combinedBalance } from './balance';
import { isSen } from './money';
import { account, accounts, ledger, transaction } from './testing/arbitraries';
import type { Account, Transaction } from './types';

const NUM_RUNS = 100;

/** Independent reference: opening + income - expense + transfers in - transfers out. */
function expectedBalance(acct: Account, txs: readonly Transaction[]): number {
  let total: number = acct.openingBalance;
  for (const t of txs) {
    if (t.kind === 'income' && t.accountId === acct.id) total += t.amount;
    else if (t.kind === 'expense' && t.accountId === acct.id) total -= t.amount;
    else if (t.kind === 'transfer') {
      if (t.toAccountId === acct.id) total += t.amount;
      if (t.fromAccountId === acct.id) total -= t.amount;
    }
  }
  return total;
}

/** An account, plus transactions over it and a few other accounts (at least two ids, so transfers occur). */
const accountWithTransactions = fc
  .tuple(account, accounts({ minLength: 1, maxLength: 3 }))
  .chain(([target, others]) => {
    const ids = [target.id, ...others.map((o) => o.id).filter((id) => id !== target.id)];
    const padded = ids.length < 2 ? [...ids, `${target.id}-other`] : ids;
    return fc.record({
      account: fc.constant(target),
      transactions: fc.array(transaction(padded), { maxLength: 30 }),
    });
  });

describe('balance properties', () => {
  // Feature: personal-finance-tracker, Property 12: Account balance equals opening balance plus signed transaction effects
  // **Validates: Requirements 2.3, 3.4, 4.9, 4.10, 4.11, 5.6, 10.7**
  it('Property 12: account balance equals opening balance plus signed transaction effects', () => {
    fc.assert(
      fc.property(accountWithTransactions, fc.integer({ min: -1_000_000, max: 1_000_000 }), (sample, delta) => {
        const { account: acct, transactions } = sample;
        const expected = expectedBalance(acct, transactions);
        const result = accountBalance(acct, transactions);

        // Result is in range exactly when the exact sum is, and then equals it (an integer, possibly negative).
        expect(result.ok).toBe(isSen(expected));
        if (result.ok) {
          expect(Number.isInteger(result.value)).toBe(true);
          expect(result.value).toBe(expected);
        }

        // Changing only the opening balance by delta changes the balance by exactly delta.
        const shifted = { ...acct, openingBalance: acct.openingBalance + delta } as Account;
        const shiftedExpected = expectedBalance(shifted, transactions);
        expect(shiftedExpected - expected).toBe(delta);
        const shiftedResult = accountBalance(shifted, transactions);
        expect(shiftedResult.ok).toBe(isSen(shiftedExpected));
        if (shiftedResult.ok && result.ok) expect(shiftedResult.value - result.value).toBe(delta);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

/** Accounts plus an optional edited transaction that references some of them. */
const accountsWithEdited = accounts({ minLength: 1, maxLength: 6 }).chain((accts) =>
  fc.record({
    accounts: fc.constant(accts),
    edited: fc.option(transaction(accts.map((a) => a.id)), { nil: undefined }),
  }),
);

describe('selectable accounts properties', () => {
  // Feature: personal-finance-tracker, Property 11: Selectable accounts are the active accounts plus the edited transaction's own accounts
  // **Validates: Requirements 2.9, 6.9**
  it('Property 11: selectable accounts are the active accounts plus the edited transaction\'s own accounts', () => {
    fc.assert(
      fc.property(accountsWithEdited, ({ accounts: accts, edited }) => {
        const selectable = selectableAccountIds(accts, edited);
        const own = new Set<string>();
        if (edited) {
          if (edited.kind === 'transfer') {
            own.add(edited.fromAccountId);
            own.add(edited.toAccountId);
          } else {
            own.add(edited.accountId);
          }
        }
        const expected = new Set<string>([...accts.filter((a) => !a.archived).map((a) => a.id), ...own]);
        expect(selectable).toEqual(expected);

        // Archived accounts not referenced by the edited transaction are never selectable.
        for (const a of accts) {
          if (a.archived && !own.has(a.id)) expect(selectable.has(a.id)).toBe(false);
        }
        // Without an edited transaction, only active accounts are selectable.
        if (!edited) expect(selectable.size).toBe(accts.filter((a) => !a.archived).length);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

const ledgerWithNewTransaction = ledger.chain((l) =>
  fc.record({
    accounts: fc.constant(l.accounts),
    transactions: fc.constant(l.transactions),
    added: transaction(l.accounts.map((a) => a.id)).filter((t) => !l.transactions.some((e) => e.id === t.id)),
    position: fc.nat({ max: l.transactions.length }),
  }),
);

describe('add-then-delete properties', () => {
  // Feature: personal-finance-tracker, Property 13: Adding then deleting a transaction restores all balances
  // **Validates: Requirements 6.4, 6.8**
  it('Property 13: adding then deleting a transaction restores all balances', () => {
    fc.assert(
      fc.property(ledgerWithNewTransaction, ({ accounts: accts, transactions, added, position }) => {
        const withAdded = [...transactions.slice(0, position), added, ...transactions.slice(position)];
        const afterDelete = withAdded.filter((t) => t.id !== added.id);

        for (const acct of accts) {
          expect(accountBalance(acct, afterDelete)).toEqual(accountBalance(acct, transactions));
        }
        expect(combinedBalance(accts, afterDelete)).toEqual(combinedBalance(accts, transactions));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
