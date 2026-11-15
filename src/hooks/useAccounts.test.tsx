import { describe, expect, it } from 'vitest';
import { AccountInUseError } from '../db/accountRepo';
import type { Account, Sen, Transaction } from '../domain/types';
import { useAccounts } from './useAccounts';
import { createFakeFinance, renderHook } from './testing/renderHook';

const sen = (n: number) => n as Sen;

function account(id: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    name: `Account ${id}`,
    type: 'cash',
    openingBalance: sen(1000),
    archived: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function expense(accountId: string, amount: number): Transaction {
  return {
    id: `tx-${accountId}`,
    kind: 'expense',
    title: 'Lunch',
    amount: sen(amount),
    date: '2025-01-02',
    time: '12:00',
    accountId,
    createdAt: '2025-01-02T12:00:00.000Z',
  };
}

const DRAFT = { name: '  Wallet ', type: 'cash', startingBalance: '12.50' };

function setup(init: Parameters<typeof createFakeFinance>[0] = {}) {
  const finance = createFakeFinance(init);
  const { result } = renderHook(() => useAccounts(), finance);
  return { finance, result };
}

describe('useAccounts', () => {
  it('derives balances and splits active from archived', () => {
    const { result } = setup({
      accounts: [account('a'), account('b', { archived: true })],
      transactions: [expense('a', 250)],
    });
    expect(result.current.active.map((a) => a.id)).toEqual(['a']);
    expect(result.current.archived.map((a) => a.id)).toEqual(['b']);
    expect(result.current.active[0]?.balance).toEqual({ ok: true, value: 750 });
    expect(result.current.combined).toEqual({ ok: true, value: 750 });
  });

  it('reports balances as unavailable when data is not ready', () => {
    const { result } = setup({ status: 'error', accounts: [account('a')] });
    expect(result.current.active[0]?.balance).toBe('unavailable');
    expect(result.current.combined).toBe('unavailable');
  });

  it('creates an account and adds it to state', async () => {
    const { finance, result } = setup();
    const outcome = await result.current.createAccount(DRAFT);
    expect(outcome).toEqual({ ok: true });
    expect(finance.accountRepo.stored.size).toBe(1);
    expect(result.current.active).toHaveLength(1);
    expect(result.current.active[0]).toMatchObject({ name: 'Wallet', openingBalance: 1250 });
  });

  it('returns field errors for an invalid draft without writing', async () => {
    const { finance, result } = setup();
    const outcome = await result.current.createAccount({ ...DRAFT, name: '   ' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errors?.name).toBeDefined();
    expect(finance.accountRepo.stored.size).toBe(0);
    expect(result.current.active).toHaveLength(0);
  });

  it('edits an account and keeps its id', async () => {
    const { result } = setup({ accounts: [account('a')] });
    const outcome = await result.current.updateAccount('a', {
      name: 'Renamed',
      type: 'bank',
      startingBalance: '20',
    });
    expect(outcome).toEqual({ ok: true });
    expect(result.current.active).toHaveLength(1);
    expect(result.current.active[0]).toMatchObject({
      id: 'a',
      name: 'Renamed',
      type: 'bank',
      openingBalance: 2000,
    });
  });

  it('archives and then restores an account', async () => {
    const { result } = setup({ accounts: [account('a')] });
    expect(await result.current.archiveAccount('a')).toEqual({ ok: true });
    expect(result.current.active).toHaveLength(0);
    expect(result.current.archived.map((a) => a.id)).toEqual(['a']);

    expect(await result.current.restoreAccount('a')).toEqual({ ok: true });
    expect(result.current.active.map((a) => a.id)).toEqual(['a']);
    expect(result.current.archived).toHaveLength(0);
  });

  it('deletes an account that has no transactions', async () => {
    const { finance, result } = setup({ accounts: [account('a')] });
    expect(await result.current.deleteAccount('a')).toEqual({ ok: true });
    expect(finance.accountRepo.stored.size).toBe(0);
    expect(result.current.active).toHaveLength(0);
  });

  it('blocks deleting an account that has transactions and reports the count', async () => {
    const { finance, result } = setup({
      accounts: [account('a')],
      transactions: [expense('a', 100)],
    });
    const outcome = await result.current.deleteAccount('a');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.blockingCount).toBe(1);
    expect(finance.accountRepo.stored.has('a')).toBe(true);
    expect(result.current.active.map((a) => a.id)).toEqual(['a']);
  });

  it('blocks delete when the repository refuses with AccountInUseError', async () => {
    const { finance, result } = setup({ accounts: [account('a')] });
    finance.accountRepo.failWritesWith = new AccountInUseError(3);
    const outcome = await result.current.deleteAccount('a');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.blockingCount).toBe(3);
    expect(result.current.active.map((a) => a.id)).toEqual(['a']);
  });

  it('leaves state unchanged when a write fails', async () => {
    const { finance, result } = setup({ accounts: [account('a')] });
    const before = finance.state.accounts;
    finance.accountRepo.failWritesWith = new Error('disk full');

    const results = [
      await result.current.createAccount(DRAFT),
      await result.current.updateAccount('a', { ...DRAFT, name: 'Nope' }),
      await result.current.archiveAccount('a'),
      await result.current.deleteAccount('a'),
    ];

    for (const r of results) expect(r.ok).toBe(false);
    expect(finance.state.accounts).toBe(before);
    expect(result.current.active).toHaveLength(1);
    expect(result.current.active[0]?.name).toBe('Account a');
    expect(result.current.archived).toHaveLength(0);
  });

  it('refuses a create that would push the combined balance out of range', async () => {
    const { finance, result } = setup({
      accounts: [account('a', { openingBalance: sen(99_999_999_999) })],
    });
    const outcome = await result.current.createAccount({ ...DRAFT, startingBalance: '1.00' });
    expect(outcome.ok).toBe(false);
    expect(finance.accountRepo.stored.size).toBe(1);
  });

  it('refuses writes while data is not ready', async () => {
    const { finance, result } = setup({ status: 'loading' });
    const outcome = await result.current.createAccount(DRAFT);
    expect(outcome.ok).toBe(false);
    expect(finance.accountRepo.stored.size).toBe(0);
  });
});
