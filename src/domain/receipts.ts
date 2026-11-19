import type { LocalDate, Sen, ShoppingList, Transaction } from './types';

export type ReceiptEntry = Transaction & { receiptId: string };

/** One row of the Receipts tab: a receipt owned by a transaction or a shopping list. */
export type ReceiptListEntry =
  | {
      source: 'transaction';
      key: string;
      title: string;
      date: LocalDate;
      createdAt: string;
      amount: Sen;
      receiptId: string;
      transaction: Transaction;
    }
  | {
      source: 'shopping';
      key: string;
      title: string;
      date: LocalDate;
      createdAt: string;
      /** Undefined when the list has no price. */
      amount: Sen | undefined;
      receiptId: string;
      list: ShoppingList;
    };

function completedExpenseHasReceipt(
  list: ShoppingList,
  transactions: readonly Transaction[],
): boolean {
  if (list.transactionId === undefined) return false;
  const tx = transactions.find((t) => t.id === list.transactionId);
  return tx !== undefined && tx.receiptId !== undefined && tx.receiptId !== '';
}

function compareEntriesNewestFirst(a: ReceiptListEntry, b: ReceiptListEntry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.key !== b.key) return a.key < b.key ? 1 : -1;
  return 0;
}

/** Every receipt owned by a transaction or a shopping list, newest first. */
export function combinedReceiptEntries(
  transactions: readonly Transaction[],
  shoppingLists: readonly ShoppingList[],
): ReceiptListEntry[] {
  const entries: ReceiptListEntry[] = [];
  for (const transaction of receiptEntries(transactions)) {
    entries.push({
      source: 'transaction',
      key: `transaction:${transaction.id}`,
      title: transaction.title,
      date: transaction.date,
      createdAt: transaction.createdAt,
      amount: transaction.amount,
      receiptId: transaction.receiptId,
      transaction,
    });
  }
  for (const list of shoppingLists) {
    if (list.receiptId === undefined || list.receiptId === '') continue;
    // A completed list's receipt is copied onto its expense; show that one only.
    if (completedExpenseHasReceipt(list, transactions)) continue;
    entries.push({
      source: 'shopping',
      key: `shopping:${list.id}`,
      title: list.title,
      date: list.date,
      createdAt: list.createdAt,
      amount: list.price,
      receiptId: list.receiptId,
      list,
    });
  }
  return entries.sort(compareEntriesNewestFirst);
}

/** Returns exactly the transactions that have a receipt, in input order. */
export function receiptEntries(transactions: readonly Transaction[]): ReceiptEntry[] {
  return transactions.filter(
    (t): t is ReceiptEntry => t.receiptId !== undefined && t.receiptId !== '',
  );
}
