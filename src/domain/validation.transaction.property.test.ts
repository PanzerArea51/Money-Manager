import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_SEN, parseMoney } from './money';
import { localDate } from './testing/arbitraries';
import { validateTransactionInput, type TransactionDraft } from './validation';

const IDS = ['a1', 'b2', 'c3'] as const;
const SELECTABLE: ReadonlySet<string> = new Set(['a1', 'b2']); // 'c3' exists but is not selectable

function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m === null) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function isValidTime(s: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  return m !== null && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

const titleArb = fc.oneof(
  fc.string({ maxLength: 110 }),
  fc.stringMatching(/^[ \t\n]{0,5}$/),
  fc.integer({ min: 98, max: 102 }).chain((n) => fc.string({ minLength: n, maxLength: n }).map((s) => ` ${s} `)),
);

const amountArb = fc.oneof(
  fc.integer({ min: 0, max: 99_999_999 }).map((n) => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`),
  fc.constantFrom(
    '0', '0.00', '-1', '-0.01', '0.01', '1', '9999999999999.99', '10000000000000', '1.234', '.5', '5.', 'abc', '',
    String(MAX_SEN / 100),
    `${Math.floor(MAX_SEN / 100)}.${String(MAX_SEN % 100).padStart(2, '0')}`,
    `${Math.floor((MAX_SEN + 1) / 100)}.${String((MAX_SEN + 1) % 100).padStart(2, '0')}`,
  ),
  fc.string({ maxLength: 12 }),
);

const dateArb = fc.oneof(
  localDate,
  fc.constantFrom('2024-02-29', '2023-02-29', '2024-13-01', '2024-00-10', '2024-04-31', '2024-1-1', '', 'abc', '2024-12-32'),
  fc.string({ maxLength: 10 }),
);

const timeArb = fc.oneof(
  fc
    .tuple(fc.integer({ min: 0, max: 25 }), fc.integer({ min: 0, max: 61 }))
    .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
  fc.constantFrom('00:00', '23:59', '24:00', '12:60', '9:30', '', 'abc'),
  fc.string({ maxLength: 6 }),
);

const accountIdArb = fc.option(fc.oneof(fc.constantFrom<string>(...IDS), fc.constant('')), { nil: undefined });

const draftArb: fc.Arbitrary<TransactionDraft> = fc.record(
  {
    kind: fc.constantFrom('income', 'expense', 'transfer'),
    title: titleArb,
    amount: amountArb,
    date: dateArb,
    time: timeArb,
    accountId: accountIdArb,
    fromAccountId: accountIdArb,
    toAccountId: accountIdArb,
  },
  { requiredKeys: ['kind', 'title', 'amount', 'date', 'time'] },
);

function selectable(id: string | undefined): id is string {
  return id !== undefined && SELECTABLE.has(id);
}

describe('validateTransactionInput properties', () => {
  // Feature: personal-finance-tracker, Property 8: Transaction validation accepts exactly the valid drafts
  // **Validates: Requirements 4.1, 4.3, 4.4, 4.6, 4.7, 4.8, 5.1, 5.3, 5.4, 5.5, 6.2**
  it('succeeds iff title, amount, date, time and accounts are all valid, with normalized values', () => {
    fc.assert(
      fc.property(draftArb, (d) => {
        const trimmed = d.title.trim();
        const titleOk = trimmed.length >= 1 && trimmed.length <= 100;
        const amount = parseMoney(d.amount, { allowNegative: false });
        const amountOk = amount.ok && amount.value > 0 && amount.value <= MAX_SEN;
        const accountsOk =
          d.kind === 'transfer'
            ? selectable(d.fromAccountId) && selectable(d.toAccountId) && d.fromAccountId !== d.toAccountId
            : selectable(d.accountId);
        const expectedOk = titleOk && amountOk && isValidDate(d.date) && isValidTime(d.time) && accountsOk;

        const result = validateTransactionInput(d, SELECTABLE);

        expect(result.ok).toBe(expectedOk);
        if (result.ok && amount.ok) {
          expect(result.value.kind).toBe(d.kind);
          expect(result.value.title).toBe(trimmed);
          expect(result.value.amount).toBe(amount.value);
          expect(result.value.date).toBe(d.date);
          expect(result.value.time).toBe(d.time);
          if (result.value.kind === 'transfer') {
            expect(result.value.fromAccountId).toBe(d.fromAccountId);
            expect(result.value.toAccountId).toBe(d.toAccountId);
          } else {
            expect(result.value.accountId).toBe(d.accountId);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it('always rejects a transfer from an account to itself', () => {
    fc.assert(
      fc.property(fc.constantFrom('a1', 'b2'), (id) => {
        const result = validateTransactionInput(
          { kind: 'transfer', title: 't', amount: '1.00', date: '2024-01-01', time: '10:00', fromAccountId: id, toAccountId: id },
          SELECTABLE,
        );
        expect(result.ok).toBe(false);
      }),
      { numRuns: 20 },
    );
  });
});
