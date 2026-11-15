import { describe, expect, it } from 'vitest';
import type { TransactionRepo } from '../db/transactionRepo';
import { accountBalance } from '../domain/balance';
import type { Account, Sen, Transaction } from '../domain/types';
import type { TransactionDraft } from '../domain/validation';
import { AMOUNT_LIMIT_MESSAGE, DELETE_FAILED_MESSAGE, SAVE_FAILED_MESSAGE, useTransactions } from './useTransactions';
import { createFakeFinance, renderHook } from './testing/renderHook';

const sen = (n: number) => n as Sen;

function account(id: string, openingBalance = 1000): Account {
  return {
    id,
    name: `Account ${id}`,
    type: 'cash',
    openingBalance: sen(openingBalance),
    archived: false,
    createdAt: '2025-01-01T00:00:00.000Z',
  };
}

function expense(id: string, accountId: string, amount: number): Transaction {
  return {
    id,
    kind: 'expense',
    title: 'Lunch',
    amount: sen(amount),
    date: '2025-01-02',
    time: '12:00',
    accountId,
    createdAt: '2025-01-02T12:00:00.000Z',
  };
}

function income(id: string, accountId: string, amount: number): Transaction {
  return { ...expense(id, accountId, amount), kind: 'income', title: 'Pay' } as Transaction;
}

type FakeTransactionRepo = TransactionRepo & {
  stored: Map<string, Transaction>;
  failWritesWith: Error | null;
};

function createFakeTransactionRepo(initial: Transaction[]): FakeTransactionRepo {
  const stored = new Map(initial.map((t) => [t.id, t]));
  let nextId = 1;
  const repo: FakeTransactionRepo = {
    stored,
    failWritesWith: null,
    list: async () => [...stored.values()],
    get: async (id) => stored.get(id),
    async add(input) {
      if (repo.failWritesWith) throw repo.failWritesWith;
      const created = { ...input, id: `fake-tx-${nextId++}`, createdAt: '2025-01-03T00:00:00.000Z' } as Transaction;
      stored.set(created.id, created);
      return created;
    },
    async update(id, input) {
      if (repo.failWritesWith) throw repo.failWritesWith;
      const existing = stored.get(id);
      if (!existing) throw new Error('missing');
      const updated = { ...input, id, createdAt: existing.createdAt } as Transaction;
      stored.set(id, updated);
      return updated;
    },
    async remove(id) {
      if (repo.failWritesWith) throw repo.failWritesWith;
      stored.delete(id);
    },
  };
  return repo;
}

function setup(accounts: Account[], transactions: Transaction[] = []) {
  const repo = createFakeTransactionRepo(transactions);
  const finance = createFakeFinance({ accounts, transactions, repos: { transactions: repo } });
  const { result } = renderHook(() => useTransactions(), finance);
  return { finance, repo, result };
}

const draft = (overrides: Partial<TransactionDraft> = {}): TransactionDraft => ({
  kind: 'expense',
  title: 'Coffee',
  amount: '2.50',
  date: '2025-01-05',
  time: '09:30',
  accountId: 'a',
  ...overrides,
});

const KEEP = { type: 'keep' } as const;

