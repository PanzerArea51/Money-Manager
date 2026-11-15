import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FinanceContext } from '../../hooks/FinanceProvider';
import { createFakeFinance } from '../../hooks/testing/renderHook';
import type { FakeFinanceInit } from '../../hooks/testing/renderHook';
import { todayLocal } from '../../domain/date';
import type { Account, Sen, Transaction } from '../../domain/types';
import { periodFor } from '../../domain/week';
import { HistoryView, periodLabel } from './HistoryView';

// No DOM library is approved, so the view is rendered to static markup and the
// period switching logic is checked through the pure helpers it is built on.

const account: Account = {
  id: 'a1',
  name: 'Wallet',
  type: 'cash',
  openingBalance: 0 as Sen,
  archived: false,
  createdAt: '2025-01-01T00:00:00.000Z',
};

function render(init: FakeFinanceInit): string {
  const finance = createFakeFinance(init);
  return renderToStaticMarkup(
    createElement(
      FinanceContext.Provider,
      { value: finance.value() },
      createElement(HistoryView, { onSelectTransaction: () => undefined }),
    ),
  );
}

describe('HistoryView', () => {
  it('shows the empty state when there are no transactions', () => {
    const html = render({ accounts: [account], transactions: [] });
    expect(html).toContain('No transactions yet.');
  });

  it('starts in week mode with both mode buttons', () => {
    const html = render({ accounts: [account], transactions: [] });
    expect(html).toMatch(/aria-pressed="true"[^>]*>Week</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Month</);
  });

  it('shows a week card for a transaction in the current week', () => {
    const tx: Transaction = {
      id: 't1',
      kind: 'expense',
      title: 'Lunch',
      amount: 1250 as Sen,
      date: todayLocal(),
      time: '12:00',
      accountId: 'a1',
      createdAt: '2025-01-02T12:00:00.000Z',
    };
    const html = render({ accounts: [account], transactions: [tx] });
    expect(html).not.toContain('No transactions yet.');
    expect(html).toContain('data-week-start');
  });

  it('shows an alert with Retry when loading failed', () => {
    for (const status of ['error', 'fatal'] as const) {
      const html = render({ status });
      expect(html).toContain('role="alert"');
      expect(html).toContain('Your history could not be loaded.');
      expect(html).toContain('Retry');
    }
  });

  it('shows a loading indicator while loading', () => {
    expect(render({ status: 'loading' })).toContain('Loading history');
  });

  it('labels week and month periods differently', () => {
    const week = periodLabel(periodFor('week', '2025-01-15'));
    const month = periodLabel(periodFor('month', '2025-01-15'));
    expect(month).toBe('January 2025');
    expect(week).not.toBe(month);
    expect(week).toContain('\u2013');
  });
});
