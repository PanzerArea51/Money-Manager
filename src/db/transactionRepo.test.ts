import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReceiptInput, Sen, TransactionInput } from '../domain/types';
import { openFinanceDb } from './database';
import type { FinanceDb } from './database';
import { createTransactionRepo } from './transactionRepo';
import type { TransactionRepo } from './transactionRepo';

const expense: TransactionInput = {
  kind: 'expense',
  title: 'Lunch',
  amount: 1250 as Sen,
  date: '2025-03-10',
  time: '12:30',
  accountId: 'a1',
};

const transfer: TransactionInput = {
  kind: 'transfer',
  title: 'Move',
  amount: 500 as Sen,
  date: '2025-03-11',
  time: '08:00',
  fromAccountId: 'a1',
  toAccountId: 'a2',
};

function receipt(name: string): ReceiptInput {
  return {
    blob: new Blob(['x']),
    mimeType: 'application/pdf',
    fileName: name,
    size: 1,
  };
}

let db: FinanceDb;
let repo: TransactionRepo;
let dbName: string;

beforeEach(async () => {
  dbName = `test-${crypto.randomUUID()}`;
  db = await openFinanceDb({ name: dbName });
  repo = createTransactionRepo(db);
});

afterEach(() => {
  db.close();
});

describe('transactionRepo', () => {
  it('adds, gets and lists income/expense and transfer', async () => {
    const a = await repo.add(expense);
    const b = await repo.add(transfer);
    expect(await repo.get(a.id)).toEqual(a);
    expect(b.kind).toBe('transfer');
    expect(await repo.list()).toHaveLength(2);
  });

  it('stores the receipt with the transaction in one write', async () => {
    const tx = await repo.add(expense, receipt('a.pdf'));
    expect(tx.receiptId).toBeDefined();
    expect(await db.get('receipts', tx.receiptId as string)).toBeDefined();
  });

  it('update keeps id and createdAt and can change kind', async () => {
    const tx = await repo.add(expense);
    const updated = await repo.update(tx.id, transfer, { type: 'keep' });
    expect(updated.id).toBe(tx.id);
    expect(updated.createdAt).toBe(tx.createdAt);
    expect(updated.kind).toBe('transfer');
    expect('accountId' in updated).toBe(false);
  });

  it('replace deletes the old receipt; remove deletes it too', async () => {
    const tx = await repo.add(expense, receipt('old.pdf'));
    const oldId = tx.receiptId as string;
    const replaced = await repo.update(tx.id, expense, { type: 'replace', receipt: receipt('new.pdf') });
    expect(await db.get('receipts', oldId)).toBeUndefined();
    expect(await db.count('receipts')).toBe(1);
    const removed = await repo.update(tx.id, expense, { type: 'remove' });
    expect(removed.receiptId).toBeUndefined();
    expect(await db.count('receipts')).toBe(0);
    expect(replaced.receiptId).not.toBe(oldId);
  });

  it('keep leaves the receipt untouched', async () => {
    const tx = await repo.add(expense, receipt('a.pdf'));
    const kept = await repo.update(tx.id, expense, { type: 'keep' });
    expect(kept.receiptId).toBe(tx.receiptId);
    expect(await db.count('receipts')).toBe(1);
  });

  it('remove deletes the transaction and its receipt', async () => {
    const tx = await repo.add(expense, receipt('a.pdf'));
    await repo.remove(tx.id);
    expect(await db.count('transactions')).toBe(0);
    expect(await db.count('receipts')).toBe(0);
  });

  it('update of a missing id rejects and writes nothing', async () => {
    await expect(repo.update('nope', expense, { type: 'replace', receipt: receipt('a.pdf') })).rejects.toThrow();
    expect(await db.count('receipts')).toBe(0);
  });

  it('creates, reads, updates and deletes an income', async () => {
    const income: TransactionInput = { ...expense, kind: 'income', title: 'Salary' };
    const tx = await repo.add(income);
    expect(tx.kind).toBe('income');
    expect(await repo.get(tx.id)).toEqual(tx);
    const updated = await repo.update(tx.id, { ...income, amount: 9900 as Sen }, { type: 'keep' });
    expect(updated.amount).toBe(9900);
    expect((await repo.get(tx.id))?.amount).toBe(9900);
    await repo.remove(tx.id);
    expect(await repo.get(tx.id)).toBeUndefined();
  });

  it('updates and deletes a transfer', async () => {
    const tx = await repo.add(transfer);
    const updated = await repo.update(
      tx.id,
      { ...transfer, toAccountId: 'a3' },
      { type: 'keep' },
    );
    expect(updated.kind === 'transfer' && updated.toAccountId).toBe('a3');
    await repo.remove(tx.id);
    expect(await repo.list()).toHaveLength(0);
  });

  it('failed add with a receipt leaves both stores empty', async () => {
    const bad = { ...receipt('bad.pdf'), blob: () => undefined } as unknown as ReceiptInput;
    await expect(repo.add(expense, bad)).rejects.toThrow();
    expect(await db.count('transactions')).toBe(0);
    expect(await db.count('receipts')).toBe(0);
  });

  it('failed write leaves both stores unchanged', async () => {
    const tx = await repo.add(expense, receipt('old.pdf'));
    const bad = { ...receipt('bad.pdf'), blob: () => undefined } as unknown as ReceiptInput;
    await expect(repo.update(tx.id, transfer, { type: 'replace', receipt: bad })).rejects.toThrow();
    expect(await repo.get(tx.id)).toEqual(tx);
    expect(await db.count('receipts')).toBe(1);
    expect(await db.get('receipts', tx.receiptId as string)).toBeDefined();
  });
});
