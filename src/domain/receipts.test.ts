import { describe, expect, it } from 'vitest';
import { receiptEntries } from './receipts';
import type { Sen, Transaction } from './types';

function tx(id: string, kind: 'income' | 'expense', receiptId?: string): Transaction {
  return {
    id,
    kind,
    title: 'x',
    amount: 100 as Sen,
    date: '2025-01-08',
    time: '10:00',
    accountId: 'a',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...(receiptId === undefined ? {} : { receiptId }),
  };
}

describe('receiptEntries', () => {
  it('returns an empty list for empty input', () => {
    expect(receiptEntries([])).toEqual([]);
  });

  it('excludes transactions without a receipt', () => {
    expect(receiptEntries([tx('1', 'income'), tx('2', 'expense')])).toEqual([]);
  });

  it('returns only transactions with a receipt, in input order', () => {
    const withReceipt1 = tx('1', 'expense', 'r1');
    const without = tx('2', 'income');
    const withReceipt2 = tx('3', 'income', 'r2');
    expect(receiptEntries([withReceipt1, without, withReceipt2])).toEqual([withReceipt1, withReceipt2]);
  });

  it('includes transfers that have a receipt', () => {
    const transfer: Transaction = {
      id: 't',
      kind: 'transfer',
      title: 'x',
      amount: 100 as Sen,
      date: '2025-01-08',
      time: '10:00',
      fromAccountId: 'a',
      toAccountId: 'b',
      receiptId: 'r',
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    expect(receiptEntries([transfer])).toEqual([transfer]);
  });
});
