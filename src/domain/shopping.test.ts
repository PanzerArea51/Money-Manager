import { describe, expect, it } from 'vitest';
import { combinedReceiptEntries } from './receipts';
import {
  compareShoppingListsNewestFirst,
  isCompleted,
  shoppingProgress,
  toggleItem,
  validateShoppingListInput,
} from './shopping';
import type { ShoppingListDraft } from './shopping';
import type { Sen, ShoppingItem, ShoppingList, Transaction } from './types';

const SELECTABLE = new Set(['wallet-1']);

function draft(overrides: Partial<ShoppingListDraft> = {}): ShoppingListDraft {
  return {
    title: 'Groceries',
    date: '2025-03-05',
    items: [{ id: 'i1', name: ' Milk ', bought: false }],
    accountId: '',
    price: '',
    ...overrides,
  };
}

function list(id: string, date: string, extra: Partial<ShoppingList> = {}): ShoppingList {
  return { id, title: id, date, items: [], createdAt: `${date}T00:00:00.000Z`, ...extra };
}

describe('validateShoppingListInput', () => {
  it('accepts a list with only a title and a date, trimming names', () => {
    const result = validateShoppingListInput(draft(), SELECTABLE);
    expect(result).toEqual({
      ok: true,
      value: {
        title: 'Groceries',
        date: '2025-03-05',
        items: [{ id: 'i1', name: 'Milk', bought: false }],
      },
    });
  });

  it('parses the price into integer sen and keeps the wallet', () => {
    const result = validateShoppingListInput(draft({ price: '12.5', accountId: 'wallet-1' }), SELECTABLE);
    expect(result.ok && result.value.price).toBe(1250);
    expect(result.ok && result.value.accountId).toBe('wallet-1');
  });

  it('rejects a blank title, an invalid date and a blank item name', () => {
    const result = validateShoppingListInput(
      draft({ title: '  ', date: '2025-02-30', items: [{ id: 'i', name: ' ', bought: false }] }),
      SELECTABLE,
    );
    expect(result).toEqual({
      ok: false,
      error: { title: 'title-length', date: 'invalid-date', items: 'item-length' },
    });
  });

  it('rejects zero, negative and malformed prices', () => {
    const errorFor = (price: string) => {
      const result = validateShoppingListInput(draft({ price }), SELECTABLE);
      return result.ok ? undefined : result.error.price;
    };
    expect(errorFor('0')).toBe('must-be-positive');
    expect(errorFor('-5')).toBe('sign-not-allowed');
    expect(errorFor('1.234')).toBe('too-many-fraction-digits');
    expect(errorFor('abc')).toBe('invalid-characters');
  });

  it('rejects a wallet that is not selectable', () => {
    const result = validateShoppingListInput(draft({ accountId: 'other' }), SELECTABLE);
    expect(result.ok ? undefined : result.error.accountId).toBe('not-selectable');
  });
});

describe('toggleItem and shoppingProgress', () => {
  const items: ShoppingItem[] = [
    { id: 'a', name: 'A', bought: false },
    { id: 'b', name: 'B', bought: true },
  ];

  it('flips only the matching item', () => {
    const next = toggleItem(items, 'a');
    expect(next.map((i) => i.bought)).toEqual([true, true]);
    expect(items[0]?.bought).toBe(false);
  });

  it('ignores unknown ids', () => {
    expect(toggleItem(items, 'zzz')).toEqual(items);
  });

  it('counts bought items, including an empty list', () => {
    expect(shoppingProgress(items)).toEqual({ bought: 1, total: 2 });
    expect(shoppingProgress([])).toEqual({ bought: 0, total: 0 });
  });
});

describe('isCompleted', () => {
  const tx = { id: 't1' } as Transaction;
  it('is true only while the linked expense exists', () => {
    expect(isCompleted(list('a', '2025-01-01', { transactionId: 't1' }), [tx])).toBe(true);
    expect(isCompleted(list('a', '2025-01-01', { transactionId: 't1' }), [])).toBe(false);
    expect(isCompleted(list('a', '2025-01-01'), [tx])).toBe(false);
  });
});

describe('compareShoppingListsNewestFirst', () => {
  it('sorts by date descending', () => {
    const sorted = [list('a', '2025-01-01'), list('b', '2025-03-01')].sort(
      compareShoppingListsNewestFirst,
    );
    expect(sorted.map((l) => l.id)).toEqual(['b', 'a']);
  });
});

describe('combinedReceiptEntries', () => {
  const tx = {
    id: 't1',
    kind: 'expense',
    accountId: 'wallet-1',
    title: 'Lunch',
    amount: 500 as Sen,
    date: '2025-03-02',
    time: '12:00',
    receiptId: 'r-tx',
    createdAt: '2025-03-02T12:00:00.000Z',
  } as Transaction;
  const noReceipt = { ...tx, id: 't2', receiptId: undefined } as Transaction;

  it('hides a completed list whose expense has the copied receipt', () => {
    const entries = combinedReceiptEntries(
      [tx],
      [list('s1', '2025-03-05', { receiptId: 'r-shop', transactionId: 't1' })],
    );
    expect(entries.map((e) => e.source)).toEqual(['transaction']);
  });

  it('includes shopping lists with receipts alongside transactions, newest first', () => {
    const entries = combinedReceiptEntries(
      [tx, noReceipt],
      [
        list('s1', '2025-03-05', { receiptId: 'r-shop', price: 2500 as Sen }),
        list('s2', '2025-03-06'),
      ],
    );
    expect(entries.map((e) => [e.source, e.receiptId])).toEqual([
      ['shopping', 'r-shop'],
      ['transaction', 'r-tx'],
    ]);
  });
});
