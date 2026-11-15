import type { Transaction } from './types';

export type ReceiptEntry = Transaction & { receiptId: string };

/** Returns exactly the transactions that have a receipt, in input order. */
export function receiptEntries(transactions: readonly Transaction[]): ReceiptEntry[] {
  return transactions.filter(
    (t): t is ReceiptEntry => t.receiptId !== undefined && t.receiptId !== '',
  );
}
