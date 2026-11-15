import { useId, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from '../../components/Button';
import type { ReceiptChange, ReceiptMimeType } from '../../domain/types';
import { validateReceiptFile } from '../../domain/validation';
import { compressImage } from '../../utils/compressImage';
import './ReceiptPicker.css';

const ACCEPT = 'image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf';
const ERROR_MESSAGES = {
  'unsupported-type': 'Only JPG, PNG or PDF files are accepted.',
  'too-large': 'The file is larger than 5 MB.',
} as const;
const PROCESS_FAILED = 'The image could not be processed.';

export type ReceiptPickerProps = {
  /** True when the transaction being edited already has a receipt. */
  hasExisting: boolean;
  value: ReceiptChange;
  onChange: (change: ReceiptChange) => void;
  disabled?: boolean;
};

export function ReceiptPicker({ hasExisting, value, onChange, disabled = false }: ReceiptPickerProps) {
  const uid = useId();
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const picked = input.files?.[0];
    input.value = '';
    if (picked === undefined) return;

    setError(undefined);
    setBusy(true);
    try {
      // Type check first (size 0) so unsupported files are never decoded.
      const typeCheck = validateReceiptFile({ type: picked.type, size: 0 });
      if (!typeCheck.ok) {
        setError(ERROR_MESSAGES[typeCheck.error]);
        return;
      }
      // Only images over the limit are changed; PDFs are returned untouched.
      let file: File;
      try {
        file = await compressImage(picked);
      } catch {
        setError(PROCESS_FAILED);
        return;
      }
      const check = validateReceiptFile(file);
      if (!check.ok) {
        setError(ERROR_MESSAGES[check.error]);
        return;
      }
      onChange({
        type: 'replace',
        receipt: {
          blob: file,
          mimeType: file.type as ReceiptMimeType,
          fileName: file.name,
          size: file.size,
        },
      });
    } finally {
      setBusy(false);
    }
  }

  function clearSelection() {
    setError(undefined);
    onChange({ type: 'keep' });
  }

  const inputId = `${uid}-file`;
  const errorId = `${uid}-error`;
  const hasCurrent = hasExisting && value.type === 'keep';

  let status: string;
  if (value.type === 'replace') status = `Selected: ${value.receipt.fileName}`;
  else if (value.type === 'remove') status = 'The current receipt will be removed.';
  else if (hasCurrent) status = 'A receipt is attached.';
  else status = 'No receipt selected.';

  return (
    <div className="receipt-picker">
      <label htmlFor={inputId} className="receipt-picker__label">
        Receipt (optional)
      </label>
      <input
        id={inputId}
        className="receipt-picker__input"
        type="file"
        accept={ACCEPT}
        disabled={disabled || busy}
        onChange={(e) => void handleFile(e)}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
      />
      <p className="receipt-picker__status" aria-live="polite">
        {busy ? 'Processing...' : status}
      </p>
      {error !== undefined && (
        <p id={errorId} className="receipt-picker__error" role="alert">
          {error}
        </p>
      )}
      <div className="receipt-picker__actions">
        {value.type === 'replace' && (
          <Button variant="secondary" onClick={clearSelection} disabled={disabled}>
            Remove selected file
          </Button>
        )}
        {hasCurrent && (
          <Button variant="secondary" onClick={() => onChange({ type: 'remove' })} disabled={disabled}>
            Remove receipt
          </Button>
        )}
        {value.type === 'remove' && (
          <Button variant="secondary" onClick={clearSelection} disabled={disabled}>
            Keep receipt
          </Button>
        )}
      </div>
    </div>
  );
}
