import { useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatMoney } from '../../domain/money';
import { shoppingProgress } from '../../domain/shopping';
import type { Account, ShoppingList } from '../../domain/types';
import type { ActionResult } from '../../hooks/actionResult';
import { ReceiptPreview } from '../receipts/ReceiptPreview';
import { formatDisplayDate } from '../transactions/TransactionRow';
import './ShoppingListDetails.css';

export type ShoppingListDetailsProps = {
  list: ShoppingList;
  /** True once "Shopping complete" has recorded the expense. */
  completed: boolean;
  /** All accounts, including archived ones, so archived names can be shown. */
  accounts: readonly Account[];
  onToggleItem: (itemId: string) => Promise<ActionResult>;
  onComplete: () => Promise<ActionResult>;
  onEdit: () => void;
  /** Deletes the list. On success the parent should close the details. */
  onDelete: () => Promise<ActionResult>;
  onClose: () => void;
};

const UNKNOWN_WALLET = 'Unknown wallet';

function walletLabel(accounts: readonly Account[], id: string | undefined): string {
  if (id === undefined) return 'Not set';
  const account = accounts.find((a) => a.id === id);
  if (account === undefined) return UNKNOWN_WALLET;
  return account.archived ? `${account.name} (archived)` : account.name;
}

export function ShoppingListDetails({
  list,
  completed,
  accounts,
  onToggleItem,
  onComplete,
  onEdit,
  onDelete,
  onClose,
}: ShoppingListDetailsProps) {
  const [confirming, setConfirming] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function run(action: () => Promise<ActionResult>) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await action();
      if (!result.ok) setError(result.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    await run(onDelete);
    setConfirming(false);
  }

  async function handleConfirmComplete() {
    await run(onComplete);
    setConfirmingComplete(false);
  }

  const { bought, total } = shoppingProgress(list.items);
  const canComplete = list.accountId !== undefined && list.price !== undefined;
  const wallet = walletLabel(accounts, list.accountId);

  return (
    <section className="shopping-details" aria-labelledby="shopping-details-title">
      <h2 id="shopping-details-title" className="shopping-details__title">
        {list.title}
      </h2>

      {total === 0 ? (
        <p className="shopping-details__none">No items in this list.</p>
      ) : (
        <>
          <p className="shopping-details__progress" aria-live="polite">
            {bought} of {total} bought
          </p>
          <ul className="shopping-details__items" aria-label="Items">
            {list.items.map((item) => (
              <li key={item.id}>
                <label
                  className={
                    item.bought
                      ? 'shopping-details__item shopping-details__item--bought'
                      : 'shopping-details__item'
                  }
                >
                  <input
                    type="checkbox"
                    checked={item.bought}
                    disabled={busy}
                    onChange={() => void run(() => onToggleItem(item.id))}
                  />
                  <span className="shopping-details__item-name">{item.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <dl className="shopping-details__list">
        <div className="shopping-details__row">
          <dt>Date</dt>
          <dd>{formatDisplayDate(list.date)}</dd>
        </div>
        <div className="shopping-details__row">
          <dt>Paid with</dt>
          <dd>{wallet}</dd>
        </div>
        <div className="shopping-details__row">
          <dt>Price</dt>
          <dd>{list.price === undefined ? 'Not set' : formatMoney(list.price)}</dd>
        </div>
        <div className="shopping-details__row">
          <dt>Status</dt>
          <dd>{completed ? 'Completed (expense recorded)' : 'Not completed'}</dd>
        </div>
      </dl>

      <div className="shopping-details__receipt">
        <h3 className="shopping-details__receipt-title">Receipt</h3>
        {list.receiptId === undefined ? (
          <p className="shopping-details__none">No receipt attached</p>
        ) : (
          <ReceiptPreview receiptId={list.receiptId} />
        )}
      </div>

      {!completed && !canComplete && (
        <p className="shopping-details__none">
          Choose a wallet and enter the price (Edit) to complete this list.
        </p>
      )}

      {error !== undefined && (
        <p className="shopping-details__error" role="alert">
          {error}
        </p>
      )}

      <div className="shopping-details__actions">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        {!completed && (
          <Button onClick={() => setConfirmingComplete(true)} disabled={!canComplete || busy}>
            Shopping complete
          </Button>
        )}
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      </div>

      {confirmingComplete && list.price !== undefined && (
        <ConfirmDialog
          title="Shopping complete?"
          itemName={list.title}
          message={`This records an expense of ${formatMoney(list.price)} on ${wallet}${
            list.receiptId !== undefined ? ' and attaches the receipt' : ''
          }. The wallet balance updates.`}
          confirmLabel={busy ? 'Saving...' : 'Complete'}
          onConfirm={() => void handleConfirmComplete()}
          onCancel={() => {
            if (!busy) setConfirmingComplete(false);
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Delete shopping list?"
          itemName={list.title}
          message={
            completed
              ? "This removes the list and its receipt. The expense transaction is kept. This cannot be undone."
              : "This also removes any attached receipt. This cannot be undone."
          }
          confirmLabel={busy ? 'Deleting...' : 'Delete'}
          destructive
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => {
            if (!busy) setConfirming(false);
          }}
        />
      )}
    </section>
  );
}
