import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Account, Sen } from '../domain/types';
import { DbOpenError, migrations, openFinanceDb } from './database';
import type { Migration } from './database';

let counter = 0;
function uniqueName(): string {
  counter += 1;
  return `db-test-${counter}-${crypto.randomUUID()}`;
}

function account(id: string): Account {
  return {
    id,
    name: `Account ${id}`,
    type: 'cash',
    openingBalance: 1000 as Sen,
    archived: false,
    createdAt: '2025-01-01T00:00:00.000Z',
  } as Account;
}

describe('openFinanceDb', () => {
  it('creates the three stores and indexes on a fresh database', async () => {
    const db = await openFinanceDb({ name: uniqueName() });
    try {
      expect([...db.objectStoreNames].sort()).toEqual(['accounts', 'receipts', 'transactions']);
      const tx = db.transaction('transactions');
      expect([...tx.store.indexNames].sort()).toEqual(['accountId', 'date']);
      await tx.done;
    } finally {
      db.close();
    }
  });

  it('runs only the missing migrations and preserves existing records', async () => {
    const name = uniqueName();
    const v1 = await openFinanceDb({ name, version: 1 });
    await v1.put('accounts', account('a1'));
    await v1.put('accounts', account('a2'));
    v1.close();

    const addAccount: Migration = async (_db, tx) => {
      await tx.objectStore('accounts').put(account('from-v2'));
    };
    const v2 = await openFinanceDb({
      name,
      version: 2,
      migrations: [...migrations, addAccount],
    });
    try {
      expect(v2.version).toBe(2);
      const ids = (await v2.getAllKeys('accounts')).sort();
      expect(ids).toEqual(['a1', 'a2', 'from-v2']);
      expect((await v2.get('accounts', 'a1'))?.name).toBe('Account a1');
    } finally {
      v2.close();
    }
  });

  it('rejects with DbOpenError and keeps old data when a migration throws', async () => {
    const name = uniqueName();
    const v1 = await openFinanceDb({ name, version: 1 });
    await v1.put('accounts', account('a1'));
    v1.close();

    const failing: Migration = async (_db, tx) => {
      await tx.objectStore('accounts').put(account('partial'));
      throw new Error('boom');
    };
    await expect(
      openFinanceDb({ name, version: 2, migrations: [...migrations, failing] }),
    ).rejects.toBeInstanceOf(DbOpenError);

    const again = await openFinanceDb({ name, version: 1 });
    try {
      expect(again.version).toBe(1);
      expect(await again.getAllKeys('accounts')).toEqual(['a1']);
    } finally {
      again.close();
    }
  });

  it('rejects with DbOpenError when a migration is missing', async () => {
    await expect(
      openFinanceDb({ name: uniqueName(), version: 2, migrations: [undefined, migrations[1]] }),
    ).rejects.toBeInstanceOf(DbOpenError);
  });
});
