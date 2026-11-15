import { useState } from 'react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { splitDate, todayLocal } from '../../domain/date';
import { formatMoney } from '../../domain/money';
import type { Period, PeriodUnit } from '../../domain/types';
import { periodFor, shiftPeriod } from '../../domain/week';
import { useFinance } from '../../hooks/FinanceProvider';
import { useTransactions } from '../../hooks/useTransactions';
import { PeriodNavigator } from '../transactions/PeriodNavigator';
import './CashFlowView.css';

const UNITS: readonly { value: PeriodUnit; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const MONTH_FORMAT = new Intl.DateTimeFormat('en-MY', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const DAY_FORMAT = new Intl.DateTimeFormat('en-MY', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDay(date: string): string {
  const { year, month, day } = splitDate(date);
  return DAY_FORMAT.format(new Date(Date.UTC(year, month - 1, day)));
}

function periodLabel(period: Period): string {
  if (period.unit === 'month') {
    const { year, month } = splitDate(period.start);
    return MONTH_FORMAT.format(new Date(Date.UTC(year, month - 1, 1)));
  }
  if (period.unit === 'day') return formatDay(period.start);
  return `${formatDay(period.start)} \u2013 ${formatDay(period.end)}`;
}

export function CashFlowView() {
  const { status, reload } = useFinance();
  const { cashFlow } = useTransactions();
  const [unit, setUnit] = useState<PeriodUnit>('month');
  const [period, setPeriod] = useState<Period>(() => periodFor('month', todayLocal()));

  const currentPeriod = periodFor(unit, todayLocal());
  const nextDisabled = period.start >= currentPeriod.start;

  function changeUnit(next: PeriodUnit) {
    setUnit(next);
    setPeriod(periodFor(next, todayLocal()));
  }

  if (status === 'loading') {
    return (
      <p className="cash-flow-view__status" role="status">
        Loading cash flow…
      </p>
    );
  }
  if (status === 'error' || status === 'fatal') {
    return (
      <div className="cash-flow-view__status" role="alert">
        <p>Your cash flow could not be loaded.</p>
        <Button onClick={() => void reload()}>Retry</Button>
      </div>
    );
  }

  const summary = cashFlow(period);

  return (
    <div className="cash-flow-view">
      <div className="cash-flow-view__units" role="group" aria-label="Period type">
        {UNITS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="cash-flow-view__unit"
            aria-pressed={unit === value}
            onClick={() => changeUnit(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <PeriodNavigator
        label={periodLabel(period)}
        unit={unit}
        onPrevious={() => setPeriod((p) => shiftPeriod(p, -1))}
        onNext={() => setPeriod((p) => (nextDisabled ? p : shiftPeriod(p, 1)))}
        nextDisabled={nextDisabled}
      />

      {summary.ok &&
      summary.value.totalIncome === 0 &&
      summary.value.totalExpenses === 0 ? (
        <EmptyState message="No income or expenses for this period." />
      ) : null}

      {summary.ok ? (
        <dl className="cash-flow-view__totals">
          <div className="cash-flow-view__row">
            <dt>Total income</dt>
            <dd className="cash-flow-view__value">{formatMoney(summary.value.totalIncome)}</dd>
          </div>
          <div className="cash-flow-view__row">
            <dt>Total expenses</dt>
            <dd className="cash-flow-view__value">{formatMoney(summary.value.totalExpenses)}</dd>
          </div>
          <div className="cash-flow-view__row cash-flow-view__row--net">
            <dt>Net cash flow</dt>
            <dd
              className={`cash-flow-view__value cash-flow-view__value--${
                summary.value.net < 0 ? 'negative' : summary.value.net > 0 ? 'positive' : 'zero'
              }`}
            >
              {formatMoney(summary.value.net)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="cash-flow-view__status" role="alert">
          The amount limit was exceeded, so totals for this period are unavailable.
        </p>
      )}
    </div>
  );
}
