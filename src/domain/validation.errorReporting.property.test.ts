import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  validateAccountInput,
  validateTransactionInput,
  type AccountDraft,
  type TransactionDraft,
} from './validation';

/**
 * Feature: personal-finance-tracker, Property 9: Validation reports every invalid field
 * **Validates: Requirements 2.2, 6.3**
 *
 * Each draft starts valid and a random subset of fields is corrupted with a value known to
 * violate that field's rule. The error map keys must equal exactly that subset.
 */

const SELECTABLE: ReadonlySet<string> = new Set(['a', 'b']);

const badName = fc.constantFrom('', '   ', 'x'.repeat(51));
const badType = fc.constantFrom('', 'crypto', 'CASH');
const badMoney = fc.constantFrom('', 'abc', '1.234', '1.2.3');
const badTitle = fc.constantFrom('', '  \t ', 'x'.repeat(101));
const badAmount = fc.constantFrom('', 'abc', '0', '0.00', '-5', '1000000000.00', '1.234');
const badDate = fc.constantFrom('', '2024-02-30', '2023-02-29', '2024-13-01', '24-01-01', 'abc');
const badTime = fc.constantFrom('', '24:00', '12:60', '7:05', 'abc');
const badAccount = fc.constantFrom('', 'zzz');

function sorted(keys: string[]): string[] {
  return [...keys].sort();
}

describe('Property 9: Validation reports every invalid field', () => {
  it('account errors are exactly the corrupted fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.option(badName, { nil: undefined }),
          type: fc.option(badType, { nil: undefined }),
          startingBalance: fc.option(badMoney, { nil: undefined }),
        }),
        (corrupt) => {
          const draft: AccountDraft = { name: 'Wallet', type: 'cash', startingBalance: '10.00' };
          const expected: string[] = [];
          for (const key of ['name', 'type', 'startingBalance'] as const) {
            const bad = corrupt[key];
            if (bad !== undefined) {
              draft[key] = bad;
              expected.push(key);
            }
          }
          const result = validateAccountInput(draft);
          if (expected.length === 0) {
            expect(result.ok).toBe(true);
          } else {
            expect(result.ok).toBe(false);
            if (!result.ok) expect(sorted(Object.keys(result.error))).toEqual(sorted(expected));
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('transaction errors are exactly the corrupted fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'income' | 'expense' | 'transfer'>('income', 'expense', 'transfer'),
        fc.record({
          title: fc.option(badTitle, { nil: undefined }),
          amount: fc.option(badAmount, { nil: undefined }),
          date: fc.option(badDate, { nil: undefined }),
          time: fc.option(badTime, { nil: undefined }),
          accountId: fc.option(badAccount, { nil: undefined }),
          fromAccountId: fc.option(badAccount, { nil: undefined }),
          toAccountId: fc.option(badAccount, { nil: undefined }),
        }),
        fc.boolean(),
        (kind, corrupt, sameAccount) => {
          const draft: TransactionDraft =
            kind === 'transfer'
              ? { kind, title: 'Lunch', amount: '12.50', date: '2024-03-10', time: '09:30', fromAccountId: 'a', toAccountId: 'b' }
              : { kind, title: 'Lunch', amount: '12.50', date: '2024-03-10', time: '09:30', accountId: 'a' };
          const fields =
            kind === 'transfer'
              ? (['title', 'amount', 'date', 'time', 'fromAccountId', 'toAccountId'] as const)
              : (['title', 'amount', 'date', 'time', 'accountId'] as const);

          const expected: string[] = [];
          for (const key of fields) {
            const bad = corrupt[key];
            if (bad !== undefined) {
              draft[key] = bad;
              expected.push(key);
            }
          }
          if (kind === 'transfer' && sameAccount && !expected.includes('fromAccountId') && !expected.includes('toAccountId')) {
            draft.toAccountId = draft.fromAccountId;
            expected.push('toAccountId');
          }

          const result = validateTransactionInput(draft, SELECTABLE);
          if (expected.length === 0) {
            expect(result.ok).toBe(true);
          } else {
            expect(result.ok).toBe(false);
            if (!result.ok) expect(sorted(Object.keys(result.error))).toEqual(sorted(expected));
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
