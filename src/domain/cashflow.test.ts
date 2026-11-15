import { describe, expect, it } from 'vitest';
import { summarize } from './cashflow';
import { MAX_SEN } from './money';
import type { Period, Sen, Transaction } from './types';

const sen = (n: number): Sen => n as Sen;

const PERIOD: Period = { unit: 'week', start: '2025-01-06', end: '2025-01-12' };

type Overrides = Pick<Transaction, 'kind'> & { amount?: number; date?: string; accountId?: string };

function tx(o: Overrides, id = 't'): Transaction {
  const { amount, ...rest } = o;
  return {
    id,
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

describe('summarize', () => {
  it('returns zeros for empty input', () => {
    expect(summarize([], PERIOD)).toEqual({
      ok: true,
      value: { totalIncome: 0, totalExpenses: 0, net: 0 },
    });
  });

  it('sums income', () => {
    const r = summarize([tx({ kind: 'income', amount: 1000 }, '1'), tx({ kind: 'income', amount: 250 }, '2')], PERIOD);
    expect(r).toEqual({ ok: true, value: { totalIncome: 1250, totalExpenses: 0, net: 1250 } });
  });

  it('sums expenses', () => {
    const r = summarize([tx({ kind: 'expense', amount: 300 }, '1'), tx({ kind: 'expense', amount: 200 }, '2')], PERIOD);
    expect(r).toEqual({ ok: true, value: { totalIncome: 0, totalExpenses: 500, net: -500 } });
  });

  it('computes net as income minus expenses', () => {
    const r = summarize([tx({ kind: 'income', amount: 1000 }, '1'), tx({ kind: 'expense', amount: 400 }, '2')], PERIOD);
    expect(r).toEqual({ ok: true, value: { totalIncome: 1000, totalExpenses: 400, net: 600 } });
  });

  it('excludes transfers', () => {
    const r = summarize([tx({ kind: 'transfer', amount: 5000 }), tx({ kind: 'income', amount: 100 }, '2')], PERIOD);
    expect(r).toEqual({ ok: true, value: { totalIncome: 100, totalExpenses: 0, net: 100 } });
  });

  it('includes transactions regardless of account archive state', () => {
    // summarize takes no accounts, so a transaction of an archived account is counted.
    const r = summarize([tx({ kind: 'expense', amount: 700, accountId: 'archived-account' })], PERIOD);
    expect(r).toEqual({ ok: true, value: { totalIncome: 0, totalExpenses: 700, net: -700 } });
  });

  it('includes both inclusive period ends and excludes the days outside', () => {
    const r = summarize(
      [
        tx({ kind: 'income', amount: 1, date: '2025-01-05' }, 'before'),
        tx({ kind: 'income', amount: 10, date: '2025-01-06' }, 'start'),
        tx({ kind: 'income', amount: 100, date: '2025-01-12' }, 'end'),
        tx({ kind: 'income', amount: 1000, date: '2025-01-13' }, 'after'),
      ],
      PERIOD,
    );
    expect(r).toEqual({ ok: true, value: { totalIncome: 110, totalExpenses: 0, net: 110 } });
  });

  it('accepts totals exactly at the limit', () => {
    const r = summarize([tx({ kind: 'income', amount: MAX_SEN })], PERIOD);
    expect(r).toEqual({ ok: true, value: { totalIncome: MAX_SEN, totalExpenses: 0, net: MAX_SEN } });
  });

  it('reports limit-exceeded when a total passes the limit', () => {
    const r = summarize(
      [tx({ kind: 'income', amount: MAX_SEN }, '1'), tx({ kind: 'income', amount: 1 }, '2')],
      PERIOD,
    );
    expect(r).toEqual({ ok: false, error: 'limit-exceeded' });
  });
});
