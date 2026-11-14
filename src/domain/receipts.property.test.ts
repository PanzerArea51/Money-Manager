import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { receiptEntries } from './receipts';
import { ledger } from './testing/arbitraries';

const NUM_RUNS = 100;

describe('receipts properties', () => {
  // Feature: personal-finance-tracker, Property 25: Receipts list contains exactly the transactions with receipts
  // **Validates: Requirements 9.9**
  it('Property 25: receipts list contains exactly the transactions with receipts', () => {
    fc.assert(
      fc.property(ledger, ({ transactions }) => {
        const entries = receiptEntries(transactions);
        const expected = transactions.filter((t) => t.receiptId !== undefined);

        expect(entries.map((t) => t.id)).toEqual(expected.map((t) => t.id));
        for (const entry of entries) expect(entry.receiptId).toBeTruthy();
        // Nothing without a receipt is included.
        const withReceipt = new Set(expected.map((t) => t.id));
        for (const t of transactions) {
          expect(entries.some((e) => e.id === t.id)).toBe(withReceipt.has(t.id));
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
