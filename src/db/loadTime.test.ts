import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { combinedBalance } from '../domain/balance';
import { summarize } from '../domain/cashflow';
import { groupByWeek } from '../domain/history';
import type { Account, Receipt, Sen, Transaction } from '../domain/types';
import { openFinanceDb } from './database';
import type { FinanceDb } from './database';

/** Requirement 11.5: display saved data within 2 seconds for up to 10,000 transactions. */
const LOAD_LIMIT_MS = 2000;
const TX_COUNT = 10_000;

let db: FinanceDb | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function makeAccounts(): Account[] {
  return ['a0', 'a1', 'a2'].map((id) => ({
    id,
    name: id,
    type: 'bank',
    openingBalance: 100_000 as Sen,
    archived: false,
    createdAt: '2025-01-01T00:00:00.000Z',
  }));
}

function makeTransactions(): Transaction[] {
  const txs: Transaction[] = [];
  for (let i = 0; i < TX_COUNT; i++) {
    const month = String((i % 12) + 1).padStart(2, '0');
    const day = String((i % 28) + 1).padStart(2, '0');
    const base = {
      id: `tx-${i}`,
      title: `Tx ${i}`,
      amount: ((i % 500) + 1) as Sen,
      date: `2025-${month}-${day}`,
      time: '12:00',
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    const kind = i % 3;
    if (kind === 0) txs.push({ ...base, kind: 'income', accountId: `a${i % 3}` });
    else if (kind === 1) txs.push({ ...base, kind: 'expense', accountId: `a${i % 3}` });
    else txs.push({ ...base, kind: 'transfer', fromAccountId: 'a0', toAccountId: 'a1' });
  }
  return txs;
}

describe('load time with 10,000 transactions', () => {
  it('loads all data and derives balances, history and cash flow within 2 seconds', async () => {
    db = await openFinanceDb({ name: `load-${crypto.randomUUID()}` });
    const tx = db.transaction(['accounts', 'transactions', 'receipts'], 'readwrite');
    const receipt: Receipt = {
      id: 'r1',
      blob: new Blob(['x']),
      mimeType: 'application/pdf',
      fileName: 'r.pdf',
      size: 1,
    };
    await Promise.all([
      ...makeAccounts().map((a) => tx.objectStore('accounts').put(a)),
      ...makeTransactions().map((t) => tx.objectStore('transactions').put(t)),
      tx.objectStore('receipts').put(receipt),
      tx.done,
    ]);

    const start = performance.now();
    const [accounts, transactions, receipts] = await Promise.all([
      db.getAll('accounts'),
      db.getAll('transactions'),
      db.getAll('receipts'),
    ]);
    const balance = combinedBalance(accounts, transactions);
    const weeks = groupByWeek(transactions);
    const flow = summarize(transactions, { unit: 'month', start: '2025-03-01', end: '2025-03-31' });
    const elapsed = performance.now() - start;

    expect(transactions).toHaveLength(TX_COUNT);
    expect(accounts).toHaveLength(3);
    expect(receipts).toHaveLength(1);
    expect(balance.ok).toBe(true);
    expect(weeks.length).toBeGreaterThan(0);
    expect(flow.ok).toBe(true);
    expect(elapsed).toBeLessThan(LOAD_LIMIT_MS);
  });
});
