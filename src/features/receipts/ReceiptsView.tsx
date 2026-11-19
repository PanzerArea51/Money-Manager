import { useState } from 'react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { formatMoney } from '../../domain/money';
import type { ReceiptListEntry } from '../../domain/receipts';
import type { ShoppingList, Transaction } from '../../domain/types';
import { useReceipts } from '../../hooks/useReceipts';
import { formatDisplayDate } from '../transactions/TransactionRow';
import { ReceiptPreview } from './ReceiptPreview';
import './ReceiptsView.css';

type ReceiptsViewProps = {
  /** Called to show the details of the transaction that owns a receipt. */
  onOpenTransaction: (transaction: Transaction) => void;
  /** Called to show the shopping list that owns a receipt. */
  onOpenShoppingList: (list: ShoppingList) => void;
};

function metaText(entry: ReceiptListEntry): string {
  const date = formatDisplayDate(entry.date);
  if (entry.source === 'shopping') {
    const price = entry.amount === undefined ? '' : ` \u00b7 ${formatMoney(entry.amount)}`;
    return `Shopping list \u00b7 ${date}${price}`;
  }
  return `${date} \u00b7 ${formatMoney(entry.amount)}`;
}

export function ReceiptsView({ onOpenTransaction, onOpenShoppingList }: ReceiptsViewProps) {
  const { status, entries, reload } = useReceipts();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <p className="receipts-view__status" role="status">
        Loading receipts…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <div className="receipts-view__status" role="alert">
        <p>Your receipts could not be loaded.</p>
        <Button onClick={() => void reload()}>Retry</Button>
      </div>
    );
  }
  if (entries.length === 0) {
    return <EmptyState message="No receipts yet. Attach one to a transaction or a shopping list." />;
  }

  const selected: ReceiptListEntry | undefined = entries.find((e) => e.key === selectedKey);
  const close = () => setSelectedKey(null);

  return (
    <>
      <ul className="receipts-view__list">
        {entries.map((entry) => (
          <li key={entry.key}>
            <button
              type="button"
              className="receipts-view__item"
              onClick={() => setSelectedKey(entry.key)}
            >
              <span className="receipts-view__title">{entry.title}</span>
              <span className="receipts-view__meta">{metaText(entry)}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected !== undefined ? (
        <Modal title={selected.title} onClose={close}>
          <ReceiptPreview receiptId={selected.receiptId} />
          <div className="receipts-view__actions">
            <Button
              variant="secondary"
              onClick={() => {
                close();
                if (selected.source === 'shopping') onOpenShoppingList(selected.list);
                else onOpenTransaction(selected.transaction);
              }}
            >
              {selected.source === 'shopping' ? 'View shopping list' : 'View transaction'}
            </Button>
            <Button onClick={close}>Close</Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
