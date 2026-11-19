import { useCallback, useMemo } from 'react';
import { selectableAccountIds } from '../domain/accounts';
import { accountBalance } from '../domain/balance';
import { nowLocalTime } from '../domain/date';
import {
  compareShoppingListsNewestFirst,
  isCompleted,
  toggleItem,
  validateShoppingListInput,
} from '../domain/shopping';
import type { ShoppingListDraft } from '../domain/shopping';
import type { ReceiptChange, ShoppingList, ShoppingListInput, Transaction } from '../domain/types';
import { validateReceiptFile } from '../domain/validation';
import type { ActionResult } from './actionResult';
import { useFinance } from './FinanceProvider';

const NOT_READY_MESSAGE = 'The database is not ready yet.';
const COMPLETE_FAILED_MESSAGE = 'Could not complete the shopping list. Please try again.';
const ALREADY_COMPLETED_MESSAGE = 'This shopping list is already completed.';
const NEEDS_WALLET_AND_PRICE_MESSAGE = 'Set a wallet and a price before completing the list.';
const WALLET_NOT_ACTIVE_MESSAGE = 'The wallet is archived or deleted. Choose an active wallet first.';
const LIMIT_MESSAGE = 'This would push the wallet balance beyond the supported limit.';
const NOT_FOUND_MESSAGE = 'This shopping list no longer exists.';
export const SHOPPING_SAVE_FAILED_MESSAGE = 'Could not save the shopping list. Please try again.';
export const SHOPPING_DELETE_FAILED_MESSAGE = 'Could not delete the shopping list. Please try again.';

export type UseShoppingListsResult = {
  /** Newest first. */
  shoppingLists: ShoppingList[];
  createList(draft: ShoppingListDraft, receipt: ReceiptChange): Promise<ActionResult<ShoppingListDraft>>;
  updateList(
    id: string,
    draft: ShoppingListDraft,
    receipt: ReceiptChange,
  ): Promise<ActionResult<ShoppingListDraft>>;
  /** Ticks or unticks one item, keeping every other field and the receipt. */
  toggleBought(id: string, itemId: string): Promise<ActionResult>;
  deleteList(id: string): Promise<ActionResult>;
  /**
   * "Shopping complete": records an expense for the list's price on its wallet,
   * with a copy of the list's receipt, so the wallet balance updates.
   */
  completeList(id: string): Promise<ActionResult>;
};

function receiptRejected(change: ReceiptChange): string | undefined {
  if (change.type !== 'replace') return undefined;
  const check = validateReceiptFile({ type: change.receipt.mimeType, size: change.receipt.size });
  return check.ok ? undefined : `Receipt rejected: ${check.error}.`;
}

function toInput(list: ShoppingList): ShoppingListInput {
  return {
    title: list.title,
    date: list.date,
    items: list.items,
    ...(list.accountId !== undefined ? { accountId: list.accountId } : {}),
    ...(list.price !== undefined ? { price: list.price } : {}),
  };
}

