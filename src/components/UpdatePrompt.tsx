import { Button } from './Button';
import './UpdatePrompt.css';

type UpdatePromptProps = {
  visible: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
};

/** Non-blocking banner shown when a new service worker version is waiting. */
export function UpdatePrompt({ visible, onUpdate, onDismiss }: UpdatePromptProps) {
  if (!visible) return null;
  return (
    <div className="update-prompt" role="status">
      <p className="update-prompt__message">A new version is available.</p>
      <div className="update-prompt__actions">
        <Button variant="primary" onClick={onUpdate}>
          Update
        </Button>
        <Button variant="secondary" onClick={onDismiss}>
          Later
        </Button>
      </div>
    </div>
  );
}
