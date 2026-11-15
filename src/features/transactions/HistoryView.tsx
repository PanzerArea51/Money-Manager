import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { splitDate, todayLocal } from '../../domain/date';
import { findWeekForMonth } from '../../domain/history';
import type { Period, Transaction } from '../../domain/types';
import { isWithin, periodFor, shiftPeriod } from '../../domain/week';
import { useFinance } from '../../hooks/FinanceProvider';
import { useTransactions } from '../../hooks/useTransactions';
import { PeriodNavigator } from './PeriodNavigator';
import { WeekCard } from './WeekCard';
import { formatDisplayDate } from './TransactionRow';
import './HistoryView.css';

type HistoryMode = 'week' | 'month';

const MODES: readonly { value: HistoryMode; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const MONTH_FORMAT = new Intl.DateTimeFormat('en-MY', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

type HistoryViewProps = {
  onSelectTransaction: (transaction: Transaction) => void;
};

export function periodLabel(period: Period): string {
  if (period.unit === 'month') {
    const { year, month } = splitDate(period.start);
    return MONTH_FORMAT.format(new Date(Date.UTC(year, month - 1, 1)));
  }
  return `${formatDisplayDate(period.start)} \u2013 ${formatDisplayDate(period.end)}`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function HistoryView({ onSelectTransaction }: HistoryViewProps) {
  const { status, accounts, reload } = useFinance();
  const { history } = useTransactions();
  const [mode, setMode] = useState<HistoryMode>('week');
  const [period, setPeriod] = useState<Period>(() => periodFor('week', todayLocal()));
  const listRef = useRef<HTMLDivElement>(null);
  const isFirstTarget = useRef(true);

  const currentPeriod = periodFor(mode, todayLocal());
  const nextDisabled = period.start >= currentPeriod.start;

  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );
  const accountName = (id: string) => accountNames.get(id) ?? 'Unknown account';

  const target = useMemo(
    () =>
      period.unit === 'month'
        ? findWeekForMonth(history, period)
        : history.find((group) => isWithin(group.weekStart, period)),
    [history, period],
  );
  const targetStart = target?.weekStart;

  useEffect(() => {
    if (isFirstTarget.current) {
      isFirstTarget.current = false;
      return;
    }
    if (targetStart === undefined) return;
    const element = listRef.current?.querySelector(`[data-week-start="${targetStart}"]`);
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  }, [targetStart, period]);

  function changeMode(next: HistoryMode) {
    setMode(next);
    setPeriod(periodFor(next, todayLocal()));
  }

  if (status === 'loading') {
    return (
      <p className="history-view__status" role="status">
        Loading history…
      </p>
    );
  }
  if (status === 'error' || status === 'fatal') {
    return (
      <div className="history-view__status" role="alert">
        <p>Your history could not be loaded.</p>
        <Button onClick={() => void reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="history-view">
      <div className="history-view__modes" role="group" aria-label="Navigation mode">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="history-view__mode"
            aria-pressed={mode === value}
            onClick={() => changeMode(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <PeriodNavigator
        label={periodLabel(period)}
        unit={mode}
        onPrevious={() => setPeriod((p) => shiftPeriod(p, -1))}
        onNext={() => setPeriod((p) => (nextDisabled ? p : shiftPeriod(p, 1)))}
        nextDisabled={nextDisabled}
      />

      {history.length === 0 ? (
        <EmptyState message="No transactions yet." />
      ) : (
        <>
          {target === undefined ? (
            <EmptyState message={`No transactions for this ${mode}.`} />
          ) : null}
          <div ref={listRef} className="history-view__list">
            {history.map((group) => {
              const isTarget = group.weekStart === targetStart;
              return (
                <WeekCard
                  key={`${group.weekStart}-${isTarget ? 'target' : 'other'}`}
                  group={group}
                  accountName={accountName}
                  onSelectTransaction={onSelectTransaction}
                  defaultExpanded={isTarget}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
