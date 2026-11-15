import { splitDate } from '../../domain/date';
import { formatMoney } from '../../domain/money';
import type { Transaction } from '../../domain/types';
import './TransactionRow.css';

const DATE_FORMAT = new Intl.DateTimeFormat('en-MY', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Formats a local YYYY-MM-DD date for display, e.g. "5 Mar 2024". */
export function formatDisplayDate(date: string): string {
  const { year, month, day } = splitDate(date);
  return DATE_FORMAT.format(new Date(Date.UTC(year, month - 1, day)));
}

type TransactionRowProps = {
  transaction: Transaction;
  /** Resolves an account id to its display name. */
  accountName: (accountId: string) => string;
  onSelect: (transaction: Transaction) => void;
};

function accountLabel(tx: Transaction, accountName: (id: string) => string): string {
  return tx.kind === 'transfer'
    ? `${accountName(tx.fromAccountId)} \u2192 ${accountName(tx.toAccountId)}`
    : accountName(tx.accountId);
}

function amountText(tx: Transaction): string {
  const money = formatMoney(tx.amount);
  if (tx.kind === 'income') return `+${money}`;
  if (tx.kind === 'expense') return `-${money}`;
  return money;
}

export function TransactionRow({ transaction, accountName, onSelect }: TransactionRowProps) {
  const label = accountLabel(transaction, accountName);
  return (
    <button
      type="button"
      className={`transaction-row transaction-row--${transaction.kind}`}
      onClick={() => onSelect(transaction)}
    >
      <span className="transaction-row__main">
        <span className="transaction-row__title">{transaction.title}</span>
        <span className="transaction-row__meta">
          {transaction.kind === 'transfer' && (
            <span className="transaction-row__badge">Transfer</span>
          )}
          <span>{label}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{formatDisplayDate(transaction.date)}</span>
        </span>
      </span>
      <span className="transaction-row__amount">{amountText(transaction)}</span>
    </button>
  );
}