export function useShoppingLists(): UseShoppingListsResult {
  const { accounts, transactions, shoppingLists, repos, actions } = useFinance();

  const sorted = useMemo(
    () => [...shoppingLists].sort(compareShoppingListsNewestFirst),
    [shoppingLists],
  );

  const createList = useCallback<UseShoppingListsResult['createList']>(
    async (draft, receiptChange) => {
      if (repos === null) return { ok: false, message: NOT_READY_MESSAGE };

      const validated = validateShoppingListInput(draft, selectableAccountIds(accounts));
      if (!validated.ok) {
        return { ok: false, errors: validated.error, message: 'Please fix the highlighted fields.' };
      }
      const rejected = receiptRejected(receiptChange);
      if (rejected !== undefined) return { ok: false, message: rejected };

      try {
        const created = await repos.shopping.add(
          validated.value,
          receiptChange.type === 'replace' ? receiptChange.receipt : undefined,
        );
        actions.upsertShoppingList(created);
        return { ok: true };
      } catch {
        return { ok: false, message: SHOPPING_SAVE_FAILED_MESSAGE };
      }
    },
    [accounts, repos, actions],
  );

  const updateList = useCallback<UseShoppingListsResult['updateList']>(
    async (id, draft, receiptChange) => {
      if (repos === null) return { ok: false, message: NOT_READY_MESSAGE };

      const existing = shoppingLists.find((l) => l.id === id);
      if (existing === undefined) return { ok: false, message: NOT_FOUND_MESSAGE };

      // The list's current wallet stays selectable even if it has been archived since.
      const selectable = new Set(selectableAccountIds(accounts));
      if (existing.accountId !== undefined) selectable.add(existing.accountId);

      // Once completed, wallet, price and receipt belong to the expense transaction.
      const locked = isCompleted(existing, transactions);
      const effectiveDraft = locked ? { ...draft, accountId: '', price: '' } : draft;
      const effectiveReceipt: ReceiptChange = locked ? { type: 'keep' } : receiptChange;

      const validated = validateShoppingListInput(effectiveDraft, selectable);
      if (!validated.ok) {
        return { ok: false, errors: validated.error, message: 'Please fix the highlighted fields.' };
      }
      const rejected = receiptRejected(effectiveReceipt);
      if (rejected !== undefined) return { ok: false, message: rejected };

      try {
        const input: ShoppingListInput = locked
          ? {
              ...validated.value,
              ...(existing.accountId !== undefined ? { accountId: existing.accountId } : {}),
              ...(existing.price !== undefined ? { price: existing.price } : {}),
            }
          : validated.value;
        const updated = await repos.shopping.update(id, input, effectiveReceipt);
        actions.upsertShoppingList(updated);
        return { ok: true };
      } catch {
        return { ok: false, message: SHOPPING_SAVE_FAILED_MESSAGE };
      }
    },
    [accounts, transactions, shoppingLists, repos, actions],
  );

  const toggleBought = useCallback<UseShoppingListsResult['toggleBought']>(
    async (id, itemId) => {
      if (repos === null) return { ok: false, message: NOT_READY_MESSAGE };
      const existing = shoppingLists.find((l) => l.id === id);
      if (existing === undefined) return { ok: false, message: NOT_FOUND_MESSAGE };

      const input = { ...toInput(existing), items: toggleItem(existing.items, itemId) };
      try {
        actions.upsertShoppingList(await repos.shopping.update(id, input, { type: 'keep' }));
        return { ok: true };
      } catch {
        return { ok: false, message: SHOPPING_SAVE_FAILED_MESSAGE };
      }
    },
    [shoppingLists, repos, actions],
  );

  const deleteList = useCallback<UseShoppingListsResult['deleteList']>(
    async (id) => {
      if (repos === null) return { ok: false, message: NOT_READY_MESSAGE };
      if (!shoppingLists.some((l) => l.id === id)) return { ok: false, message: NOT_FOUND_MESSAGE };
      try {
        await repos.shopping.remove(id);
        actions.removeShoppingList(id);
        return { ok: true };
      } catch {
        return { ok: false, message: SHOPPING_DELETE_FAILED_MESSAGE };
      }
    },
    [shoppingLists, repos, actions],
  );

  const completeList = useCallback<UseShoppingListsResult['completeList']>(
    async (id) => {
      if (repos === null) return { ok: false, message: NOT_READY_MESSAGE };
      const list = shoppingLists.find((l) => l.id === id);
      if (list === undefined) return { ok: false, message: NOT_FOUND_MESSAGE };
      if (isCompleted(list, transactions)) return { ok: false, message: ALREADY_COMPLETED_MESSAGE };
      if (list.accountId === undefined || list.price === undefined) {
        return { ok: false, message: NEEDS_WALLET_AND_PRICE_MESSAGE };
      }
      const account = accounts.find((a) => a.id === list.accountId && !a.archived);
      if (account === undefined) return { ok: false, message: WALLET_NOT_ACTIVE_MESSAGE };

      const expense = {
        kind: 'expense',
        title: list.title,
        amount: list.price,
        date: list.date,
        time: nowLocalTime(),
        accountId: account.id,
      } as const;
      const preview = { ...expense, id: '', createdAt: '' } as Transaction;
      if (!accountBalance(account, [...transactions, preview]).ok) {
        return { ok: false, message: LIMIT_MESSAGE };
      }

      try {
        const result = await repos.shopping.complete(id, expense);
        actions.upsertTransaction(result.transaction);
        actions.upsertShoppingList(result.list);
        return { ok: true };
      } catch {
        return { ok: false, message: COMPLETE_FAILED_MESSAGE };
      }
    },
    [accounts, transactions, shoppingLists, repos, actions],
  );

  return { shoppingLists: sorted, createList, updateList, toggleBought, deleteList, completeList };
}
