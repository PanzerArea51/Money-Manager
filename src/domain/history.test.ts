import { describe, expect, it } from 'vitest';
import { compareTransactionsNewestFirst, findWeekForMonth, groupByWeek } from './history';
import type { Sen, Transaction } from './types';
import { periodFor } from './week';

const sen = (n: number): Sen => n as Sen;

type Overrides = Pick<Transaction, 'kind'> & {
  id?: string;
  amount?: number;
  date?: string;
  time?: string;
  createdAt?: string;
};

function tx(o: Overrides): Transaction {
  const { amount, ...rest } = o;
  return {
    id: 't',
    title: 'x',
    amount: sen(amount ?? 100),
    date: '2025-01-08',
    time: '10:00',
    createdAt: '2025-01-01T00:00:00.000Z',
    accountId: 'a',
    fromAccountId: 'a',
    toAccountId: 'b',
    ...rest,
  } as Transaction;
}

describe('compareTransactionsNewestFirst', () => {
  it('orders by date first', () => {
    const older = tx({ kind: 'income', id: '1', date: '2025-01-07', time: '23:00' });
    const newer = tx({ kind: 'income', id: '2', date: '2025-01-08', time: '01:00' });
    expect([older, newer].sort(compareTransactionsNewestFirst)).toEqual([newer, older]);
  });

  it('orders by time when dates match', () => {
    const early = tx({ kind: 'expense', id: '1', time: '09:00' });
    const late = tx({ kind: 'expense', id: '2', time: '18:30' });
    expect([early, late].sort(compareTransactionsNewestFirst)).toEqual([late, early]);
  });

  it('orders by createdAt when date and time match', () => {
    const first = tx({ kind: 'expense', id: '1', createdAt: '2025-01-01T00:00:00.000Z' });
    const second = tx({ kind: 'expense', id: '2', createdAt: '2025-01-02T00:00:00.000Z' });
    expect([first, second].sort(compareTransactionsNewestFirst)).toEqual([second, first]);
  });

  it('returns 0 for the same transaction', () => {
    const a = tx({ kind: 'income' });
    expect(compareTransactionsNewestFirst(a, a)).toBe(0);
  });
});

describe('groupByWeek', () => {
  it('returns no groups for empty input', () => {
    expect(groupByWeek([])).toEqual([]);
  });

  it('groups Monday to Sunday and puts the newest week first', () => {
    const sunday = tx({ kind: 'income', id: '1', date: '2025-01-12' });
    const monday = tx({ kind: 'income', id: '2', date: '2025-01-13' });
    const prevMonday = tx({ kind: 'income', id: '3', date: '2025-01-06' });
    const groups = groupByWeek([prevMonday, monday, sunday]);
    expect(groups.map((g) => [g.weekStart, g.weekEnd])).toEqual([
      ['2025-01-13', '2025-01-19'],
      ['2025-01-06', '2025-01-12'],
    ]);
    expect(groups[1]?.transactions.map((t) => t.id)).toEqual(['1', '3']);
  });

  it('sorts transactions in a week by date, time and createdAt, newest first', () => {
    const a = tx({ kind: 'income', id: 'a', date: '2025-01-07' });
    const b = tx({ kind: 'income', id: 'b', date: '2025-01-08', time: '09:00' });
    const c = tx({ kind: 'income', id: 'c', date: '2025-01-08', time: '11:00', createdAt: '2025-01-01T00:00:00.000Z' });
    const d = tx({ kind: 'income', id: 'd', date: '2025-01-08', time: '11:00', createdAt: '2025-01-02T00:00:00.000Z' });
    const groups = groupByWeek([a, b, c, d]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.transactions.map((t) => t.id)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('computes week net as income minus expenses', () => {
    const groups = groupByWeek([
      tx({ kind: 'income', id: '1', amount: 1000 }),
      tx({ kind: 'expense', id: '2', amount: 300 }),
    ]);
    expect(groups[0]?.net).toBe(700);
  });

  it('gives a negative net when expenses exceed income', () => {
    const groups = groupByWeek([tx({ kind: 'expense', id: '1', amount: 500 })]);
    expect(groups[0]?.net).toBe(-500);
  });

  it('excludes transfers from the week net but keeps them in the group', () => {
    const groups = groupByWeek([
      tx({ kind: 'income', id: '1', amount: 1000 }),
      tx({ kind: 'transfer', id: '2', amount: 400 }),
    ]);
    expect(groups[0]?.net).toBe(1000);
    expect(groups[0]?.transactions).toHaveLength(2);
  });

  it('gives a net of zero for a week with only transfers', () => {
    const groups = groupByWeek([tx({ kind: 'transfer', id: '1', amount: 400 })]);
    expect(groups[0]?.net).toBe(0);
  });
});

describe('findWeekForMonth', () => {
  const groups = groupByWeek([
    tx({ kind: 'income', id: '1', date: '2025-02-03' }),
    tx({ kind: 'income', id: '2', date: '2025-01-30' }),
    tx({ kind: 'income', id: '3', date: '2025-01-08' }),
  ]);

  it('returns the newest week that touches the month', () => {
    const found = findWeekForMonth(groups, periodFor('month', '2025-01-15'));
    expect(found?.weekStart).toBe('2025-01-27');
  });

  it('finds a week that spans into the month from a neighbouring month', () => {
    // Week of 2025-01-27 holds 2025-01-30 only; February's newest week is 02-03.
    const found = findWeekForMonth(groups, periodFor('month', '2025-02-10'));
    expect(found?.weekStart).toBe('2025-02-03');
  });

  it('returns undefined when no transaction falls in the month', () => {
    expect(findWeekForMonth(groups, periodFor('month', '2025-03-01'))).toBeUndefined();
  });

  it('returns undefined for no groups', () => {
    expect(findWeekForMonth([], periodFor('month', '2025-01-01'))).toBeUndefined();
  });
});
