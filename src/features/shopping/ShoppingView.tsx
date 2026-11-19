import { useState } from 'react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { formatMoney } from '../../domain/money';
import { isCompleted, shoppingProgress } from '../../domain/shopping';
import type { Account, ShoppingList } from '../../domain/types';
import { useFinance } from '../../hooks/FinanceProvider';
import { useShoppingLists } from '../../hooks/useShoppingLists';
import { formatDisplayDate } from '../transactions/TransactionRow';
import { ShoppingListDetails } from './ShoppingListDetails';
import { ShoppingListForm } from './ShoppingListForm';
import './ShoppingView.css';

type Dialog = { type: 'closed' } | { type: 'new' } | { type: 'details' | 'edit'; id: string };

type ShoppingViewProps = {
  /** Opens this list's details on first render, e.g. when coming from the Receipts tab. */
  initialListId?: string | null;
};

function metaText(list: ShoppingList, accounts: readonly Account[], completed: boolean): string {
  const { bought, total } = shoppingProgress(list.items);
  const parts = [formatDisplayDate(list.date), `${bought}/${total} bought`];
  if (list.price !== undefined) parts.push(formatMoney(list.price));
  const wallet = accounts.find((a) => a.id === list.accountId);
  if (wallet !== undefined) parts.push(wallet.name);
  if (list.receiptId !== undefined) parts.push('Receipt attached');
  if (completed) parts.push('Completed');
  return parts.join(' \u00b7 ');
}

export function ShoppingView({ initialListId = null }: ShoppingViewProps) {
  const { status, accounts, transactions, reload } = useFinance();
  const lists = useShoppingLists();
  const [dialog, setDialog] = useState<Dialog>(() =>
    initialListId === null ? { type: 'closed' } : { type: 'details', id: initialListId },
  );

  if (status === 'loading') {
    return (
      <p className="shopping-view__status" role="status">
        Loading shopping lists…
      </p>
    );
  }
  if (status === 'error' || status === 'fatal') {
    return (
      <div className="shopping-view__status" role="alert">
        <p>Your shopping lists could not be loaded.</p>
        <Button onClick={() => void reload()}>Retry</Button>
      </div>
    );
  }

  const close = () => setDialog({ type: 'closed' });
  const current =
    dialog.type === 'details' || dialog.type === 'edit'
      ? lists.shoppingLists.find((l) => l.id === dialog.id)
      : undefined;

  /** Active wallets, plus the wallet the edited list already uses (even if archived). */
  const choices = accounts.filter(
    (a) => !a.archived || (current !== undefined && a.id === current.accountId),
  );

  return (
    <div className="shopping-view">
      <div className="shopping-view__toolbar">
        <Button onClick={() => setDialog({ type: 'new' })}>New shopping list</Button>
      </div>

      {lists.shoppingLists.length === 0 ? (
        <EmptyState
          message="No shopping lists yet."
          actionLabel="Create your first list"
          onAction={() => setDialog({ type: 'new' })}
        />
      ) : (
        <ul className="shopping-view__list" aria-label="Shopping lists">
          {lists.shoppingLists.map((list) => {
            const { bought, total } = shoppingProgress(list.items);
            const done = total > 0 && bought === total;
            return (
              <li key={list.id}>
                <button
                  type="button"
                  className={
                    done ? 'shopping-view__item shopping-view__item--done' : 'shopping-view__item'
                  }
                  onClick={() => setDialog({ type: 'details', id: list.id })}
                >
                  <span className="shopping-view__title">{list.title}</span>
                  <span className="shopping-view__meta">{metaText(list, accounts, isCompleted(list, transactions))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {dialog.type === 'new' ? (
        <Modal title="New shopping list" onClose={close}>
          <ShoppingListForm
            accounts={choices}
            onCancel={close}
            onSubmit={async (draft, receipt) => {
              const result = await lists.createList(draft, receipt);
              if (result.ok) close();
              return result;
            }}
          />
        </Modal>
      ) : null}

      {dialog.type === 'details' && current !== undefined ? (
        <Modal title="Shopping list" onClose={close}>
          <ShoppingListDetails
            list={current}
            completed={isCompleted(current, transactions)}
            accounts={accounts}
            onComplete={() => lists.completeList(current.id)}
            onToggleItem={(itemId) => lists.toggleBought(current.id, itemId)}
            onEdit={() => setDialog({ type: 'edit', id: current.id })}
            onDelete={async () => {
              const result = await lists.deleteList(current.id);
              if (result.ok) close();
              return result;
            }}
            onClose={close}
          />
        </Modal>
      ) : null}

      {dialog.type === 'edit' && current !== undefined ? (
        <Modal title="Edit shopping list" onClose={close}>
          <ShoppingListForm
            accounts={choices}
            list={current}
            locked={isCompleted(current, transactions)}
            onCancel={() => setDialog({ type: 'details', id: current.id })}
            onSubmit={async (draft, receipt) => {
              const result = await lists.updateList(current.id, draft, receipt);
              if (result.ok) close();
              return result;
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
