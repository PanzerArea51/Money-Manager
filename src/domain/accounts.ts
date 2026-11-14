import type { Account, Transaction } from './types';

function referencedAccountIds(tx: Transaction): string[] {
  return tx.kind === 'transfer' ? [tx.fromAccountId, tx.toAccountId] : [tx.accountId];
}

/**
 * IDs of accounts a transaction may use: all active accounts, plus the accounts
 * the edited transaction already references (even if archived).
 */
export function selectableAccountIds(
  accounts: readonly Account[],
  editedTransaction?: Transaction,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const account of accounts) {
    if (!account.archived) ids.add(account.id);
  }
  if (editedTransaction) {
    for (const id of referencedAccountIds(editedTransaction)) ids.add(id);
  }
  return ids;
}

/** Number of transactions that reference the account (accountId, fromAccountId or toAccountId). */
export function blockingTransactionCount(
  accountId: string,
  transactions: readonly Transaction[],
): number {
  let count = 0;
  for (const tx of transactions) {
    if (referencedAccountIds(tx).includes(accountId)) count += 1;
  }
  return count;
}
