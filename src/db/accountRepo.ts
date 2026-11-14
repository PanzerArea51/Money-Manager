import type { Account, AccountInput, Transaction } from '../domain/types';
import type { FinanceDb } from './database';

export type AccountUpdate = Partial<AccountInput> & { archived?: boolean };

export class AccountInUseError extends Error {
  readonly count: number;

  constructor(count: number) {
    super(`Account is referenced by ${count} transaction(s)`);
    this.name = 'AccountInUseError';
    this.count = count;
  }
}

export class AccountNotFoundError extends Error {
  constructor(id: string) {
    super(`Account not found: ${id}`);
    this.name = 'AccountNotFoundError';
  }
}

export interface AccountRepo {
  list(): Promise<Account[]>;
  get(id: string): Promise<Account | undefined>;
  add(input: AccountInput): Promise<Account>;
  update(id: string, changes: AccountUpdate): Promise<Account>;
  remove(id: string): Promise<void>;
  countTransactions(id: string): Promise<number>;
}

function references(tx: Transaction, accountId: string): boolean {
  return tx.kind === 'transfer'
    ? tx.fromAccountId === accountId || tx.toAccountId === accountId
    : tx.accountId === accountId;
}

export function createAccountRepo(db: FinanceDb): AccountRepo {
  async function countIn(all: Transaction[], id: string): Promise<number> {
    return all.filter((tx) => references(tx, id)).length;
  }

  return {
    list: () => db.getAll('accounts'),

    get: (id) => db.get('accounts', id),

    async add(input) {
      const account: Account = {
        id: crypto.randomUUID(),
        name: input.name,
        type: input.type,
        openingBalance: input.openingBalance,
        archived: false,
        createdAt: new Date().toISOString(),
      };
      await db.add('accounts', account);
      return account;
    },

    async update(id, changes) {
      const tx = db.transaction('accounts', 'readwrite');
      const existing = await tx.store.get(id);
      if (!existing) {
        tx.abort();
        await tx.done.catch(() => undefined);
        throw new AccountNotFoundError(id);
      }
      const updated: Account = { ...existing, ...changes, id: existing.id };
      await tx.store.put(updated);
      await tx.done;
      return updated;
    },

    async remove(id) {
      const tx = db.transaction(['accounts', 'transactions'], 'readwrite');
      const count = await countIn(await tx.objectStore('transactions').getAll(), id);
      if (count > 0) {
        tx.abort();
        await tx.done.catch(() => undefined);
        throw new AccountInUseError(count);
      }
      await tx.objectStore('accounts').delete(id);
      await tx.done;
    },

    async countTransactions(id) {
      return countIn(await db.getAll('transactions'), id);
    },
  };
}
