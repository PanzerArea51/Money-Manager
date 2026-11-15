import type { ReactNode } from 'react';
import { Card } from '../../components/Card';
import { formatMoney } from '../../domain/money';
import type { AccountWithBalance } from '../../hooks/useAccounts';
import './AccountCard.css';

type AccountCardProps = {
  account: AccountWithBalance;
  onSelect?: () => void;
};

const TYPE_LABELS = { cash: 'Cash', bank: 'Bank', 'e-wallet': 'E-wallet' } as const;

export function AccountCard({ account, onSelect }: AccountCardProps) {
  const { balance } = account;
  let amount: ReactNode;
  if (balance === 'unavailable' || !balance.ok) {
    amount = (
      <span className="account-card__error" role="alert">
        Balance unavailable
      </span>
    );
  } else {
    const negative = balance.value < 0;
    amount = (
      <span className={negative ? 'account-card__balance account-card__balance--negative' : 'account-card__balance'}>
        {formatMoney(balance.value)}
      </span>
    );
  }

  return (
    <Card onClick={onSelect}>
      <div className="account-card">
        <div className="account-card__info">
          <span className="account-card__name">{account.name}</span>
          <span className="account-card__type">{TYPE_LABELS[account.type]}</span>
        </div>
        {amount}
      </div>
    </Card>
  );
}
