import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseMoney } from './money';
import { validateAccountInput, type AccountDraft } from './validation';

const nameArb = fc.oneof(
  fc.string({ maxLength: 60 }),
  fc.stringMatching(/^[ \t\n]{0,5}$/), // whitespace only
  fc.tuple(fc.constantFrom('', ' ', '\t'), fc.string({ minLength: 1, maxLength: 52 }), fc.constantFrom('', ' ', '\n')).map(
    ([a, b, c]) => a + b + c,
  ),
  fc.integer({ min: 48, max: 53 }).chain((n) => fc.string({ minLength: n, maxLength: n }).map((s) => ` ${s} `)),
);

const typeArb = fc.oneof(
  { arbitrary: fc.constantFrom('cash', 'bank', 'e-wallet'), weight: 3 },
  { arbitrary: fc.oneof(fc.string({ maxLength: 10 }), fc.constantFrom('Cash', 'BANK', 'ewallet', ' cash', '')), weight: 1 },
);

const balanceArb = fc.oneof(
  fc
    .tuple(fc.constantFrom('', '-', '+'), fc.integer({ min: 0, max: 999_999_999 }), fc.option(fc.integer({ min: 0, max: 99 }), { nil: undefined }))
    .map(([sign, i, f]) => `${sign}${i}${f === undefined ? '' : `.${String(f).padStart(2, '0')}`}`),
  fc.constantFrom('0', '-0', '999999999.99', '-999999999.99', '1000000000', '1000000000.00', '.5', '5.', '1.234', 'abc', ''),
  fc.string({ maxLength: 12 }),
);

const draftArb: fc.Arbitrary<AccountDraft> = fc.record({
  name: nameArb,
  type: typeArb,
  startingBalance: balanceArb,
});

describe('validateAccountInput properties', () => {
  // Feature: personal-finance-tracker, Property 7: Account validation accepts exactly the valid drafts
  // **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 1.9, 2.1**
  it('succeeds iff name, type and starting balance are all valid, with trimmed name and parsed balance', () => {
    fc.assert(
      fc.property(draftArb, (draft) => {
        const trimmed = draft.name.trim();
        const nameOk = trimmed.length >= 1 && trimmed.length <= 50;
        const typeOk = draft.type === 'cash' || draft.type === 'bank' || draft.type === 'e-wallet';
        const balance = parseMoney(draft.startingBalance, { allowNegative: true });

        const result = validateAccountInput(draft);

        expect(result.ok).toBe(nameOk && typeOk && balance.ok);
        if (result.ok) {
          expect(balance.ok).toBe(true);
          expect(result.value.name).toBe(trimmed);
          expect(result.value.type).toBe(draft.type);
          if (balance.ok) expect(result.value.openingBalance).toBe(balance.value);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('always rejects whitespace-only names', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[ \t\n\r]{0,10}$/), (name) => {
        const result = validateAccountInput({ name, type: 'cash', startingBalance: '0' });
        expect(result.ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
