import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatMoney, MAX_SEN, parseMoney } from './money';
import type { Sen } from './types';

const NUM_RUNS = 100;

const senValue = fc.oneof(
  fc.integer({ min: -MAX_SEN, max: MAX_SEN }),
  fc.constantFrom(0, 1, -1, 99, 100, 99_999, 100_000, MAX_SEN, -MAX_SEN),
) as fc.Arbitrary<Sen>;

describe('money round trip property', () => {
  // Feature: personal-finance-tracker, Property 3: Format then parse round trip
  // **Validates: Requirements 10.5**
  it('Property 3: parseMoney(formatMoney(v)) returns v', () => {
    fc.assert(
      fc.property(senValue, (v) => {
        const text = formatMoney(v).replace('RM', '').replace(/,/g, '');
        const result = parseMoney(text, { allowNegative: true });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toBe(v);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
