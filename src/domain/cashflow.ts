import { isSen } from './money';
import type { LimitExceeded, Period, Result, Sen, Transaction } from './types';
import { isWithin } from './week';

export type CashFlowSummary = { totalIncome: Sen; totalExpenses: Sen; net: Sen };

/**
 * Income, expense and net for transactions dated within the period (inclusive).
 * Transfers are skipped; transactions of archived accounts are included.
 * Sums exactly and range-checks the results, so the outcome does not depend on order.
 */
export function summarize(
  txs: readonly Transaction[],
  p: Period,
): Result<CashFlowSummary, LimitExceeded> {
  let income = 0;
  let expenses = 0;
  for (const tx of txs) {
    if (tx.kind === 'transfer' || !isWithin(tx.date, p)) continue;
    if (tx.kind === 'income') income += tx.amount;
    else expenses += tx.amount;
  }
  const net = income - expenses;
  if (!isSen(income) || !isSen(expenses) || !isSen(net)) {
    return { ok: false, error: 'limit-exceeded' };
  }
  return { ok: true, value: { totalIncome: income, totalExpenses: expenses, net } };
}
