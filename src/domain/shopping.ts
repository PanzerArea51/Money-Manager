import { parseLocalDate } from './date';
import { MAX_SEN, parseMoney } from './money';
import type {
  FieldErrors,
  Result,
  ShoppingItem,
  ShoppingList,
  ShoppingListInput,
  Transaction,
} from './types';
import { MAX_TITLE_LENGTH } from './validation';

export const MAX_ITEM_NAME_LENGTH = 100;
export const MAX_SHOPPING_ITEMS = 200;

export type ShoppingListDraft = {
  title: string;
  date: string;
  items: ShoppingItem[];
  /** Empty string means no wallet. */
  accountId: string;
  /** Empty string means no price. */
  price: string;
};

function validLength(s: string, max: number): boolean {
  const len = s.trim().length;
  return len >= 1 && len <= max;
}

export function validateShoppingListInput(
  d: ShoppingListDraft,
  selectableAccountIds: ReadonlySet<string>,
): Result<ShoppingListInput, FieldErrors<ShoppingListDraft>> {
  const errors: FieldErrors<ShoppingListDraft> = {};

  if (!validLength(d.title, MAX_TITLE_LENGTH)) errors.title = 'title-length';

  const date = parseLocalDate(d.date);
  if (!date.ok) errors.date = date.error;

  if (d.items.length > MAX_SHOPPING_ITEMS) errors.items = 'too-many-items';
  else if (d.items.some((item) => !validLength(item.name, MAX_ITEM_NAME_LENGTH))) {
    errors.items = 'item-length';
  }

  if (d.accountId !== '' && !selectableAccountIds.has(d.accountId)) {
    errors.accountId = 'not-selectable';
  }

  let price: ShoppingListInput['price'];
  if (d.price.trim() !== '') {
    const parsed = parseMoney(d.price.trim(), { allowNegative: false });
    if (!parsed.ok) errors.price = parsed.error;
    else if (parsed.value <= 0) errors.price = 'must-be-positive';
    else if (parsed.value > MAX_SEN) errors.price = 'out-of-range';
    else price = parsed.value;
  }

  if (Object.keys(errors).length > 0 || !date.ok) return { ok: false, error: errors };

  return {
    ok: true,
    value: {
      title: d.title.trim(),
      date: date.value,
      items: d.items.map((item) => ({ ...item, name: item.name.trim() })),
      ...(d.accountId !== '' ? { accountId: d.accountId } : {}),
      ...(price !== undefined ? { price } : {}),
    },
  };
}

/** A list is completed while the expense transaction it created still exists. */
export function isCompleted(list: ShoppingList, transactions: readonly Transaction[]): boolean {
  return list.transactionId !== undefined && transactions.some((t) => t.id === list.transactionId);
}

/** Flips `bought` on the item with the given id; other items are untouched. */
export function toggleItem(items: readonly ShoppingItem[], itemId: string): ShoppingItem[] {
  return items.map((item) => (item.id === itemId ? { ...item, bought: !item.bought } : item));
}

export function shoppingProgress(items: readonly ShoppingItem[]): { bought: number; total: number } {
  return { bought: items.filter((item) => item.bought).length, total: items.length };
}

/** Newest first: date, then creation time, then id for a stable total order. */
export function compareShoppingListsNewestFirst(a: ShoppingList, b: ShoppingList): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}
