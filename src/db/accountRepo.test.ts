import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AccountInput, Sen } from '../domain/types';
import { AccountInUseError, AccountNotFoundError, createAccountRepo } from './accountRepo';
import type { AccountRepo } from './accountRepo';
import { openFinanceDb } from './database';
import type { FinanceDb } from './database';
import { createTransactionRepo } from './transactionRepo';

const input: AccountInput = {
  name: 'Wallet',
  type: 'cash',
  openingBalance: 10000 as Sen,
};

let db: FinanceDb;
let repo: AccountRepo;

beforeEach(async () => {
  db = await openFinanceDb({ name: `test-${crypto.randomUUID()}` });
  repo = createAccountRepo(db);
});

afterEach(() => {
  db.close();
});

describe('accountRepo', () => {
  it('creates and reads an account', async () => {
    const account = await repo.add(input);
    expect(account.id).toBeTruthy();
    expect(account.archived).toBe(false);
    expect(account.createdAt).toBeTruthy();
    expect(await repo.get(account.id)).toEqual(account);
    expect(await repo.list()).toEqual([account]);
  });

  it('returns undefined for a missing account', async () => {
    expect(await repo.get('missing')).toBeUndefined();
  });

  it('updates fields and archive flag while keeping the id', async () => {
    const account = await repo.add(input);
    const updated = await repo.update(account.id, { name: 'Purse', archived: true });
    expect(updated.id).toBe(account.id);
    expect(updated.name).toBe('Purse');
    expect(updated.archived).toBe(true);
    expect(updated.createdAt).toBe(account.createdAt);
    expect(await repo.get(account.id)).toEqual(updated);
    expect(await repo.list()).toHaveLength(1);
  });

  it('rejects updating a missing account', async () => {
    await expect(repo.update('missing', { name: 'X' })).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(await repo.list()).toHaveLength(0);
  });

  it('deletes an account with no transactions', async () => {
    const account = await repo.add(input);
    await repo.remove(account.id);
    expect(await repo.get(account.id)).toBeUndefined();
  });

  it('refuses to delete an account referenced by a transaction', async () => {
    const a = await repo.add(input);
    const b = await repo.add({ ...input, name: 'Bank' });
    const txRepo = createTransactionRepo(db);
    await txRepo.add({
      kind: 'transfer',
      title: 'Move',
      amount: 500 as Sen,
      date: '2025-03-11',
      time: '08:00',
      fromAccountId: a.id,
      toAccountId: b.id,
    });
    await expect(repo.remove(b.id)).rejects.toBeInstanceOf(AccountInUseError);
    expect(await repo.get(b.id)).toBeDefined();
    expect(await repo.countTransactions(a.id)).toBe(1);
    expect(await repo.countTransactions(b.id)).toBe(1);
  });
});