describe('useTransactions', () => {
  it('creates a transaction, stores it and adds it to state', async () => {
    const { repo, result } = setup([account('a')]);
    expect(await result.current.createTransaction(draft())).toEqual({ ok: true });
    expect(repo.stored.size).toBe(1);
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0]).toMatchObject({ title: 'Coffee', amount: 250, kind: 'expense' });
  });

  it('returns field errors for an invalid draft without writing', async () => {
    const { repo, result } = setup([account('a')]);
    const outcome = await result.current.createTransaction(draft({ amount: '0' }));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errors?.amount).toBeDefined();
    expect(repo.stored.size).toBe(0);
    expect(result.current.transactions).toHaveLength(0);
  });

  it('edits a transaction and keeps its id', async () => {
    const { repo, result } = setup([account('a')], [expense('t1', 'a', 100)]);
    const outcome = await result.current.updateTransaction('t1', draft({ title: 'Dinner', amount: '7' }), KEEP);
    expect(outcome).toEqual({ ok: true });
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0]).toMatchObject({ id: 't1', title: 'Dinner', amount: 700 });
    expect(repo.stored.get('t1')).toMatchObject({ title: 'Dinner', amount: 700 });
  });

  it('reports a missing transaction on edit and delete', async () => {
    const { result } = setup([account('a')]);
    expect((await result.current.updateTransaction('nope', draft(), KEEP)).ok).toBe(false);
    expect((await result.current.deleteTransaction('nope')).ok).toBe(false);
  });

  it('deletes a transaction from the store and state', async () => {
    const { repo, result } = setup([account('a')], [expense('t1', 'a', 100)]);
    expect(await result.current.deleteTransaction('t1')).toEqual({ ok: true });
    expect(repo.stored.size).toBe(0);
    expect(result.current.transactions).toHaveLength(0);
  });

  it('allows an expense that makes the balance negative', async () => {
    const { finance, result } = setup([account('a', 1000)]);
    const outcome = await result.current.createTransaction(draft({ amount: '50' }));
    expect(outcome).toEqual({ ok: true });
    const balance = accountBalance(finance.state.accounts[0] as Account, finance.state.transactions);
    expect(balance).toEqual({ ok: true, value: -4000 });
  });

  it('rejects a create that overflows the balance and writes nothing', async () => {
    const { finance, repo, result } = setup([account('a', 99_999_999_999)]);
    const outcome = await result.current.createTransaction(draft({ kind: 'income', amount: '0.01' }));
    expect(outcome).toEqual({ ok: false, message: AMOUNT_LIMIT_MESSAGE });
    expect(repo.stored.size).toBe(0);
    expect(finance.state.transactions).toHaveLength(0);
  });

  it('rejects an edit that overflows the balance and writes nothing', async () => {
    const { repo, result } = setup([account('a', 99_999_999_900)], [expense('t1', 'a', 100)]);
    const outcome = await result.current.updateTransaction(
      't1',
      draft({ kind: 'income', amount: '5' }),
      KEEP,
    );
    expect(outcome).toEqual({ ok: false, message: AMOUNT_LIMIT_MESSAGE });
    expect(repo.stored.get('t1')).toMatchObject({ kind: 'expense', amount: 100 });
    expect(result.current.transactions[0]).toMatchObject({ kind: 'expense', amount: 100 });
  });

  it('rejects a delete that overflows the balance and writes nothing', async () => {
    const { repo, result } = setup(
      [account('a', 99_999_999_999)],
      [expense('t1', 'a', 100), income('t2', 'a', 100)],
    );
    const outcome = await result.current.deleteTransaction('t1');
    expect(outcome).toEqual({ ok: false, message: AMOUNT_LIMIT_MESSAGE });
    expect(repo.stored.has('t1')).toBe(true);
    expect(result.current.transactions).toHaveLength(2);
  });

  describe('transfers', () => {
    const transferDraft = (overrides: Partial<TransactionDraft> = {}): TransactionDraft => ({
      kind: 'transfer',
      title: 'Move',
      amount: '3',
      date: '2025-01-05',
      time: '10:00',
      fromAccountId: 'a',
      toAccountId: 'b',
      ...overrides,
    });

    const balanceOf = (finance: ReturnType<typeof setup>['finance'], id: string) =>
      accountBalance(
        finance.state.accounts.find((a) => a.id === id) as Account,
        finance.state.transactions,
      );

    it('creates a transfer that moves balances, keeps the total and the week net', async () => {
      const { finance, repo, result } = setup([account('a', 1000), account('b', 500)]);
      expect(await result.current.createTransaction(transferDraft())).toEqual({ ok: true });

      expect(repo.stored.size).toBe(1);
      expect(result.current.transactions[0]).toMatchObject({
        kind: 'transfer',
        amount: 300,
        fromAccountId: 'a',
        toAccountId: 'b',
      });
      expect(balanceOf(finance, 'a')).toEqual({ ok: true, value: 700 });
      expect(balanceOf(finance, 'b')).toEqual({ ok: true, value: 800 });
      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0]?.net).toBe(0);
    });

    it('excludes transfers from week net while counting other transactions', async () => {
      const { result } = setup([account('a'), account('b')], [income('t1', 'a', 400)]);
      await result.current.createTransaction(transferDraft());
      expect(result.current.history[0]?.transactions).toHaveLength(2);
      expect(result.current.history[0]?.net).toBe(400);
      expect(result.current.history[0]?.weekStart).toBe('2024-12-30');
    });

    it('edits a transfer, moving balances to the new accounts', async () => {
      const { finance, repo, result } = setup(
        [account('a', 1000), account('b', 500), account('c', 200)],
        [
          {
            id: 't1',
            kind: 'transfer',
            title: 'Move',
            amount: sen(300),
            date: '2025-01-05',
            time: '10:00',
            fromAccountId: 'a',
            toAccountId: 'b',
            createdAt: '2025-01-05T10:00:00.000Z',
          },
        ],
      );
      const outcome = await result.current.updateTransaction(
        't1',
        transferDraft({ amount: '5', toAccountId: 'c' }),
        KEEP,
      );
      expect(outcome).toEqual({ ok: true });
      expect(repo.stored.get('t1')).toMatchObject({ amount: 500, fromAccountId: 'a', toAccountId: 'c' });
      expect(balanceOf(finance, 'a')).toEqual({ ok: true, value: 500 });
      expect(balanceOf(finance, 'b')).toEqual({ ok: true, value: 500 });
      expect(balanceOf(finance, 'c')).toEqual({ ok: true, value: 700 });
    });

    it('rejects a same-account transfer on create and edit, leaving balances unchanged', async () => {
      const { finance, repo, result } = setup([account('a', 1000), account('b', 500)]);
      const created = await result.current.createTransaction(transferDraft({ toAccountId: 'a' }));
      expect(created.ok).toBe(false);
      if (!created.ok) expect(created.errors?.toAccountId).toBe('same-account');
      expect(repo.stored.size).toBe(0);

      await result.current.createTransaction(transferDraft());
      const id = [...repo.stored.keys()][0] as string;
      const edited = await result.current.updateTransaction(id, transferDraft({ toAccountId: 'a' }), KEEP);
      expect(edited.ok).toBe(false);
      if (!edited.ok) expect(edited.errors?.toAccountId).toBe('same-account');

      expect(repo.stored.get(id)).toMatchObject({ fromAccountId: 'a', toAccountId: 'b', amount: 300 });
      expect(balanceOf(finance, 'a')).toEqual({ ok: true, value: 700 });
      expect(balanceOf(finance, 'b')).toEqual({ ok: true, value: 800 });
    });
  });

  it('leaves state unchanged when a write fails', async () => {
    const { finance, repo, result } = setup([account('a')], [expense('t1', 'a', 100)]);
    const before = finance.state.transactions;
    repo.failWritesWith = new Error('disk full');

    expect(await result.current.createTransaction(draft())).toEqual({ ok: false, message: SAVE_FAILED_MESSAGE });
    expect(await result.current.updateTransaction('t1', draft({ title: 'X' }), KEEP)).toEqual({
      ok: false,
      message: SAVE_FAILED_MESSAGE,
    });
    expect(await result.current.deleteTransaction('t1')).toEqual({ ok: false, message: DELETE_FAILED_MESSAGE });

    expect(finance.state.transactions).toBe(before);
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0]).toMatchObject({ id: 't1', title: 'Lunch' });
  });
});
