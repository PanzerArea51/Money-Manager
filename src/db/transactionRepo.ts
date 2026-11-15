import type {
  Receipt,
  ReceiptChange,
  ReceiptInput,
  Transaction,
  TransactionInput,
} from '../domain/types';
import type { FinanceDb } from './database';

export class TransactionNotFoundError extends Error {
  constructor(id: string) {
    super(`Transaction not found: ${id}`);
    this.name = 'TransactionNotFoundError';
  }
}

export interface TransactionRepo {
  list(): Promise<Transaction[]>;
  get(id: string): Promise<Transaction | undefined>;
  add(input: TransactionInput, receipt?: ReceiptInput): Promise<Transaction>;
  update(id: string, input: TransactionInput, receipt: ReceiptChange): Promise<Transaction>;
  remove(id: string): Promise<void>;
}

function toReceipt(id: string, input: ReceiptInput): Receipt {
  return {
    id,
    blob: input.blob,
    mimeType: input.mimeType,
    fileName: input.fileName,
    size: input.size,
  };
}

function buildTransaction(
  id: string,
  createdAt: string,
  receiptId: string | undefined,
  input: TransactionInput,
): Transaction {
  const base = {
    id,
    title: input.title,
    amount: input.amount,
    date: input.date,
    time: input.time,
    createdAt,
    ...(receiptId !== undefined ? { receiptId } : {}),
  };
  if (input.kind === 'transfer') {
    return {
      ...base,
      kind: 'transfer',
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
    };
  }
  return { ...base, kind: input.kind, accountId: input.accountId };
}

/** Aborts a transaction that may already have finished or aborted itself. */
async function abortQuietly(tx: { abort(): void; done: Promise<void> }): Promise<void> {
  try {
    tx.abort();
  } catch {
    // already finished or aborted
  }
  await tx.done.catch(() => undefined);
}

export function createTransactionRepo(db: FinanceDb): TransactionRepo {
  return {
    list: () => db.getAll('transactions'),

    get: (id) => db.get('transactions', id),

    async add(input, receipt) {
      const tx = db.transaction(['transactions', 'receipts'], 'readwrite');
      try {
        const receiptId = receipt ? crypto.randomUUID() : undefined;
        if (receipt && receiptId) {
          await tx.objectStore('receipts').add(toReceipt(receiptId, receipt));
        }
        const created = buildTransaction(
          crypto.randomUUID(),
          new Date().toISOString(),
          receiptId,
          input,
        );
        await tx.objectStore('transactions').add(created);
        await tx.done;
        return created;
      } catch (error) {
        await abortQuietly(tx);
        throw error;
      }
    },

    async update(id, input, change) {
      const tx = db.transaction(['transactions', 'receipts'], 'readwrite');
      try {
        const existing = await tx.objectStore('transactions').get(id);
        if (!existing) throw new TransactionNotFoundError(id);

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

        const updated = buildTransaction(existing.id, existing.createdAt, receiptId, input);
        await tx.objectStore('transactions').put(updated);
        await tx.done;
        return updated;
      } catch (error) {
        await abortQuietly(tx);
        throw error;
      }
    },

    async remove(id) {
      const tx = db.transaction(['transactions', 'receipts'], 'readwrite');
      try {
        const existing = await tx.objectStore('transactions').get(id);
        if (existing) {
          if (existing.receiptId !== undefined) {
            await tx.objectStore('receipts').delete(existing.receiptId);
          }
          await tx.objectStore('transactions').delete(id);
        }
        await tx.done;
      } catch (error) {
        await abortQuietly(tx);
        throw error;
      }
    },
  };
}
