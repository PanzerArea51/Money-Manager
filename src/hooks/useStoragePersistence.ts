import { useEffect, useState } from 'react';

/**
 * Asks the browser for persistent storage once on startup.
 * Returns `true` when the request was denied or is unsupported.
 */
export function useStoragePersistence(): boolean {
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!storage || typeof storage.persist !== 'function') {
      setDenied(true);
      return;
    }
    storage
      .persist()
      .then((granted) => {
        if (!cancelled) setDenied(!granted);
      })
      .catch(() => {
        if (!cancelled) setDenied(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return denied;
}
