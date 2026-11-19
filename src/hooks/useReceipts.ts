import { useMemo } from 'react';
import { compareTransactionsNewestFirst } from '../domain/history';
import { combinedReceiptEntries, receiptEntries } from '../domain/receipts';
import type { ReceiptEntry, ReceiptListEntry } from '../domain/receipts';
import { useFinance } from './FinanceProvider';

export type UseReceiptsResult = {
  status: 'loading' | 'ready' | 'error';
  /** Exactly the transactions that have a receipt, newest first. */
  receipts: ReceiptEntry[];
  /** Receipts of transactions and of shopping lists, newest first. */
  entries: ReceiptListEntry[];
  reload: () => Promise<void>;
};

/** Derives the receipts lists from the loaded transactions and shopping lists. */
export function useReceipts(): UseReceiptsResult {
  const { status, transactions, shoppingLists, reload } = useFinance();

  const receipts = useMemo(
    () => receiptEntries(transactions).sort(compareTransactionsNewestFirst),
    [transactions],
  );
  const entries = useMemo(
    () => combinedReceiptEntries(transactions, shoppingLists),
    [transactions, shoppingLists],
  );

  const mapped = status === 'loading' ? 'loading' : status === 'ready' ? 'ready' : 'error';
  return { status: mapped, receipts, entries, reload };
}
