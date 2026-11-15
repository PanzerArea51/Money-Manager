import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkedAdd, MAX_SEN } from './money';
import type { Sen } from './types';

const NUM_RUNS = 100;

const anySen = fc.oneof(
  fc.integer({ min: -MAX_SEN, max: MAX_SEN }),
  fc.constantFrom(-MAX_SEN, MAX_SEN, 0, 1, -1),
) as fc.Arbitrary<Sen>;

describe('checkedAdd properties', () => {
  // Feature: personal-finance-tracker, Property 6: Checked addition respects the sen range
  // **Validates: Requirements 10.1, 10.7, 10.8**
  it('Property 6: returns the exact sum within range, else limit-exceeded', () => {
    fc.assert(
      fc.property(anySen, anySen, (a, b) => {
        const exact = BigInt(a) + BigInt(b);
        const inRange = exact >= -BigInt(MAX_SEN) && exact <= BigInt(MAX_SEN);
        const result = checkedAdd(a, b);
        if (inRange) {
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(BigInt(result.value)).toBe(exact);
            expect(Number.isSafeInteger(result.value)).toBe(true);
          }
        } else {
          expect(result).toEqual({ ok: false, error: 'limit-exceeded' });
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
