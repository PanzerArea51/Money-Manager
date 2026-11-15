import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockingTransactionCount, selectableAccountIds } from './accounts';
import { accounts, transaction } from './testing/arbitraries';

describe('selectableAccountIds properties', () => {
  // Feature: personal-finance-tracker, Property 11: Selectable accounts are the active accounts plus the edited transaction's own accounts
  // **Validates: Requirements 2.9, 6.9**
  it('returns active accounts plus the edited transaction accounts, and no other archived account', () => {
    const scenario = accounts({ minLength: 1 }).chain((accts) =>
      fc.record({
        accts: fc.constant(accts),
        edited: fc.option(transaction(accts.map((a) => a.id)), { nil: undefined }),
      }),
    );

    fc.assert(
      fc.property(scenario, ({ accts, edited }) => {
        const result = selectableAccountIds(accts, edited);

        const referenced =
          edited === undefined
            ? []
            : edited.kind === 'transfer'
              ? [edited.fromAccountId, edited.toAccountId]
              : [edited.accountId];
        const expected = new Set([
          ...accts.filter((a) => !a.archived).map((a) => a.id),
          ...referenced,
        ]);

        expect(result).toEqual(expected);
        for (const a of accts) {
          if (a.archived && !referenced.includes(a.id)) expect(result.has(a.id)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('blockingTransactionCount properties', () => {
  // Feature: personal-finance-tracker, Property 26: Account deletion is blocked by every referencing transaction
  // **Validates: Requirements 2.6, 2.8**
  it('counts every transaction referencing the account, and deletion is allowed only at zero', () => {
    const scenario = accounts({ minLength: 1 }).chain((accts) =>
      fc.record({
        accts: fc.constant(accts),
        txs: fc.array(transaction(accts.map((a) => a.id)), { maxLength: 30 }),
      }),
    );

    fc.assert(
      fc.property(scenario, ({ accts, txs }) => {
        for (const a of accts) {
          const expected = txs.filter((tx) =>
            tx.kind === 'transfer'
              ? tx.fromAccountId === a.id || tx.toAccountId === a.id
              : tx.accountId === a.id,
          ).length;
          const count = blockingTransactionCount(a.id, txs);
          expect(count).toBe(expected);
          expect(count === 0).toBe(expected === 0);
        }
      }),
      { numRuns: 100 },
    );
  });
});
