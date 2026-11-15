import type { Receipt } from '../domain/types';
import type { FinanceDb } from './database';

/** Read-only. Receipt writes happen inside `transactionRepo` so they stay atomic. */
export interface ReceiptRepo {
  get(id: string): Promise<Receipt | undefined>;
}

export function createReceiptRepo(db: FinanceDb): ReceiptRepo {
  return {
    get: (id) => db.get('receipts', id),
  };
}
