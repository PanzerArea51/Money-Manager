import { describe, expect, it } from 'vitest';
import {
  MAX_RECEIPT_BYTES,
  validateAccountInput,
  validateReceiptFile,
  validateTransactionInput,
  type AccountDraft,
  type TransactionDraft,
} from './validation';

const SELECTABLE = new Set(['a1', 'a2']);

const accountDraft = (over: Partial<AccountDraft> = {}): AccountDraft => ({
  name: 'Wallet',
  type: 'cash',
  startingBalance: '10.00',
  ...over,
});

const txDraft = (over: Partial<TransactionDraft> = {}): TransactionDraft => ({
  kind: 'expense',
  title: 'Lunch',
  amount: '12.50',
  date: '2024-03-15',
  time: '12:30',
  accountId: 'a1',
  ...over,
});

describe('validateAccountInput', () => {
  it('accepts a valid draft and trims the name', () => {
    const r = validateAccountInput(accountDraft({ name: '  Wallet  ' }));
    expect(r).toEqual({ ok: true, value: { name: 'Wallet', type: 'cash', openingBalance: 1000 } });
  });

  it('accepts a negative starting balance', () => {
    const r = validateAccountInput(accountDraft({ startingBalance: '-5.00' }));
    expect(r.ok && r.value.openingBalance).toBe(-500);
  });

  it('accepts a 50 character name and rejects 51', () => {
    expect(validateAccountInput(accountDraft({ name: 'a'.repeat(50) })).ok).toBe(true);
    const r = validateAccountInput(accountDraft({ name: 'a'.repeat(51) }));
    expect(r).toEqual({ ok: false, error: { name: 'name-length' } });
  });

  it('rejects empty and whitespace-only names', () => {
    for (const name of ['', '   ']) {
      const r = validateAccountInput(accountDraft({ name }));
      expect(r).toEqual({ ok: false, error: { name: 'name-length' } });
    }
  });

  it('rejects an unknown type and a bad balance', () => {
    const r = validateAccountInput(accountDraft({ type: 'crypto', startingBalance: 'abc' }));
    expect(r).toEqual({
      ok: false,
      error: { type: 'invalid-type', startingBalance: 'invalid-characters' },
    });
  });

  it('reports all invalid fields in one pass', () => {
    const r = validateAccountInput({ name: ' ', type: 'x', startingBalance: '' });
    expect(!r.ok && Object.keys(r.error).sort()).toEqual(['name', 'startingBalance', 'type']);
  });
});

