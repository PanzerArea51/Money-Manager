import type { Receipt } from '../../domain/types';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { useReceipt } from '../../hooks/useReceipt';
import './ReceiptPreview.css';

function ReceiptContent({ receipt }: { receipt: Receipt }) {
  const url = useObjectUrl(receipt.blob);
  if (url === null) return <p className="receipt-preview__status">Loading receipt...</p>;

  if (receipt.mimeType === 'application/pdf') {
    return (
      <a className="receipt-preview__link" href={url} target="_blank" rel="noopener noreferrer">
        Open PDF: {receipt.fileName}
      </a>
    );
  }
  return (
    <img
      className="receipt-preview__image"
      src={url}
      alt={`Receipt: ${receipt.fileName}`}
    />
  );
}

export function ReceiptPreview({ receiptId }: { receiptId: string }) {
  const state = useReceipt(receiptId);

  return (
    <div className="receipt-preview">
      {state.status === 'loading' && <p className="receipt-preview__status">Loading receipt...</p>}
      {state.status === 'missing' && (
        <p className="receipt-preview__status" role="alert">
          The attached receipt could not be found.
        </p>
      )}
      {state.status === 'error' && (
        <p className="receipt-preview__status" role="alert">
          The receipt could not be loaded.
        </p>
      )}
      {state.status === 'ready' && <ReceiptContent receipt={state.receipt} />}
    </div>
  );
}
