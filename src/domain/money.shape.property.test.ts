import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatMoney, MAX_SEN } from './money';
import type { Sen } from './types';

const NUM_RUNS = 100;

const anySen = fc.integer({ min: -MAX_SEN, max: MAX_SEN }).map((n) => n as Sen);

describe('formatMoney shape property', () => {
  // Feature: personal-finance-tracker, Property 5: Formatted money has a fixed shape
  // **Validates: Requirements 3.5, 3.6, 8.2, 10.4**
  it('Property 5: formatted money has a fixed shape', () => {
    fc.assert(
      fc.property(anySen, (value) => {
        const text = formatMoney(value);
        const prefix = value < 0 ? '-RM' : 'RM';
        expect(text.startsWith(prefix)).toBe(true);
        // Exactly one sign marker, then comma-grouped integer part, then .dd
        expect(text).toMatch(/^-?RM(\d{1,3}(,\d{3})*)\.\d{2}$/);
        if (value >= 0) expect(text.startsWith('-')).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('formats known examples', () => {
    expect(formatMoney(0 as Sen)).toBe('RM0.00');
    expect(formatMoney(5 as Sen)).toBe('RM0.05');
    expect(formatMoney(123456 as Sen)).toBe('RM1,234.56');
    expect(formatMoney(-1250 as Sen)).toBe('-RM12.50');
  });
});
