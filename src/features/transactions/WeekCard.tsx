import { useId, useState } from 'react';
import { formatMoney } from '../../domain/money';
import type { WeekGroup } from '../../domain/history';
import type { Transaction } from '../../domain/types';
import { TransactionRow, formatDisplayDate } from './TransactionRow';
import './WeekCard.css';

type WeekCardProps = {
  group: WeekGroup;
  accountName: (accountId: string) => string;
  onSelectTransaction: (transaction: Transaction) => void;
  defaultExpanded?: boolean;
};

export function WeekCard({
  group,
  accountName,
  onSelectTransaction,
  defaultExpanded = false,
}: WeekCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const net = group.net;
  const netSign = net > 0 ? '+' : '';
  const netClass = net > 0 ? 'income' : net < 0 ? 'expense' : 'zero';

  return (
    <section className="week-card" data-week-start={group.weekStart}>
      <h3 className="week-card__heading">
        <button
          type="button"
          className="week-card__toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="week-card__range">
            {formatDisplayDate(group.weekStart)} &ndash; {formatDisplayDate(group.weekEnd)}
          </span>
          <span className="week-card__net">
            <span className="week-card__net-label">Net</span>{' '}
            <span className={`week-card__net-value week-card__net-value--${netClass}`}>
              {netSign}
              {formatMoney(net)}
            </span>
          </span>
          <span className="week-card__chevron" aria-hidden="true">
            {expanded ? '\u25B2' : '\u25BC'}
          </span>
        </button>
      </h3>
      <div id={panelId} className="week-card__panel" hidden={!expanded}>
        {group.transactions.map((tx) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            accountName={accountName}
            onSelect={onSelectTransaction}
          />
        ))}
      </div>
    </section>
  );
}
