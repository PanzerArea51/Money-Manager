import { useCallback, useMemo } from 'react';
import { blockingTransactionCount } from '../domain/accounts';
import { accountBalance, combinedBalance } from '../domain/balance';
import type { Account, LimitExceeded, Result, Sen } from '../domain/types';
import { validateAccountInput } from '../domain/validation';
import type { AccountDraft } from '../domain/validation';
import { AccountInUseError } from '../db/accountRepo';
import type { ActionResult } from './actionResult';
import { useFinance } from './FinanceProvider';

/** `'unavailable'` when transactions could not be read, so no balance can be shown. */
export type BalanceState = Result<Sen, LimitExceeded> | 'unavailable';

export type AccountWithBalance = Account & { balance: BalanceState };

export type AccountActionResult = ActionResult<AccountDraft>;

export type UseAccounts = {
  active: AccountWithBalance[];
  archived: AccountWithBalance[];
  combined: BalanceState;
  createAccount(draft: AccountDraft): Promise<AccountActionResult>;
  updateAccount(id: string, draft: AccountDraft): Promise<AccountActionResult>;
  archiveAccount(id: string): Promise<AccountActionResult>;
  restoreAccount(id: string): Promise<AccountActionResult>;
  deleteAccount(id: string): Promise<AccountActionResult>;
};

const OK = { ok: true } as const;
const NOT_READY = { ok: false, message: 'Data is not available yet. Try again in a moment.' } as const;
const NOT_FOUND = { ok: false, message: 'That account no longer exists.' } as const;
const LIMIT_MESSAGE =
  'This change would push a balance outside the supported range (about RM 999,999,999.99).';

function fail(message: string): AccountActionResult {
  return { ok: false, message };
}

export function useAccounts(): UseAccounts {
  const { status, accounts, transactions, repos, actions } = useFinance();

  const readable = status === 'ready';

  const withBalances = useMemo<AccountWithBalance[]>(
    () =>
      accounts.map((account) => ({
        ...account,
        balance: readable ? accountBalance(account, transactions) : 'unavailable',
      })),
    [accounts, transactions, readable],
  );

  const active = useMemo(() => withBalances.filter((a) => !a.archived), [withBalances]);
  const archived = useMemo(() => withBalances.filter((a) => a.archived), [withBalances]);

  const combined = useMemo<BalanceState>(
    () => (readable ? combinedBalance(accounts, transactions) : 'unavailable'),
    [accounts, transactions, readable],
  );

  /** True when the replacement keeps the account's and the combined balance in range. */
  const withinLimits = useCallback(
    (replacement: Account): boolean => {
      const next = accounts.map((a) => (a.id === replacement.id ? replacement : a));
      return accountBalance(replacement, transactions).ok && combinedBalance(next, transactions).ok;
    },
    [accounts, transactions],
  );

  const createAccount = useCallback(
    async (draft: AccountDraft): Promise<AccountActionResult> => {
      if (!readable || repos === null) return NOT_READY;
      const parsed = validateAccountInput(draft);
      if (!parsed.ok) {
        return { ok: false, errors: parsed.error, message: 'Check the highlighted fields.' };
      }
      const candidate: Account = {
        id: '',
        ...parsed.value,
        archived: false,
        createdAt: '',
      };
      if (!combinedBalance([...accounts, candidate], transactions).ok) return fail(LIMIT_MESSAGE);
      try {
        actions.upsertAccount(await repos.accounts.add(parsed.value));
        return OK;
      } catch {
        return fail('The account could not be saved.');
      }
    },
    [readable, repos, accounts, transactions, actions],
  );

  const updateAccount = useCallback(
    async (id: string, draft: AccountDraft): Promise<AccountActionResult> => {
      if (!readable || repos === null) return NOT_READY;
      const existing = accounts.find((a) => a.id === id);
      if (!existing) return NOT_FOUND;
      const parsed = validateAccountInput(draft);
      if (!parsed.ok) {
        return { ok: false, errors: parsed.error, message: 'Check the highlighted fields.' };
      }
      if (!withinLimits({ ...existing, ...parsed.value })) return fail(LIMIT_MESSAGE);
      try {
        actions.upsertAccount(await repos.accounts.update(id, parsed.value));
        return OK;
      } catch {
        return fail('The changes could not be saved.');
      }
    },
    [readable, repos, accounts, actions, withinLimits],
  );

  const setArchived = useCallback(
    async (id: string, value: boolean): Promise<AccountActionResult> => {
      if (!readable || repos === null) return NOT_READY;
      const existing = accounts.find((a) => a.id === id);
      if (!existing) return NOT_FOUND;
      if (existing.archived === value) return OK;
      if (!value && !withinLimits({ ...existing, archived: false })) return fail(LIMIT_MESSAGE);
      try {
        actions.upsertAccount(await repos.accounts.update(id, { archived: value }));
        return OK;
      } catch {
        return fail(
          value ? 'The account could not be archived.' : 'The account could not be restored.',
        );
      }
    },
    [readable, repos, accounts, actions, withinLimits],
  );

  const archiveAccount = useCallback((id: string) => setArchived(id, true), [setArchived]);
  const restoreAccount = useCallback((id: string) => setArchived(id, false), [setArchived]);

  const deleteAccount = useCallback(
    async (id: string): Promise<AccountActionResult> => {
      if (!readable || repos === null) return NOT_READY;
      if (!accounts.some((a) => a.id === id)) return NOT_FOUND;
      const blocked = (count: number): AccountActionResult => ({
        ok: false,
        blockingCount: count,
        message: `This account has ${count} transaction${count === 1 ? '' : 's'}, so it cannot be deleted. Archive it instead.`,
      });
      const count = blockingTransactionCount(id, transactions);
      if (count > 0) return blocked(count);
      try {
        await repos.accounts.remove(id);
        actions.removeAccount(id);
        return OK;
      } catch (error) {
        if (error instanceof AccountInUseError) return blocked(error.count);
        return fail('The account could not be deleted.');
      }
    },
    [readable, repos, accounts, transactions, actions],
  );

  return {
    active,
    archived,
    combined,
    createAccount,
    updateAccount,
    archiveAccount,
    restoreAccount,
    deleteAccount,
  };
}
