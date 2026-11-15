import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoney } from './money';
import { validMoneyEntry } from './testing/arbitraries';

const NUM_RUNS = 100;

describe('money stability property', () => {
  // Feature: personal-finance-tracker, Property 4: Parse, format, parse is stable
  // **Validates: Requirements 10.6**
  it('Property 4: parse, format, parse is stable', () => {
    fc.assert(
      fc.property(
        validMoneyEntry,
        fc.constantFrom<'' | '+' | '-'>('', '+', '-'),
        (entry, sign) => {
          const first = parseMoney(sign + entry.text, { allowNegative: true });
          expect(first.ok).toBe(true);
          if (!first.ok) return;

          const formatted = formatMoney(first.value);
          const stripped = formatted.replace('RM', '').replace(/,/g, '');
          const second = parseMoney(stripped, { allowNegative: true });
          expect(second).toEqual({ ok: true, value: first.value });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
