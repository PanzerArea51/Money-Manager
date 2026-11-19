import type {
  ReceiptChange,
  ReceiptInput,
  ShoppingList,
  ShoppingListInput,
  Transaction,
  TransactionInput,
} from '../domain/types';
import type { FinanceDb } from './database';
import { abortQuietly, buildTransaction, toReceipt } from './transactionRepo';

export class ShoppingListNotFoundError extends Error {
  constructor(id: string) {
    super(`Shopping list not found: ${id}`);
    this.name = 'ShoppingListNotFoundError';
  }
}

export class ShoppingListAlreadyCompletedError extends Error {
  constructor(id: string) {
    super(`Shopping list already completed: ${id}`);
    this.name = 'ShoppingListAlreadyCompletedError';
  }
}

/** Receipt writes happen here, in the same IndexedDB transaction as the list, so they stay atomic. */
export interface ShoppingRepo {
  list(): Promise<ShoppingList[]>;
  add(input: ShoppingListInput, receipt?: ReceiptInput): Promise<ShoppingList>;
  update(id: string, input: ShoppingListInput, receipt: ReceiptChange): Promise<ShoppingList>;
  remove(id: string): Promise<void>;
  /**
   * Creates the expense and links it to the list in one IndexedDB transaction.
   * The list's receipt, if any, is copied so the expense owns an independent one.
   */
  complete(id: string, expense: TransactionInput): Promise<{ list: ShoppingList; transaction: Transaction }>;
}

function buildList(
  id: string,
  createdAt: string,
  receiptId: string | undefined,
  input: ShoppingListInput,
  transactionId?: string,
): ShoppingList {
  return {
    id,
    title: input.title,
    date: input.date,
    items: input.items,
    createdAt,
    ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
    ...(input.price !== undefined ? { price: input.price } : {}),
    ...(receiptId !== undefined ? { receiptId } : {}),
    ...(transactionId !== undefined ? { transactionId } : {}),
  };
}

export function createShoppingRepo(db: FinanceDb): ShoppingRepo {
  return {
    list: () => db.getAll('shoppingLists'),

    async add(input, receipt) {
      const tx = db.transaction(['shoppingLists', 'receipts'], 'readwrite');
      try {
        const receiptId = receipt ? crypto.randomUUID() : undefined;
        if (receipt && receiptId) {
          await tx.objectStore('receipts').add(toReceipt(receiptId, receipt));
        }
        const created = buildList(crypto.randomUUID(), new Date().toISOString(), receiptId, input);
        await tx.objectStore('shoppingLists').add(created);
        await tx.done;
        return created;
      } catch (error) {
        await abortQuietly(tx);
        throw error;
      }
    },

    async update(id, input, change) {
      const tx = db.transaction(['shoppingLists', 'receipts'], 'readwrite');
      try {
        const existing = await tx.objectStore('shoppingLists').get(id);
        if (!existing) throw new ShoppingListNotFoundError(id);

        const receipts = tx.objectStore('receipts');
        let receiptId = existing.receiptId;
        if (change.type === 'remove' || change.type === 'replace') {
          if (existing.receiptId !== undefined) await receipts.delete(existing.receiptId);
          receiptId = undefined;
        }
        if (change.type === 'replace') {
          receiptId = crypto.randomUUID();
          await receipts.add(toReceipt(receiptId, change.receipt));
        }

        const updated = buildList(
          existing.id,
          existing.createdAt,
          receiptId,
          input,
          existing.transactionId,
        );
        await tx.objectStore('shoppingLists').put(updated);
        await tx.done;
        return updated;
      } catch (error) {
        await abortQuietly(tx);
        throw error;
      }
    },

    async complete(id, expense) {
      const tx = db.transaction(['shoppingLists', 'transactions', 'receipts'], 'readwrite');
      try {
        const lists = tx.objectStore('shoppingLists');
        const existing = await lists.get(id);
        if (!existing) throw new ShoppingListNotFoundError(id);
        if (
          existing.transactionId !== undefined &&
          (await tx.objectStore('transactions').get(existing.transactionId))
        ) {
          throw new ShoppingListAlreadyCompletedError(id);
        }

        let receiptId: string | undefined;
        if (existing.receiptId !== undefined) {
          const receipts = tx.objectStore('receipts');
          const original = await receipts.get(existing.receiptId);
          if (original) {
            receiptId = crypto.randomUUID();
            await receipts.add({ ...original, id: receiptId });
          }
        }

        const transaction = buildTransaction(
          crypto.randomUUID(),
          new Date().toISOString(),
          receiptId,
          expense,
        );
        await tx.objectStore('transactions').add(transaction);
        const list: ShoppingList = { ...existing, transactionId: transaction.id };
        await lists.put(list);
        await tx.done;
        return { list, transaction };
      } catch (error) {
        await abortQuietly(tx);
        throw error;
      }
    },

    async remove(id) {
      const tx = db.transaction(['shoppingLists', 'receipts'], 'readwrite');
      try {
        const existing = await tx.objectStore('shoppingLists').get(id);
        if (existing) {
          if (existing.receiptId !== undefined) {
            await tx.objectStore('receipts').delete(existing.receiptId);
          }
          await tx.objectStore('shoppingLists').delete(id);
        }
        await tx.done;
      } catch (error) {
        await abortQuietly(tx);
        throw error;
      }
    },
  };
}
