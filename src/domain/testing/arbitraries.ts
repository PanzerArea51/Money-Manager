import fc from 'fast-check';
import { MAX_SEN } from '../money';
import type {
  Account,
  AccountType,
  LocalDate,
  LocalTime,
  Sen,
  Transaction,
} from '../types';

/** Shared fast-check generators for domain property tests. */

const MS_PER_DAY = 86_400_000;
const FIRST_YEAR = 1970;
const LAST_YEAR = 2100;
const FIRST_DAY = 0; // 1970-01-01 as days since epoch
const LAST_DAY = Date.UTC(LAST_YEAR, 11, 31) / MS_PER_DAY;

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function formatDate(year: number, month: number, day: number): LocalDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dateFromDayNumber(days: number): LocalDate {
  const d = new Date(days * MS_PER_DAY);
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Weekday of a day number: 0 = Sunday ... 6 = Saturday. 1970-01-01 is a Thursday. */
function weekdayOfDayNumber(days: number): number {
  return (((days + 4) % 7) + 7) % 7;
}

const dayNumber = fc.integer({ min: FIRST_DAY, max: LAST_DAY });
const year = fc.integer({ min: FIRST_YEAR, max: LAST_YEAR });

const anyDate = dayNumber.map(dateFromDayNumber);

const monthEndDate = fc
  .tuple(year, fc.integer({ min: 1, max: 12 }))
  .map(([y, m]) => formatDate(y, m, daysInMonth(y, m)));

const leapDayDate = year
  .map((y) => {
    let leap = y;
    while (!isLeapYear(leap)) leap += 1;
    return leap > LAST_YEAR ? 2096 : leap;
  })
  .map((y) => formatDate(y, 2, 29));

/** A day number on the given weekday (0 = Sunday, 1 = Monday), within range. */
function onWeekday(weekday: number): fc.Arbitrary<LocalDate> {
  return dayNumber.map((d) => {
    let adjusted = d - ((weekdayOfDayNumber(d) - weekday + 7) % 7);
    if (adjusted < FIRST_DAY) adjusted += 7;
    return dateFromDayNumber(adjusted);
  });
}

/** Local `YYYY-MM-DD` from 1970 to 2100, biased to month ends, leap days, Mondays and Sundays. */
export const localDate: fc.Arbitrary<LocalDate> = fc.oneof(
  { arbitrary: anyDate, weight: 4 },
  { arbitrary: monthEndDate, weight: 2 },
  { arbitrary: leapDayDate, weight: 1 },
  { arbitrary: onWeekday(1), weight: 2 },
  { arbitrary: onWeekday(0), weight: 2 },
);

/** Local `HH:mm`. */
export const localTime: fc.Arbitrary<LocalTime> = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${pad(h, 2)}:${pad(m, 2)}`);

/** Any sen value in +/- MAX_SEN, biased to 0, +/-1 and +/-MAX_SEN. */
export const sen: fc.Arbitrary<Sen> = fc.oneof(
  { arbitrary: fc.constantFrom(0, 1, -1, MAX_SEN, -MAX_SEN), weight: 2 },
  { arbitrary: fc.integer({ min: -MAX_SEN, max: MAX_SEN }), weight: 3 },
  { arbitrary: fc.integer({ min: -100_000, max: 100_000 }), weight: 2 },
) as fc.Arbitrary<Sen>;

/** Strictly positive sen, as used for transaction amounts. */
export const positiveSen: fc.Arbitrary<Sen> = fc.oneof(
  { arbitrary: fc.constantFrom(1, MAX_SEN), weight: 2 },
  { arbitrary: fc.integer({ min: 1, max: MAX_SEN }), weight: 3 },
  { arbitrary: fc.integer({ min: 1, max: 100_000 }), weight: 2 },
) as fc.Arbitrary<Sen>;

/** Decimal string for a non-negative sen value, e.g. 1250 -> "12.5", "12.50", "12.50". */
function decimalString(value: number, style: 'none' | 'short' | 'full'): string {
  const whole = Math.floor(value / 100);
  const cents = value % 100;
  if (style === 'none' && cents === 0) return String(whole);
  if (style === 'short' && cents % 10 === 0) return `${whole}.${cents / 10}`;
  return `${whole}.${pad(cents, 2)}`;
}

/** A valid unsigned money string together with the sen value it must parse to. */
export const validMoneyEntry: fc.Arbitrary<{ text: string; value: Sen }> = fc
  .tuple(
    fc.integer({ min: 0, max: MAX_SEN }),
    fc.constantFrom<'none' | 'short' | 'full'>('none', 'short', 'full'),
    fc.integer({ min: 0, max: 2 }),
  )
  .map(([value, style, zeros]) => ({
    text: '0'.repeat(zeros) + decimalString(value, style),
    value: value as Sen,
  }))
  .filter(({ text }) => text.replace(/\..*$/, '').length <= 9);

/** Malformed money strings that parseMoney must reject. */
export const invalidMoneyString: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('', '.', '.5', '5.', '1.2.3', '1,000', 'abc', '12.5x', ' 1', '1 ', 'RM1', '--1', '+-1', '1e3'),
  fc.integer({ min: 0, max: 999_999 }).map((n) => `${n}.${pad(n % 1000, 3)}`), // 3 fraction digits
  fc.integer({ min: 1_000_000_000, max: 9_999_999_999 }).map(String), // 10 integer digits
  fc.string({ minLength: 1, maxLength: 12 }).filter((s) => !/^[+-]?\d+(\.\d+)?$/.test(s)),
);

/** Valid and invalid unsigned money strings. */
export const moneyString: fc.Arbitrary<string> = fc.oneof(
  validMoneyEntry.map((e) => e.text),
  invalidMoneyString,
);

const accountType: fc.Arbitrary<AccountType> = fc.constantFrom('cash', 'bank', 'e-wallet');

const isoTimestamp: fc.Arbitrary<string> = fc
  .integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2100, 0, 1) })
  .map((ms) => new Date(ms).toISOString());

const name: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

const title: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

export const account: fc.Arbitrary<Account> = fc.record({
  id: fc.uuid(),
  name,
  type: accountType,
  openingBalance: sen,
  archived: fc.boolean(),
  createdAt: isoTimestamp,
});

/** Distinct accounts (unique ids). */
export const accounts = (opts: { minLength?: number; maxLength?: number } = {}): fc.Arbitrary<Account[]> =>
  fc.uniqueArray(account, {
    minLength: opts.minLength ?? 0,
    maxLength: opts.maxLength ?? 6,
    selector: (a) => a.id,
  });

const transactionBase = {
  id: fc.uuid(),
  title,
  amount: positiveSen,
  date: localDate,
  time: localTime,
  receiptId: fc.option(fc.uuid(), { nil: undefined }),
  createdAt: isoTimestamp,
};

/**
 * Income, expense and transfer transactions referencing the given account ids.
 * Transfers are generated only when at least two ids are given, and always use two different ids.
 */
export function transaction(accountIds: readonly string[]): fc.Arbitrary<Transaction> {
  if (accountIds.length === 0) throw new Error('transaction() needs at least one account id');
  const idArb = fc.constantFrom(...accountIds);

  const incomeOrExpense = fc
    .record({ ...transactionBase, kind: fc.constantFrom('income' as const, 'expense' as const), accountId: idArb })
    .map(stripUndefinedReceipt);

  if (accountIds.length < 2) return incomeOrExpense;

  const transfer = fc
    .record({
      ...transactionBase,
      kind: fc.constant('transfer' as const),
      endpoints: fc
        .tuple(fc.integer({ min: 0, max: accountIds.length - 1 }), fc.integer({ min: 1, max: accountIds.length - 1 }))
        .map(([from, offset]) => [accountIds[from], accountIds[(from + offset) % accountIds.length]] as const),
    })
    .map(({ endpoints, ...rest }) =>
      stripUndefinedReceipt({ ...rest, fromAccountId: endpoints[0], toAccountId: endpoints[1] }),
    );

  return fc.oneof(incomeOrExpense, transfer);
}

function stripUndefinedReceipt<T extends { receiptId?: string }>(tx: T): T & Transaction {
  const copy = { ...tx };
  if (copy.receiptId === undefined) delete copy.receiptId;
  return copy as T & Transaction;
}

/** Accounts (at least one) plus transactions that reference only those accounts. */
export const ledger: fc.Arbitrary<{ accounts: Account[]; transactions: Transaction[] }> = accounts({
  minLength: 1,
})
  .chain((accts) =>
    fc.record({
      accounts: fc.constant(accts),
      transactions: fc.array(transaction(accts.map((a) => a.id)), { maxLength: 30 }),
    }),
  );

/** Returns a shuffled copy of `items`, driven by fast-check so it is reproducible. */
export function shuffle<T>(items: readonly T[]): fc.Arbitrary<T[]> {
  return fc.infiniteStream(fc.nat()).map((stream) => {
    const copy = [...items];
    const it = stream[Symbol.iterator]();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = (it.next().value as number) % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  });
}
