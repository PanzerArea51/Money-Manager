import { useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatMoney } from '../../domain/money';
import type { Account, Transaction } from '../../domain/types';
import type { ActionResult } from '../../hooks/actionResult';
import { ReceiptPreview } from '../receipts/ReceiptPreview';
import './TransactionDetails.css';

export type TransactionDetailsProps = {
  transaction: Transaction;
  /** All accounts, including archived ones, so archived names can be shown. */
  accounts: readonly Account[];
  onEdit: () => void;
  /** Deletes the transaction. On success the parent should close the details. */
  onDelete: () => Promise<ActionResult>;
  onClose: () => void;
};

const KIND_LABELS = { income: 'Income', expense: 'Expense', transfer: 'Transfer' } as const;
const UNKNOWN_ACCOUNT = 'Unknown account';

function accountLabel(accounts: readonly Account[], id: string): string {
  const account = accounts.find((a) => a.id === id);
  if (account === undefined) return UNKNOWN_ACCOUNT;
  return account.archived ? `${account.name} (archived)` : account.name;
}

function signedAmount(transaction: Transaction): string {
  const text = formatMoney(transaction.amount);
  if (transaction.kind === 'income') return `+${text}`;
  if (transaction.kind === 'expense') return `-${text}`;
  return text;
}

export function TransactionDetails({
  transaction,
  accounts,
  onEdit,
  onDelete,
  onClose,
}: TransactionDetailsProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleConfirmDelete() {
    if (deleting) return;
    setDeleting(true);
    setError(undefined);
    try {
      const result = await onDelete();
      if (!result.ok) setError(result.message);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Type', value: KIND_LABELS[transaction.kind] },
    { label: 'Amount', value: signedAmount(transaction) },
  ];
  if (transaction.kind === 'transfer') {
    rows.push(
      { label: 'From', value: accountLabel(accounts, transaction.fromAccountId) },
      { label: 'To', value: accountLabel(accounts, transaction.toAccountId) },
    );
  } else {
    rows.push({ label: 'Account', value: accountLabel(accounts, transaction.accountId) });
  }
  rows.push(
    { label: 'Date', value: transaction.date },
    { label: 'Time', value: transaction.time },
  );

  return (
    <section className="transaction-details" aria-labelledby="transaction-details-title">
      <h2 id="transaction-details-title" className="transaction-details__title">
        {transaction.title}
      </h2>

      <dl className="transaction-details__list">
        {rows.map((row) => (
          <div key={row.label} className="transaction-details__row">
            <dt>{row.label}</dt>
            <dd
              className={
                row.label === 'Amount'
                  ? `transaction-details__amount transaction-details__amount--${transaction.kind}`
                  : undefined
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="transaction-details__receipt">
        <h3 className="transaction-details__receipt-title">Receipt</h3>
        {transaction.receiptId === undefined ? (
          <p className="transaction-details__no-receipt">No receipt attached</p>
        ) : (
          <ReceiptPreview receiptId={transaction.receiptId} />
        )}
      </div>

      {error !== undefined && (
        <p className="transaction-details__error" role="alert">
          {error}
        </p>
      )}

      <div className="transaction-details__actions">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Delete transaction?"
          itemName={transaction.title}
          message="This also removes any attached receipt. This cannot be undone."
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          destructive
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => {
            if (!deleting) setConfirming(false);
          }}
        />
      )}
    </section>
  );
}
