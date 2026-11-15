import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_RECEIPT_BYTES, validateReceiptFile } from './validation';

const NUM_RUNS = 100;
const SUPPORTED = ['image/jpeg', 'image/png', 'application/pdf'];

const mimeType = fc.oneof(
  fc.constantFrom(...SUPPORTED),
  fc.constantFrom('image/gif', 'image/webp', 'text/plain', 'application/zip', 'IMAGE/PNG', ''),
  fc.string({ maxLength: 20 }),
);

const size = fc.oneof(
  fc.constantFrom(0, 1, MAX_RECEIPT_BYTES - 1, MAX_RECEIPT_BYTES, MAX_RECEIPT_BYTES + 1),
  fc.integer({ min: 0, max: MAX_RECEIPT_BYTES * 3 }),
);

describe('receipt file validation properties', () => {
  // Feature: personal-finance-tracker, Property 10: Receipt file validation
  // **Validates: Requirements 9.1, 9.2, 9.3**
  it('Property 10: accepts if and only if type is supported and size is within the limit', () => {
    fc.assert(
      fc.property(mimeType, size, (type, bytes) => {
        const result = validateReceiptFile({ type, size: bytes });
        const typeOk = SUPPORTED.includes(type);
        const sizeOk = bytes <= 5_242_880;

        expect(result.ok).toBe(typeOk && sizeOk);
        if (!result.ok) {
          expect(result.error).toBe(typeOk ? 'too-large' : 'unsupported-type');
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
