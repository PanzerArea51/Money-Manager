import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Account, ShoppingList, Transaction } from '../domain/types';
import { openFinanceDb } from '../db/database';
import type { FinanceDb } from '../db/database';
import { createAccountRepo } from '../db/accountRepo';
import type { AccountRepo } from '../db/accountRepo';
import { createTransactionRepo } from '../db/transactionRepo';
import type { TransactionRepo } from '../db/transactionRepo';
import { createShoppingRepo } from '../db/shoppingRepo';
import type { ShoppingRepo } from '../db/shoppingRepo';
import { createReceiptRepo } from '../db/receiptRepo';
import type { ReceiptRepo } from '../db/receiptRepo';
import { useStoragePersistence } from './useStoragePersistence';

export type LoadStatus = 'loading' | 'ready' | 'error' | 'fatal';

export type FinanceRepos = {
  accounts: AccountRepo;
  transactions: TransactionRepo;
  receipts: ReceiptRepo;
  shopping: ShoppingRepo;
};

/**
 * State updaters. Call them only after the matching repository write succeeded,
 * so displayed state never diverges from stored state.
 */
export type FinanceActions = {
  upsertAccount(account: Account): void;
  removeAccount(id: string): void;
  upsertTransaction(transaction: Transaction): void;
  removeTransaction(id: string): void;
  upsertShoppingList(list: ShoppingList): void;
  removeShoppingList(id: string): void;
};

export type FinanceContextValue = {
  status: LoadStatus;
  accounts: Account[];
  transactions: Transaction[];
  shoppingLists: ShoppingList[];
  persistenceDenied: boolean;
  /** `null` until the database has opened. */
  repos: FinanceRepos | null;
  reload(): Promise<void>;
  /** Deletes every stored record and clears the displayed state. Throws if the write fails. */
  resetAll(): Promise<void>;
  actions: FinanceActions;
};

/** Exported so tests can supply a fake value without opening IndexedDB. */
export const FinanceContext = createContext<FinanceContextValue | null>(null);

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const persistenceDenied = useStoragePersistence();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [repos, setRepos] = useState<FinanceRepos | null>(null);
  const dbRef = useRef<FinanceDb | null>(null);
  const reposRef = useRef<FinanceRepos | null>(null);
  const runId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = ++runId.current;
    const isCurrent = () => runId.current === id;
    setStatus('loading');

    if (reposRef.current === null) {
      try {
        const db = await openFinanceDb();
        if (!isCurrent()) {
          db.close();
          return;
        }
        dbRef.current = db;
        reposRef.current = {
          accounts: createAccountRepo(db),
          transactions: createTransactionRepo(db),
          receipts: createReceiptRepo(db),
          shopping: createShoppingRepo(db),
        };
        setRepos(reposRef.current);
      } catch {
        if (isCurrent()) setStatus('fatal');
        return;
      }
    }

    try {
      const current = reposRef.current;
      if (current === null) return;
      const [loadedAccounts, loadedTransactions, loadedLists] = await Promise.all([
        current.accounts.list(),
        current.transactions.list(),
        current.shopping.list(),
      ]);
      if (!isCurrent()) return;
      setAccounts(loadedAccounts);
      setTransactions(loadedTransactions);
      setShoppingLists(loadedLists);
      setStatus('ready');
    } catch {
      if (isCurrent()) setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      runId.current++;
      dbRef.current?.close();
      dbRef.current = null;
      reposRef.current = null;
      setRepos(null);
    };
  }, [load]);

  const resetAll = useCallback(async (): Promise<void> => {
    const db = dbRef.current;
    if (db === null) throw new Error('Database is not open');
    const tx = db.transaction(['accounts', 'transactions', 'receipts', 'shoppingLists'], 'readwrite');
    await Promise.all([
      tx.objectStore('accounts').clear(),
      tx.objectStore('transactions').clear(),
      tx.objectStore('receipts').clear(),
      tx.objectStore('shoppingLists').clear(),
      tx.done,
    ]);
    setAccounts([]);
    setTransactions([]);
    setShoppingLists([]);
  }, []);

  const actions = useMemo<FinanceActions>(
    () => ({
      upsertAccount: (account) => setAccounts((list) => upsertById(list, account)),
      removeAccount: (id) => setAccounts((list) => list.filter((a) => a.id !== id)),
      upsertTransaction: (transaction) =>
        setTransactions((list) => upsertById(list, transaction)),
      removeTransaction: (id) => setTransactions((list) => list.filter((t) => t.id !== id)),
      upsertShoppingList: (list) => setShoppingLists((lists) => upsertById(lists, list)),
      removeShoppingList: (id) => setShoppingLists((lists) => lists.filter((l) => l.id !== id)),
    }),
    [],
  );

  const value = useMemo<FinanceContextValue>(
    () => ({
      status,
      accounts,
      transactions,
      shoppingLists,
      persistenceDenied,
      repos,
      reload: load,
      resetAll,
      actions,
    }),
    [status, accounts, transactions, shoppingLists, persistenceDenied, repos, load, resetAll, actions],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const value = useContext(FinanceContext);
  if (value === null) {
    throw new Error('useFinance must be used inside FinanceProvider');
  }
  return value;
}
