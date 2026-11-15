import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import type { Account, Receipt, Transaction } from '../domain/types';

export const DB_NAME = 'finance-tracker';
export const DB_VERSION = 1;

export interface FinanceSchema extends DBSchema {
  accounts: {
    key: string;
    value: Account;
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { date: string; accountId: string };
  };
  receipts: {
    key: string;
    value: Receipt;
  };
}

export type FinanceDb = IDBPDatabase<FinanceSchema>;

export type MigrationTransaction = IDBPTransaction<
  FinanceSchema,
  StoreNames<FinanceSchema>[],
  'versionchange'
>;

/** Upgrades the schema from version `n - 1` to `n`; stored at `migrations[n]`. */
export type Migration = (db: FinanceDb, tx: MigrationTransaction) => void | Promise<void>;

export class DbOpenError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'DbOpenError';
    this.cause = cause;
  }
}

/** Index 0 is unused so that `migrations[n]` upgrades to version `n`. */
export const migrations: readonly (Migration | undefined)[] = [
  undefined,
  (db) => {
    db.createObjectStore('accounts', { keyPath: 'id' });
    const transactions = db.createObjectStore('transactions', { keyPath: 'id' });
    transactions.createIndex('date', 'date');
    transactions.createIndex('accountId', 'accountId');
    db.createObjectStore('receipts', { keyPath: 'id' });
  },
];

export type OpenFinanceDbOptions = {
  name?: string;
  version?: number;
  migrations?: readonly (Migration | undefined)[];
};

/**
 * Opens the database, running every migration between the stored version and
 * the target version inside the versionchange transaction. A throwing migration
 * aborts that transaction, so the previous data stays intact, and the promise
 * rejects with `DbOpenError`.
 */
export async function openFinanceDb(options: OpenFinanceDbOptions = {}): Promise<FinanceDb> {
  const name = options.name ?? DB_NAME;
  const version = options.version ?? DB_VERSION;
  const steps = options.migrations ?? migrations;

  if (typeof indexedDB === 'undefined') {
    throw new DbOpenError('IndexedDB is not available');
  }

  // idb ignores the promise returned by `upgrade`, so a rethrown error would be
  // an unhandled rejection. Record it, abort, and surface it as the cause instead.
  let migrationError: unknown;

  try {
    return await openDB<FinanceSchema>(name, version, {
      async upgrade(db, oldVersion, newVersion, tx) {
        const target = newVersion ?? version;
        try {
          for (let v = oldVersion + 1; v <= target; v++) {
            const step = steps[v];
            if (!step) throw new Error(`Missing migration for version ${v}`);
            await step(db, tx);
          }
        } catch (error) {
          migrationError = error;
          // tx.done rejects with AbortError; the open call reports the failure.
          tx.done.catch(() => undefined);
          try {
            tx.abort();
          } catch {
            // Already finished or aborted.
          }
        }
      },
      blocked() {
        // Another tab holds an older version open; the open stays pending until it closes.
      },
      terminated() {
        // Connection closed abnormally; callers will see failures on the next operation.
      },
    });
  } catch (error) {
    throw new DbOpenError('Could not open the database', migrationError ?? error);
  }
}
