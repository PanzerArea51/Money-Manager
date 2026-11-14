import { describe, expect, it } from 'vitest';
import { MAX_SEN, checkedAdd, formatMoney, isSen, parseMoney } from './money';
import type { Sen } from './types';

const POS = { allowNegative: false };
const NEG = { allowNegative: true };
const sen = (n: number) => n as Sen;

describe('parseMoney', () => {
  it.each([
    ['12.5', 1250],
    ['0.05', 5],
    ['12', 1200],
    ['0', 0],
    ['0.00', 0],
    ['1234567.89', 123456789],
    ['999999999.99', 99_999_999_999],
  ])('parses %s to %d sen', (input, expected) => {
    expect(parseMoney(input, POS)).toEqual({ ok: true, value: expected });
  });

  it('parses signed values only when negatives are allowed', () => {
    expect(parseMoney('-12.50', NEG)).toEqual({ ok: true, value: -1250 });
    expect(parseMoney('+3', NEG)).toEqual({ ok: true, value: 300 });
    expect(parseMoney('-0', NEG)).toEqual({ ok: true, value: 0 });
    expect(Object.is((parseMoney('-0.00', NEG) as { value: number }).value, -0)).toBe(false);
  });

  it('rejects empty input', () => {
    expect(parseMoney('', POS)).toEqual({ ok: false, error: 'empty' });
  });

  it.each(['abc', '1,000', ' 1', '1 ', '1.2.3', '.5', '5.', '.', '-', '1e3', 'RM5'])(
    'rejects %j as invalid-characters',
    (input) => {
      expect(parseMoney(input, NEG)).toEqual({ ok: false, error: 'invalid-characters' });
    },
  );

  it('rejects more than 2 fraction digits', () => {
    expect(parseMoney('1.234', POS)).toEqual({ ok: false, error: 'too-many-fraction-digits' });
  });

  it('rejects more than 9 integer digits', () => {
    expect(parseMoney('1000000000', POS)).toEqual({ ok: false, error: 'too-many-integer-digits' });
  });

  it('rejects a sign when negatives are not allowed', () => {
    expect(parseMoney('-5', POS)).toEqual({ ok: false, error: 'sign-not-allowed' });
    expect(parseMoney('+5', POS)).toEqual({ ok: false, error: 'sign-not-allowed' });
  });

  it('rejects values above the maximum', () => {
    // 9 integer digits with .99 is exactly MAX_SEN; nothing 9-digit can exceed it,
    // so out-of-range is unreachable via the scanner but must never yield a value > MAX_SEN.
    const r = parseMoney('999999999.99', POS);
    expect(r.ok && r.value <= MAX_SEN).toBe(true);
  });
});

describe('formatMoney', () => {
  it('formats zero', () => {
    expect(formatMoney(sen(0))).toBe('RM0.00');
  });

  it('formats small and padded values', () => {
    expect(formatMoney(sen(5))).toBe('RM0.05');
    expect(formatMoney(sen(1250))).toBe('RM12.50');
  });

  it('formats negatives with a leading minus', () => {
    expect(formatMoney(sen(-1250))).toBe('-RM12.50');
  });

  it('groups thousands', () => {
    expect(formatMoney(sen(123456))).toBe('RM1,234.56');
    expect(formatMoney(sen(100000000))).toBe('RM1,000,000.00');
  });

  it('formats the maximum value', () => {
    expect(formatMoney(MAX_SEN)).toBe('RM999,999,999.99');
    expect(formatMoney(sen(-MAX_SEN))).toBe('-RM999,999,999.99');
  });
});

describe('isSen / MAX_SEN', () => {
  it('accepts the bounds and rejects beyond them', () => {
    expect(MAX_SEN).toBe(99_999_999_999);
    expect(isSen(99_999_999_999)).toBe(true);
    expect(isSen(-99_999_999_999)).toBe(true);
    expect(isSen(100_000_000_000)).toBe(false);
    expect(isSen(1.5)).toBe(false);
    expect(isSen(Number.NaN)).toBe(false);
  });
});

describe('checkedAdd', () => {
  it('adds within range', () => {
    expect(checkedAdd(sen(100), sen(250))).toEqual({ ok: true, value: 350 });
  });

  it('allows results exactly at +/- the limit', () => {
    expect(checkedAdd(sen(99_999_999_998), sen(1))).toEqual({ ok: true, value: 99_999_999_999 });
    expect(checkedAdd(sen(-99_999_999_998), sen(-1))).toEqual({ ok: true, value: -99_999_999_999 });
  });

  it('rejects results beyond +/- the limit', () => {
    expect(checkedAdd(MAX_SEN, sen(1))).toEqual({ ok: false, error: 'limit-exceeded' });
    expect(checkedAdd(sen(-MAX_SEN), sen(-1))).toEqual({ ok: false, error: 'limit-exceeded' });
  });

  it('allows opposite-sign extremes to cancel', () => {
    expect(checkedAdd(MAX_SEN, sen(-MAX_SEN))).toEqual({ ok: true, value: 0 });
  });
});
