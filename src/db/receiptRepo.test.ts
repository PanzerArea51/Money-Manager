import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Receipt } from '../domain/types';
import { openFinanceDb } from './database';
import type { FinanceDb } from './database';
import { createReceiptRepo } from './receiptRepo';
import type { ReceiptRepo } from './receiptRepo';

let db: FinanceDb;
let repo: ReceiptRepo;

beforeEach(async () => {
  db = await openFinanceDb({ name: `test-${crypto.randomUUID()}` });
  repo = createReceiptRepo(db);
});

afterEach(() => {
  db.close();
});

describe('receiptRepo', () => {
  it('reads a stored receipt with its size and MIME type', async () => {
    const blob = new Blob(['hello'], { type: 'image/png' });
    const stored: Receipt = {
      id: crypto.randomUUID(),
      blob,
      mimeType: 'image/png',
      fileName: 'r.png',
      size: blob.size,
    };
    await db.put('receipts', stored);

    const found = await repo.get(stored.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(stored.id);
    expect(found?.mimeType).toBe('image/png');
    expect(found?.fileName).toBe('r.png');
    expect(found?.size).toBe(5);
    expect(found?.blob.size).toBe(5);
  });

  it('returns undefined for a missing id', async () => {
    expect(await repo.get('missing')).toBeUndefined();
  });
});
