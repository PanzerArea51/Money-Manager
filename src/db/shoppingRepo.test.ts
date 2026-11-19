import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { ReceiptInput, Sen, ShoppingListInput, TransactionInput } from '../domain/types';
import { openFinanceDb } from './database';
import {
  createShoppingRepo,
  ShoppingListAlreadyCompletedError,
  ShoppingListNotFoundError,
} from './shoppingRepo';

const INPUT: ShoppingListInput = {
  title: 'Groceries',
  date: '2025-03-05',
  items: [{ id: 'i1', name: 'Milk', bought: false }],
  accountId: 'wallet-1',
  price: 1250 as Sen,
};

const RECEIPT: ReceiptInput = {
  blob: new Blob(['x'], { type: 'image/png' }),
  mimeType: 'image/png',
  fileName: 'r.png',
  size: 1,
};

const EXPENSE: TransactionInput = {
  kind: 'expense',
  title: 'Groceries',
  amount: 1250 as Sen,
  date: '2025-03-05',
  time: '10:00',
  accountId: 'wallet-1',
};

async function setup() {
  const db = await openFinanceDb({ name: `shopping-${crypto.randomUUID()}` });
  return { db, repo: createShoppingRepo(db) };
}

describe('shoppingRepo', () => {
  it('stores the receipt in the shared receipts store and links it', async () => {
    const { db, repo } = await setup();
    const created = await repo.add(INPUT, RECEIPT);
    expect(created.receiptId).toBeDefined();
    expect(await db.get('receipts', created.receiptId as string)).toBeDefined();
    expect(await repo.list()).toEqual([created]);
    db.close();
  });

  it('keeps the receipt on a plain update and replaces or removes it on request', async () => {
    const { db, repo } = await setup();
    const created = await repo.add(INPUT, RECEIPT);
    const receiptId = created.receiptId as string;

    const kept = await repo.update(created.id, { ...INPUT, title: 'New' }, { type: 'keep' });
    expect(kept.receiptId).toBe(receiptId);
    expect(kept.title).toBe('New');

    const replaced = await repo.update(created.id, INPUT, { type: 'replace', receipt: RECEIPT });
    expect(replaced.receiptId).not.toBe(receiptId);
    expect(await db.get('receipts', receiptId)).toBeUndefined();

    const removed = await repo.update(created.id, INPUT, { type: 'remove' });
    expect(removed.receiptId).toBeUndefined();
    expect(await db.count('receipts')).toBe(0);
    db.close();
  });

  it('removes the list and its receipt together', async () => {
    const { db, repo } = await setup();
    const created = await repo.add(INPUT, RECEIPT);
    await repo.remove(created.id);
    expect(await repo.list()).toEqual([]);
    expect(await db.count('receipts')).toBe(0);
    db.close();
  });

  it('completes a list: creates the expense with its own receipt copy and links it', async () => {
    const { db, repo } = await setup();
    const created = await repo.add(INPUT, RECEIPT);
    const { list, transaction } = await repo.complete(created.id, EXPENSE);

    expect(list.transactionId).toBe(transaction.id);
    expect(transaction).toMatchObject({ kind: 'expense', amount: 1250, accountId: 'wallet-1' });
    expect(transaction.receiptId).toBeDefined();
    expect(transaction.receiptId).not.toBe(created.receiptId);
    expect(await db.count('receipts')).toBe(2);
    expect(await db.get('transactions', transaction.id)).toEqual(transaction);

    // Deleting the list keeps the expense and its receipt.
    await repo.remove(created.id);
    expect(await db.get('receipts', transaction.receiptId as string)).toBeDefined();
    expect(await db.get('transactions', transaction.id)).toBeDefined();
    db.close();
  });

  it('refuses to complete twice, and keeps the transactionId across edits', async () => {
    const { db, repo } = await setup();
    const created = await repo.add(INPUT);
    const { transaction } = await repo.complete(created.id, EXPENSE);
    await expect(repo.complete(created.id, EXPENSE)).rejects.toBeInstanceOf(
      ShoppingListAlreadyCompletedError,
    );
    expect(await db.count('transactions')).toBe(1);

    const edited = await repo.update(created.id, { ...INPUT, title: 'Renamed' }, { type: 'keep' });
    expect(edited.transactionId).toBe(transaction.id);
    db.close();
  });

  it('can complete again after the expense was deleted', async () => {
    const { db, repo } = await setup();
    const created = await repo.add(INPUT);
    const first = await repo.complete(created.id, EXPENSE);
    await db.delete('transactions', first.transaction.id);
    const second = await repo.complete(created.id, EXPENSE);
    expect(second.list.transactionId).toBe(second.transaction.id);
    db.close();
  });

  it('rejects an update for a missing list', async () => {
    const { db, repo } = await setup();
    await expect(repo.update('nope', INPUT, { type: 'keep' })).rejects.toBeInstanceOf(
      ShoppingListNotFoundError,
    );
    db.close();
  });
});
