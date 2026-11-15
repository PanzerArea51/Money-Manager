import { isSen } from './money';
import type { Account, LimitExceeded, Result, Sen, Transaction } from './types';

const LIMIT_EXCEEDED: { ok: false; error: LimitExceeded } = { ok: false, error: 'limit-exceeded' };

/** Signed effect of one transaction on one account (0 if unrelated). */
function effectOn(accountId: string, tx: Transaction): number {
  switch (tx.kind) {
    case 'income':
      return tx.accountId === accountId ? tx.amount : 0;
    case 'expense':
      return tx.accountId === accountId ? -tx.amount : 0;
    case 'transfer': {
      let effect = 0;
      if (tx.toAccountId === accountId) effect += tx.amount;
      if (tx.fromAccountId === accountId) effect -= tx.amount;
      return effect;
    }
  }
}

/**
 * Opening balance plus signed effects of all transactions touching the account.
 * Sums exactly (each term is within +/- MAX_SEN, so the running total stays a safe
 * integer) and range-checks the final value, so the result does not depend on
 * transaction order.
 */
export function accountBalance(
  account: Account,
  txs: readonly Transaction[],
): Result<Sen, LimitExceeded> {
  let total: number = account.openingBalance;
  for (const tx of txs) total += effectOn(account.id, tx);
  return isSen(total) ? { ok: true, value: total } : LIMIT_EXCEEDED;
}

/** Sum of balances of non-archived accounts. Errors if any balance or the sum leaves range. */
export function combinedBalance(
  accounts: readonly Account[],
  txs: readonly Transaction[],
): Result<Sen, LimitExceeded> {
  let total = 0;
  for (const account of accounts) {
    if (account.archived) continue;
    const balance = accountBalance(account, txs);
    if (!balance.ok) return balance;
    total += balance.value;
  }
  return isSen(total) ? { ok: true, value: total } : LIMIT_EXCEEDED;
}
