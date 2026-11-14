import type { LimitExceeded, Result, Sen } from './types';

export const MAX_SEN = 99_999_999_999 as Sen;

const MAX_INTEGER_DIGITS = 9;
const MAX_FRACTION_DIGITS = 2;
const SEN_PER_RM = 100;

export type MoneyParseError =
  | 'empty'
  | 'invalid-characters'
  | 'too-many-fraction-digits'
  | 'too-many-integer-digits'
  | 'sign-not-allowed'
  | 'out-of-range';

/** True for a safe integer within +/- MAX_SEN. */
export function isSen(n: number): n is Sen {
  return Number.isSafeInteger(n) && Math.abs(n) <= MAX_SEN;
}

export function checkedAdd(a: Sen, b: Sen): Result<Sen, LimitExceeded> {
  const sum = a + b;
  if (!isSen(sum)) return { ok: false, error: 'limit-exceeded' };
  return { ok: true, value: sum };
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/**
 * Parses a decimal string (optional leading sign, 1 to 9 integer digits,
 * 0 to 2 fraction digits) into integer sen. Integer arithmetic only.
 * A decimal point must be followed by at least one digit.
 */
export function parseMoney(
  input: string,
  opts: { allowNegative: boolean },
): Result<Sen, MoneyParseError> {
  if (input.length === 0) return { ok: false, error: 'empty' };

  let i = 0;
  let negative = false;
  if (input[0] === '-' || input[0] === '+') {
    if (!opts.allowNegative) return { ok: false, error: 'sign-not-allowed' };
    negative = input[0] === '-';
    i = 1;
  }

  let intDigits = '';
  let fracDigits = '';
  let seenDot = false;
  for (; i < input.length; i++) {
    const ch = input[i];
    if (isDigit(ch)) {
      if (seenDot) fracDigits += ch;
      else intDigits += ch;
    } else if (ch === '.' && !seenDot) {
      seenDot = true;
    } else {
      return { ok: false, error: 'invalid-characters' };
    }
  }

  if (intDigits.length === 0 || (seenDot && fracDigits.length === 0)) {
    return { ok: false, error: 'invalid-characters' };
  }
  if (fracDigits.length > MAX_FRACTION_DIGITS) {
    return { ok: false, error: 'too-many-fraction-digits' };
  }
  if (intDigits.length > MAX_INTEGER_DIGITS) {
    return { ok: false, error: 'too-many-integer-digits' };
  }

  let intPart = 0;
  for (const ch of intDigits) intPart = intPart * 10 + (ch.charCodeAt(0) - 48);
  let fracPart = 0;
  for (const ch of fracDigits.padEnd(MAX_FRACTION_DIGITS, '0')) {
    fracPart = fracPart * 10 + (ch.charCodeAt(0) - 48);
  }

  const magnitude = intPart * SEN_PER_RM + fracPart;
  if (magnitude > MAX_SEN) return { ok: false, error: 'out-of-range' };
  // Avoid -0.
  const value = negative && magnitude !== 0 ? -magnitude : magnitude;
  return { ok: true, value: value as Sen };
}

const GROUPING = new Intl.NumberFormat('en-MY', { useGrouping: true, maximumFractionDigits: 0 });

/** Formats sen as `RM1,234.56` or `-RM12.50`. */
export function formatMoney(value: Sen): string {
  const abs = Math.abs(value);
  const rm = Math.floor(abs / SEN_PER_RM);
  const sen = abs % SEN_PER_RM;
  const sign = value < 0 ? '-' : '';
  return `${sign}RM${GROUPING.format(rm)}.${String(sen).padStart(2, '0')}`;
}