describe('validateTransactionInput', () => {
  it('accepts a valid expense and trims the title', () => {
    const r = validateTransactionInput(txDraft({ title: ' Lunch ' }), SELECTABLE);
    expect(r).toEqual({
      ok: true,
      value: {
        kind: 'expense',
        title: 'Lunch',
        amount: 1250,
        date: '2024-03-15',
        time: '12:30',
        accountId: 'a1',
      },
    });
  });

  it('accepts a valid income', () => {
    const r = validateTransactionInput(txDraft({ kind: 'income' }), SELECTABLE);
    expect(r.ok && r.value.kind).toBe('income');
  });

  it('accepts a valid transfer', () => {
    const r = validateTransactionInput(
      txDraft({ kind: 'transfer', accountId: undefined, fromAccountId: 'a1', toAccountId: 'a2' }),
      SELECTABLE,
    );
    expect(r.ok && r.value).toMatchObject({ kind: 'transfer', fromAccountId: 'a1', toAccountId: 'a2' });
  });

  it('accepts 100 character titles and rejects 101 or blank', () => {
    expect(validateTransactionInput(txDraft({ title: 'a'.repeat(100) }), SELECTABLE).ok).toBe(true);
    for (const title of ['a'.repeat(101), '', '   ']) {
      const r = validateTransactionInput(txDraft({ title }), SELECTABLE);
      expect(r).toEqual({ ok: false, error: { title: 'title-length' } });
    }
  });

  it('rejects zero amounts', () => {
    for (const amount of ['0', '0.00']) {
      const r = validateTransactionInput(txDraft({ amount }), SELECTABLE);
      expect(r).toEqual({ ok: false, error: { amount: 'must-be-positive' } });
    }
  });

  it('rejects negative amounts', () => {
    const r = validateTransactionInput(txDraft({ amount: '-1' }), SELECTABLE);
    expect(r).toEqual({ ok: false, error: { amount: 'sign-not-allowed' } });
  });

  it('accepts the maximum amount and rejects above it', () => {
    const max = validateTransactionInput(txDraft({ amount: '999999999.99' }), SELECTABLE);
    expect(max.ok && max.value.amount).toBe(99_999_999_999);
    const over = validateTransactionInput(txDraft({ amount: '1000000000.00' }), SELECTABLE);
    expect(over.ok).toBe(false);
    expect(!over.ok && over.error.amount).toBeDefined();
  });

  it('rejects an invalid date and time', () => {
    const r = validateTransactionInput(txDraft({ date: '2024-02-30', time: '24:00' }), SELECTABLE);
    expect(r).toEqual({ ok: false, error: { date: 'invalid-date', time: 'invalid-time' } });
  });

  it('requires an account', () => {
    for (const accountId of [undefined, '']) {
      const r = validateTransactionInput(txDraft({ accountId }), SELECTABLE);
      expect(r).toEqual({ ok: false, error: { accountId: 'required' } });
    }
  });

  it('rejects an unselectable account', () => {
    const r = validateTransactionInput(txDraft({ accountId: 'archived' }), SELECTABLE);
    expect(r).toEqual({ ok: false, error: { accountId: 'not-selectable' } });
  });

  it('rejects a transfer to the same account', () => {
    const r = validateTransactionInput(
      txDraft({ kind: 'transfer', fromAccountId: 'a1', toAccountId: 'a1' }),
      SELECTABLE,
    );
    expect(r).toEqual({ ok: false, error: { toAccountId: 'same-account' } });
  });

  it('rejects a transfer with missing or unselectable accounts', () => {
    const r = validateTransactionInput(
      txDraft({ kind: 'transfer', fromAccountId: undefined, toAccountId: 'gone' }),
      SELECTABLE,
    );
    expect(r).toEqual({
      ok: false,
      error: { fromAccountId: 'required', toAccountId: 'not-selectable' },
    });
  });

  it('reports multiple simultaneous errors', () => {
    const r = validateTransactionInput(
      { kind: 'income', title: '', amount: '0', date: 'bad', time: 'bad' },
      SELECTABLE,
    );
    expect(!r.ok && Object.keys(r.error).sort()).toEqual([
      'accountId',
      'amount',
      'date',
      'time',
      'title',
    ]);
  });
});

describe('validateReceiptFile', () => {
  it('accepts the supported types', () => {
    for (const type of ['image/jpeg', 'image/png', 'application/pdf']) {
      expect(validateReceiptFile({ type, size: 1 }).ok).toBe(true);
    }
  });

  it('accepts exactly 5,242,880 bytes and rejects 5,242,881', () => {
    expect(MAX_RECEIPT_BYTES).toBe(5_242_880);
    expect(validateReceiptFile({ type: 'image/png', size: 5_242_880 }).ok).toBe(true);
    expect(validateReceiptFile({ type: 'image/png', size: 5_242_881 })).toEqual({
      ok: false,
      error: 'too-large',
    });
  });

  it('rejects unsupported MIME types', () => {
    expect(validateReceiptFile({ type: 'image/gif', size: 10 })).toEqual({
      ok: false,
      error: 'unsupported-type',
    });
  });

  it('reports the type error before the size error', () => {
    expect(validateReceiptFile({ type: 'text/plain', size: 99_999_999 })).toEqual({
      ok: false,
      error: 'unsupported-type',
    });
  });
});
