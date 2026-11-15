import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { splitDate, todayLocal } from '../../domain/date';
import type { Sen, Transaction } from '../../domain/types';
import { periodFor, shiftPeriod } from '../../domain/week';
import { FinanceContext } from '../../hooks/FinanceProvider';
import { createFakeFinance } from '../../hooks/testing/renderHook';
import type { FakeFinanceInit } from '../../hooks/testing/renderHook';
import { CashFlowView } from './CashFlowView';

function render(init: FakeFinanceInit = {}): string {
  const finance = createFakeFinance(init);
  return renderToStaticMarkup(
    createElement(FinanceContext.Provider, { value: finance.value() }, createElement(CashFlowView)),
  );
}

function expense(amount: number, date: string): Transaction {
  return {
    id: `t-${date}-${amount}`,
    kind: 'expense',
    accountId: 'a1',
    title: 'Lunch',
    amount: amount as Sen,
    date,
    time: '12:00',
    createdAt: '2025-01-01T00:00:00.000Z',
  } as Transaction;
}

function currentMonthLabel(): string {
  const { year, month } = splitDate(todayLocal());
  return new Intl.DateTimeFormat('en-MY', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

describe('CashFlowView period selection', () => {
  it('defaults to the current month', () => {
    const html = render();
    expect(html).toContain(currentMonthLabel());
    expect(html).toMatch(/aria-pressed="true"[^>]*>Month</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Day</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Week</);
  });

  it('disables Next at the current period and keeps Previous enabled', () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Next month"/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="Previous month"/);
  });

  it('shows the empty state when the period has no income or expenses', () => {
    const html = render();
    expect(html).toContain('No income or expenses for this period.');
  });

  it('hides the empty state and shows totals when the month has transactions', () => {
    const html = render({ transactions: [expense(1250, todayLocal())] });
    expect(html).not.toContain('No income or expenses for this period.');
    expect(html).toContain('RM');
    expect(html).toContain('12.50');
  });

  it('shows the empty state when transactions exist only outside the current month', () => {
    const html = render({ transactions: [expense(1250, '2000-01-15')] });
    expect(html).toContain('No income or expenses for this period.');
  });

  it('shows a loading status while loading', () => {
    expect(render({ status: 'loading' })).toContain('Loading cash flow');
  });
});

describe('period selection logic used by CashFlowView', () => {
  const units = ['day', 'week', 'month'] as const;

  it.each(units)('resetting to %s yields the period containing today', (unit) => {
    const today = todayLocal();
    const period = periodFor(unit, today);
    expect(period.unit).toBe(unit);
    expect(period.start <= today && today <= period.end).toBe(true);
  });

  it.each(units)('next is enabled after going back and disabled again after returning (%s)', (unit) => {
    const current = periodFor(unit, todayLocal());
    const previous = shiftPeriod(current, -1);
    expect(previous.start >= current.start).toBe(false);
    expect(shiftPeriod(previous, 1).start).toBe(current.start);
  });
});
