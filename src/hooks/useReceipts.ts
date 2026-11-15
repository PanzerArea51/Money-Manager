import { useMemo } from 'react';
import { compareTransactionsNewestFirst } from '../domain/history';
import { receiptEntries } from '../domain/receipts';
import type { ReceiptEntry } from '../domain/receipts';
import { useFinance } from './FinanceProvider';

export type UseReceiptsResult = {
  status: 'loading' | 'ready' | 'error';
  /** Exactly the transactions that have a receipt, newest first. */
  receipts: ReceiptEntry[];
  reload: () => Promise<void>;
};

/** Derives the receipts list from the loaded transactions. */
export function useReceipts(): UseReceiptsResult {
  const { status, transactions, reload } = useFinance();

  const receipts = useMemo(
    () => receiptEntries(transactions).sort(compareTransactionsNewestFirst),
    [transactions],
  );

  const mapped = status === 'loading' ? 'loading' : status === 'ready' ? 'ready' : 'error';
  return { status: mapped, receipts, reload };
}
