import { useState } from 'react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { formatMoney } from '../../domain/money';
import type { ReceiptEntry } from '../../domain/receipts';
import type { Transaction } from '../../domain/types';
import { useReceipts } from '../../hooks/useReceipts';
import { formatDisplayDate } from '../transactions/TransactionRow';
import { ReceiptPreview } from './ReceiptPreview';
import './ReceiptsView.css';

type ReceiptsViewProps = {
  /** Called to show the details of the transaction that owns a receipt. */
  onOpenTransaction: (transaction: Transaction) => void;
};

export function ReceiptsView({ onOpenTransaction }: ReceiptsViewProps) {
  const { status, receipts, reload } = useReceipts();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  if (receipts.length === 0) {
    return <EmptyState message="No receipts yet. Attach one to a transaction." />;
  }

  const selected: ReceiptEntry | undefined = receipts.find((r) => r.id === selectedId);
  const close = () => setSelectedId(null);

  return (
    <>
      <ul className="receipts-view__list">
        {receipts.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className="receipts-view__item"
              onClick={() => setSelectedId(entry.id)}
            >
              <span className="receipts-view__title">{entry.title}</span>
              <span className="receipts-view__meta">
                {formatDisplayDate(entry.date)} &middot; {formatMoney(entry.amount)}
              </span>
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
                onOpenTransaction(selected);
              }}
            >
              View transaction
            </Button>
            <Button onClick={close}>Close</Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
