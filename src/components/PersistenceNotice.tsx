import { useState } from 'react';
import { Button } from './Button';
import './PersistenceNotice.css';

/** Non-blocking, dismissible notice shown when persistent storage was denied or is unavailable. */
export function PersistenceNotice({ denied }: { denied: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  if (!denied || dismissed) return null;
  return (
    <div className="persistence-notice" role="status">
      <p className="persistence-notice__message">
        Your browser did not grant persistent storage, so it may delete your saved data when the
        device is low on storage.
      </p>
      <Button variant="secondary" onClick={() => setDismissed(true)}>
        Dismiss
      </Button>
    </div>
  );
}
