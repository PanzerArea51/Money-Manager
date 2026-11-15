import { summarize } from './cashflow';
import type { LocalDate, Period, Sen, Transaction } from './types';
import { isWithin, periodFor, weekStart } from './week';

export type WeekGroup = {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  net: Sen;
  transactions: Transaction[];
};

/** Newest first: date, then time, then creation time, then id for a stable total order. */
export function compareTransactionsNewestFirst(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.time !== b.time) return a.time < b.time ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

/**
 * Groups transactions into Monday-to-Sunday weeks, newest week first, each group
 * sorted newest first. Week net follows the `summarize` rule (transfers excluded).
 * Only weeks that contain transactions appear.
 */
export function groupByWeek(txs: readonly Transaction[]): WeekGroup[] {
  const byWeek = new Map<LocalDate, Transaction[]>();
  for (const tx of txs) {
    const key = weekStart(tx.date);
    const list = byWeek.get(key);
    if (list) list.push(tx);
    else byWeek.set(key, [tx]);
  }
  return [...byWeek.keys()]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((key) => {
      const period = periodFor('week', key);
      const transactions = (byWeek.get(key) ?? []).sort(compareTransactionsNewestFirst);
      const summary = summarize(transactions, period);
      // Amounts are range-checked on write, so overflow is not expected here;
      // fall back to the exact sum rather than dropping the group.
      const net = summary.ok ? summary.value.net : rawNet(transactions);
      return { weekStart: period.start, weekEnd: period.end, net, transactions };
    });
}

function rawNet(txs: readonly Transaction[]): Sen {
  let net = 0;
  for (const tx of txs) {
    if (tx.kind === 'income') net += tx.amount;
    else if (tx.kind === 'expense') net -= tx.amount;
  }
  return net as Sen;
}

/**
 * The newest week group (groups are newest first) holding a transaction dated
 * within the month, or undefined if there is none.
 */
export function findWeekForMonth(
  groups: readonly WeekGroup[],
  month: Period,
): WeekGroup | undefined {
  return groups.find((g) => g.transactions.some((tx) => isWithin(tx.date, month)));
}
