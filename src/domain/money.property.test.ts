import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseMoney } from './money';
import { invalidMoneyString, validMoneyEntry } from './testing/arbitraries';

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

  // Feature: personal-finance-tracker, Property 2: Parser rejects malformed input with a reason
  // **Validates: Requirements 1.7, 10.3**
  it('Property 2: parser rejects malformed input with a reason', () => {
    fc.assert(
      fc.property(invalidMoneyString, fc.boolean(), (input, allowNegative) => {
        const result = parseMoney(input, { allowNegative });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(typeof result.error).toBe('string');
          expect(result.error.length).toBeGreaterThan(0);
          expect('value' in result).toBe(false);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: personal-finance-tracker, Property 2: Parser rejects malformed input with a reason
  // **Validates: Requirements 1.7, 10.3**
  it('Property 2: a sign is rejected when negatives are not allowed', () => {
    fc.assert(
      fc.property(validMoneyEntry, fc.constantFrom('+', '-'), (entry, sign) => {
        const result = parseMoney(sign + entry.text, { allowNegative: false });
        expect(result).toEqual({ ok: false, error: 'sign-not-allowed' });
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
