import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import '../../components/ConfirmDialog.css';

type DeleteBlockedDialogProps = {
  accountName: string;
  transactionCount: number;
  onArchive: () => void;
  onCancel: () => void;
};

export function DeleteBlockedDialog({
  accountName,
  transactionCount,
  onArchive,
  onCancel,
}: DeleteBlockedDialogProps) {
  const noun = transactionCount === 1 ? 'transaction' : 'transactions';
  return (
    <Modal title="Cannot delete account" onClose={onCancel}>
      <p className="confirm-dialog__item">{accountName}</p>
      <p className="confirm-dialog__message">
        This account has {transactionCount} {noun} and cannot be deleted. Archive it instead to
        hide it while keeping its history.
      </p>
      <div className="confirm-dialog__actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onArchive}>Archive instead</Button>
      </div>
    </Modal>
  );
}
