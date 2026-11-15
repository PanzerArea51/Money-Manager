import { useEffect, useState } from 'react';
import type { Receipt } from '../domain/types';
import { useFinance } from './FinanceProvider';

export type ReceiptState =
  | { status: 'loading' }
  | { status: 'ready'; receipt: Receipt }
  | { status: 'missing' }
  | { status: 'error' };

/** Loads a receipt by id through the receipts repository. */
export function useReceipt(receiptId: string): ReceiptState {
  const { repos } = useFinance();
  const [state, setState] = useState<ReceiptState>({ status: 'loading' });

  useEffect(() => {
    if (repos === null) {
      setState({ status: 'loading' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    repos.receipts
      .get(receiptId)
      .then((receipt) => {
        if (cancelled) return;
        setState(receipt === undefined ? { status: 'missing' } : { status: 'ready', receipt });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [repos, receiptId]);

  return state;
}
