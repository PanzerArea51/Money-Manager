import { describe, expect, it } from 'vitest';
import { blockingTransactionCount, selectableAccountIds } from './accounts';
import { accountBalance, combinedBalance } from './balance';
import { MAX_SEN } from './money';
import type { Account, Sen, Transaction } from './types';

const sen = (n: number): Sen => n as Sen;

function acct(id: string, opening: number, archived = false): Account {
  return { id, name: id, type: 'cash', openingBalance: sen(opening), archived, createdAt: '2025-01-01T00:00:00.000Z' };
}

/** Test overrides: any field of any transaction kind; the helper fills in the rest. */
type TxOverrides = Pick<Transaction, 'kind'> & {
  amount?: Sen;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
};

function tx(t: TxOverrides, id = 't'): Transaction {
  return {
    id,
    title: 'x',
    amount: sen(100),
    date: '2025-01-01',
    time: '10:00',
    createdAt: '2025-01-01T00:00:00.000Z',
    accountId: 'a',
    fromAccountId: 'a',
    toAccountId: 'b',
    ...t,
  } as Transaction;
}

describe('accountBalance', () => {
  it('returns the opening balance with no transactions', () => {
    expect(accountBalance(acct('a', 500), [])).toEqual({ ok: true, value: 500 });
  });

  it('applies income, expense and ignores other accounts', () => {
    const txs = [
      tx({ kind: 'income', amount: sen(1000) }, '1'),
      tx({ kind: 'expense', amount: sen(300) }, '2'),
      tx({ kind: 'income', accountId: 'z', amount: sen(9999) }, '3'),
    ];
    expect(accountBalance(acct('a', 0), txs)).toEqual({ ok: true, value: 700 });
  });

  it('allows negative balances', () => {
    const txs = [tx({ kind: 'expense', amount: sen(250) })];
    expect(accountBalance(acct('a', 100), txs)).toEqual({ ok: true, value: -150 });
  });

  it('subtracts outgoing and adds incoming transfers', () => {
    const t = tx({ kind: 'transfer', fromAccountId: 'a', toAccountId: 'b', amount: sen(400) });
    expect(accountBalance(acct('a', 1000), [t])).toEqual({ ok: true, value: 600 });
    expect(accountBalance(acct('b', 1000), [t])).toEqual({ ok: true, value: 1400 });
    expect(accountBalance(acct('c', 1000), [t])).toEqual({ ok: true, value: 1000 });
  });

  it('reports limit-exceeded when the result leaves the sen range', () => {
    const over = [tx({ kind: 'income', amount: sen(1) })];
    expect(accountBalance(acct('a', MAX_SEN), over)).toEqual({ ok: false, error: 'limit-exceeded' });
    const under = [tx({ kind: 'expense', amount: sen(1) })];
    expect(accountBalance(acct('a', -MAX_SEN), under)).toEqual({ ok: false, error: 'limit-exceeded' });
  });

  it('accepts exactly the limit', () => {
    expect(accountBalance(acct('a', MAX_SEN), [])).toEqual({ ok: true, value: MAX_SEN });
  });
});

describe('combinedBalance', () => {
  it('is zero with no accounts', () => {
    expect(combinedBalance([], [])).toEqual({ ok: true, value: 0 });
  });

  it('excludes archived accounts', () => {
    const accounts = [acct('a', 1000), acct('b', 500, true)];
    expect(combinedBalance(accounts, [])).toEqual({ ok: true, value: 1000 });
  });

  it('is unchanged by a transfer between active accounts', () => {
    const accounts = [acct('a', 1000), acct('b', 500)];
    const t = tx({ kind: 'transfer', fromAccountId: 'a', toAccountId: 'b', amount: sen(300) });
    expect(combinedBalance(accounts, [t])).toEqual({ ok: true, value: 1500 });
  });

  it('drops money transferred to an archived account', () => {
    const accounts = [acct('a', 1000), acct('b', 500, true)];
    const t = tx({ kind: 'transfer', fromAccountId: 'a', toAccountId: 'b', amount: sen(300) });
    expect(combinedBalance(accounts, [t])).toEqual({ ok: true, value: 700 });
  });

  it('handles negative balances', () => {
    const accounts = [acct('a', 0), acct('b', 100)];
    const txs = [tx({ kind: 'expense', amount: sen(500) })];
    expect(combinedBalance(accounts, txs)).toEqual({ ok: true, value: -400 });
  });

  it('reports limit-exceeded when the sum overflows', () => {
    const accounts = [acct('a', MAX_SEN), acct('b', 1)];
    expect(combinedBalance(accounts, [])).toEqual({ ok: false, error: 'limit-exceeded' });
  });

  it('reports limit-exceeded when one account balance overflows', () => {
    const accounts = [acct('a', MAX_SEN), acct('b', -MAX_SEN)];
    const txs = [tx({ kind: 'income', accountId: 'a', amount: sen(1) })];
    expect(combinedBalance(accounts, txs)).toEqual({ ok: false, error: 'limit-exceeded' });
  });
});

describe('selectableAccountIds', () => {
  const accounts = [acct('a', 0), acct('b', 0, true), acct('c', 0, true)];

  it('is empty with no accounts', () => {
    expect(selectableAccountIds([]).size).toBe(0);
  });

  it('contains only active accounts when no transaction is edited', () => {
    expect([...selectableAccountIds(accounts)]).toEqual(['a']);
  });

  it('adds the archived account of an edited income/expense', () => {
    const ids = selectableAccountIds(accounts, tx({ kind: 'expense', accountId: 'b' }));
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('adds both archived accounts of an edited transfer', () => {
    const ids = selectableAccountIds(
      accounts,
      tx({ kind: 'transfer', fromAccountId: 'b', toAccountId: 'c' }),
    );
    expect([...ids].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('blockingTransactionCount', () => {
  it('is zero with no transactions', () => {
    expect(blockingTransactionCount('a', [])).toBe(0);
  });

  it('counts accountId, fromAccountId and toAccountId references', () => {
    const txs = [
      tx({ kind: 'income', accountId: 'a' }, '1'),
      tx({ kind: 'expense', accountId: 'a' }, '2'),
      tx({ kind: 'transfer', fromAccountId: 'a', toAccountId: 'b' }, '3'),
      tx({ kind: 'transfer', fromAccountId: 'b', toAccountId: 'a' }, '4'),
      tx({ kind: 'income', accountId: 'b' }, '5'),
    ];
    expect(blockingTransactionCount('a', txs)).toBe(4);
    expect(blockingTransactionCount('b', txs)).toBe(3);
    expect(blockingTransactionCount('z', txs)).toBe(0);
  });
});
