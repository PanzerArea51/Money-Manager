import { useCallback, useMemo } from 'react';
import { selectableAccountIds } from '../domain/accounts';
import { accountBalance } from '../domain/balance';
import { summarize } from '../domain/cashflow';
import type { CashFlowSummary } from '../domain/cashflow';
import { groupByWeek } from '../domain/history';
import type { WeekGroup } from '../domain/history';
import type {
  Account,
  LimitExceeded,
  Period,
  ReceiptChange,
  ReceiptInput,
  ReceiptMimeType,
  Result,
  Transaction,
} from '../domain/types';
import { validateReceiptFile, validateTransactionInput } from '../domain/validation';
import type { TransactionDraft } from '../domain/validation';
import type { ActionResult } from './actionResult';
import { useFinance } from './FinanceProvider';

export const AMOUNT_LIMIT_MESSAGE =
  'This change would push an account balance beyond the supported limit.';
export const SAVE_FAILED_MESSAGE = 'Could not save the transaction. Please try again.';
export const DELETE_FAILED_MESSAGE = 'Could not delete the transaction. Please try again.';
const NOT_READY_MESSAGE = 'The database is not ready yet.';
const NOT_FOUND_MESSAGE = 'This transaction no longer exists.';

export type UseTransactionsResult = {
  transactions: Transaction[];
  createTransaction(draft: TransactionDraft, file?: File): Promise<ActionResult<TransactionDraft>>;
  updateTransaction(
    id: string,
    draft: TransactionDraft,
    receiptChange: ReceiptChange,
  ): Promise<ActionResult<TransactionDraft>>;
  deleteTransaction(id: string): Promise<ActionResult>;
  history: WeekGroup[];
  cashFlow(period: Period): Result<CashFlowSummary, LimitExceeded>;
};

function affectedAccountIds(txs: readonly Transaction[]): Set<string> {
  const ids = new Set<string>();
  for (const tx of txs) {
    if (tx.kind === 'transfer') {
      ids.add(tx.fromAccountId);
      ids.add(tx.toAccountId);
    } else {
      ids.add(tx.accountId);
    }
  }
  return ids;
}

/** True if every affected account keeps a balance within range for the proposed list. */
function balancesInRange(
  accounts: readonly Account[],
  proposed: readonly Transaction[],
  touched: readonly Transaction[],
): boolean {
  const ids = affectedAccountIds(touched);
  return accounts
    .filter((account) => ids.has(account.id))
    .every((account) => accountBalance(account, proposed).ok);
}

function toReceiptInput(file: File): Result<ReceiptInput, 'unsupported-type' | 'too-large'> {
  const check = validateReceiptFile(file);
  if (!check.ok) return check;
  return {
    ok: true,
    value: {
      blob: file,
      mimeType: file.type as ReceiptMimeType,
      fileName: file.name,
      size: file.size,
    },
  };
}

export function useTransactions(): UseTransactionsResult {
  const { accounts, transactions, repos, actions } = useFinance();

  const history = useMemo(() => groupByWeek(transactions), [transactions]);

  const cashFlow = useCallback(
    (period: Period) => summarize(transactions, period),
    [transactions],
  );

  const createTransaction = useCallback<UseTransactionsResult['createTransaction']>(
    async (draft, file) => {
      if (repos === null) return { ok: false, message: NOT_READY_MESSAGE };

      const validated = validateTransactionInput(draft, selectableAccountIds(accounts));
      if (!validated.ok) {
        return { ok: false, errors: validated.error, message: 'Please fix the highlighted fields.' };
      }

      let receipt: ReceiptInput | undefined;
      if (file !== undefined) {
        const receiptResult = toReceiptInput(file);
        if (!receiptResult.ok) {
          return { ok: false, message: `Receipt rejected: ${receiptResult.error}.` };
        }
        receipt = receiptResult.value;
      }

      // Preview with a placeholder record; only ids, kind and amounts matter for balances.
      const preview = {
        ...validated.value,
        id: '',
        createdAt: '',
      } as Transaction;
      if (!balancesInRange(accounts, [...transactions, preview], [preview])) {
        return { ok: false, message: AMOUNT_LIMIT_MESSAGE };
      }

      try {
        const created = await repos.transactions.add(validated.value, receipt);
        actions.upsertTransaction(created);
        return { ok: true };
      } catch {
        return { ok: false, message: SAVE_FAILED_MESSAGE };
      }
    },
    [accounts, transactions, repos, actions],
  );

  const updateTransaction = useCallback<UseTransactionsResult['updateTransaction']>(
    async (id, draft, receiptChange) => {
      if (repos === null) return { ok: false, message: NOT_READY_MESSAGE };

      const existing = transactions.find((t) => t.id === id);
      if (existing === undefined) return { ok: false, message: NOT_FOUND_MESSAGE };

      const validated = validateTransactionInput(draft, selectableAccountIds(accounts, existing));
      if (!validated.ok) {
        return { ok: false, errors: validated.error, message: 'Please fix the highlighted fields.' };
      }

      if (receiptChange.type === 'replace') {
        const check = validateReceiptFile({
          type: receiptChange.receipt.mimeType,
          size: receiptChange.receipt.size,
        });
        if (!check.ok) return { ok: false, message: `Receipt rejected: ${check.error}.` };
      }

      const replacement = {
        ...validated.value,
        id: existing.id,
        createdAt: existing.createdAt,
      } as Transaction;
      const proposed = transactions.map((t) => (t.id === id ? replacement : t));
      if (!balancesInRange(accounts, proposed, [existing, replacement])) {
        return { ok: false, message: AMOUNT_LIMIT_MESSAGE };
      }

      try {
        const updated = await repos.transactions.update(id, validated.value, receiptChange);
        actions.upsertTransaction(updated);
        return { ok: true };
      } catch {
        return { ok: false, message: SAVE_FAILED_MESSAGE };
      }
    },
    [accounts, transactions, repos, actions],
  );

  const deleteTransaction = useCallback<UseTransactionsResult['deleteTransaction']>(
    async (id) => {
      if (repos === null) return { ok: false, message: NOT_READY_MESSAGE };

      const existing = transactions.find((t) => t.id === id);
      if (existing === undefined) return { ok: false, message: NOT_FOUND_MESSAGE };

      const proposed = transactions.filter((t) => t.id !== id);
      if (!balancesInRange(accounts, proposed, [existing])) {
        return { ok: false, message: AMOUNT_LIMIT_MESSAGE };
      }

      try {
        await repos.transactions.remove(id);
        actions.removeTransaction(id);
        return { ok: true };
      } catch {
        return { ok: false, message: DELETE_FAILED_MESSAGE };
      }
    },
    [accounts, transactions, repos, actions],
  );

  return { transactions, createTransaction, updateTransaction, deleteTransaction, history, cashFlow };
}
