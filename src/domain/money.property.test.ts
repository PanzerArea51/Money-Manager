import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseMoney } from './money';
import { validMoneyEntry } from './testing/arbitraries';

const NUM_RUNS = 100;

describe('money properties', () => {
  // Feature: personal-finance-tracker, Property 1: Parser returns the exact integer sen value
  // **Validates: Requirements 1.5, 1.6, 4.5, 10.2**
  it('Property 1: parser returns the exact integer sen value', () => {
    fc.assert(
      fc.property(
        validMoneyEntry,
        fc.constantFrom<'' | '+' | '-'>('', '+', '-'),
        (entry, sign) => {
          // Unsigned fields: no sign. Signed fields: optional '+' or '-'.
          const unsigned = parseMoney(entry.text, { allowNegative: false });
          expect(unsigned).toEqual({ ok: true, value: entry.value });

          const expected = sign === '-' ? -entry.value : entry.value;
          const signed = parseMoney(sign + entry.text, { allowNegative: true });
          expect(signed.ok).toBe(true);
          if (signed.ok) expect(Object.is(signed.value, -0)).toBe(false);
          if (signed.ok) expect(signed.value).toBe(expected === 0 ? 0 : expected);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
