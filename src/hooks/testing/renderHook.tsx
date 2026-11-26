import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Account, ShoppingList, Transaction } from '../../domain/types';
import { AccountInUseError, AccountNotFoundError } from '../../db/accountRepo';
import type { AccountRepo } from '../../db/accountRepo';
import type { TransactionRepo } from '../../db/transactionRepo';
import type { ReceiptRepo } from '../../db/receiptRepo';
import type { ShoppingRepo } from '../../db/shoppingRepo';
import { FinanceContext } from '../FinanceProvider';
import type { FinanceActions, FinanceContextValue, FinanceRepos, LoadStatus } from '../FinanceProvider';

/**
 * Test helpers for hooks built on `useFinance`. They need no DOM and no extra
 * dependencies: the hook is rendered with `react-dom/server` inside a fake
 * `FinanceContext`. Each state change re-renders, so `result.current` always
 * holds the latest hook value. Effects do not run, which is fine because the
 * hooks under test only read context.
 */

export type FakeFinanceInit = {
  status?: LoadStatus;
  accounts?: Account[];
  transactions?: Transaction[];
  shoppingLists?: ShoppingList[];
  repos?: Partial<FinanceRepos>;
};

export type FakeFinance = {
  /** Current fake state. Change it through `actions` or `set`. */
  state: {
    status: LoadStatus;
    accounts: Account[];
    transactions: Transaction[];
    shoppingLists: ShoppingList[];
  };
  repos: FinanceRepos;
  /** The in-memory account repo, with a switch to make writes fail. */
  accountRepo: FakeAccountRepo;
  /** Replace state from the test and re-render. */
  set(patch: Partial<FakeFinance['state']>): void;
  /** Called after every state change; used by `renderHook`. */
  subscribe(listener: () => void): () => void;
  value(): FinanceContextValue;
};

export type FakeAccountRepo = AccountRepo & {
  /** When set, `add`, `update` and `remove` reject with this error. */
  failWritesWith: Error | null;
  /** Accounts as stored, independent of what the hook state shows. */
  stored: Map<string, Account>;
};

function createFakeAccountRepo(initial: Account[]): FakeAccountRepo {
  const stored = new Map(initial.map((a) => [a.id, a]));
  let nextId = 1;
  const repo: FakeAccountRepo = {
    failWritesWith: null,
    stored,
    list: async () => [...stored.values()],
    get: async (id) => stored.get(id),
    async add(input) {
      if (repo.failWritesWith) throw repo.failWritesWith;
      const account: Account = {
        id: `fake-account-${nextId++}`,
        ...input,
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      stored.set(account.id, account);
      return account;
    },
    async update(id, changes) {
      if (repo.failWritesWith) throw repo.failWritesWith;
      const existing = stored.get(id);
      if (!existing) throw new AccountNotFoundError(id);
      const updated: Account = { ...existing, ...changes, id: existing.id };
      stored.set(id, updated);
      return updated;
    },
    async remove(id) {
      if (repo.failWritesWith) throw repo.failWritesWith;
      stored.delete(id);
    },
    countTransactions: async () => 0,
  };
  return repo;
}

function unsupported(name: string): never {
  throw new Error(`Fake ${name} is not configured; pass it in FakeFinanceInit.repos`);
}

const DEFAULT_TRANSACTION_REPO: TransactionRepo = {
  list: async () => [],
  get: async () => undefined,
  add: async () => unsupported('transactions.add'),
  update: async () => unsupported('transactions.update'),
  remove: async () => unsupported('transactions.remove'),
};

const DEFAULT_RECEIPT_REPO: ReceiptRepo = { get: async () => undefined };

const DEFAULT_SHOPPING_REPO: ShoppingRepo = {
  list: async () => [],
  add: async () => unsupported('shopping.add'),
  update: async () => unsupported('shopping.update'),
  remove: async () => unsupported('shopping.remove'),
  complete: async () => unsupported('shopping.complete'),
};

export function createFakeFinance(init: FakeFinanceInit = {}): FakeFinance {
  const state = {
    status: init.status ?? 'ready',
    accounts: init.accounts ?? [],
    transactions: init.transactions ?? [],
    shoppingLists: init.shoppingLists ?? [],
  };
  const accountRepo = createFakeAccountRepo(state.accounts);
  const repos: FinanceRepos = {
    accounts: init.repos?.accounts ?? accountRepo,
    transactions: init.repos?.transactions ?? DEFAULT_TRANSACTION_REPO,
    receipts: init.repos?.receipts ?? DEFAULT_RECEIPT_REPO,
    shopping: init.repos?.shopping ?? DEFAULT_SHOPPING_REPO,
  };
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
    list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

  const actions: FinanceActions = {
    upsertAccount(account) {
      state.accounts = upsert(state.accounts, account);
      notify();
    },
    removeAccount(id) {
      state.accounts = state.accounts.filter((a) => a.id !== id);
      notify();
    },
    upsertTransaction(transaction) {
      state.transactions = upsert(state.transactions, transaction);
      notify();
    },
    removeTransaction(id) {
      state.transactions = state.transactions.filter((t) => t.id !== id);
      notify();
    },
    upsertShoppingList(list) {
      state.shoppingLists = upsert(state.shoppingLists, list);
      notify();
    },
    removeShoppingList(id) {
      state.shoppingLists = state.shoppingLists.filter((l) => l.id !== id);
      notify();
    },
  };

  return {
    state,
    repos,
    accountRepo,
    set(patch) {
      Object.assign(state, patch);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    value: () => ({
      status: state.status,
      accounts: state.accounts,
      transactions: state.transactions,
      shoppingLists: state.shoppingLists,
      persistenceDenied: false,
      repos,
      reload: async () => undefined,
      resetAll: async () => undefined,
      actions,
    }),
  };
}

export type RenderHookResult<T> = {
  /** Latest hook return value, refreshed after every state change. */
  result: { current: T };
  /** Stop listening to state changes. */
  unmount(): void;
};

/** Renders `hook` inside a fake `FinanceContext` and keeps `result.current` up to date. */
export function renderHook<T>(hook: () => T, finance: FakeFinance): RenderHookResult<T> {
  const result = { current: undefined as T };

  function Probe() {
    result.current = hook();
    return null;
  }

  const render = () => {
    renderToStaticMarkup(
      createElement(FinanceContext.Provider, { value: finance.value() }, createElement(Probe)),
    );
  };

  render();
  const unsubscribe = finance.subscribe(render);
  return { result, unmount: unsubscribe };
}
