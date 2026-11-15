import { Button } from './Button';
import { Modal } from './Modal';
import './ConfirmDialog.css';

type ConfirmDialogProps = {
  title: string;
  /** Name of the affected item, shown in the dialog body. */
  itemName: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  itemName,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="confirm-dialog__item">{itemName}</p>
      {message ? <p className="confirm-dialog__message">{message}</p> : null}
      <div className="confirm-dialog__actions">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
