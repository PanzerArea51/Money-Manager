import { useCallback, useEffect, useRef, useState } from 'react';
import { registerServiceWorker } from '../pwa/register';

export type ServiceWorkerUpdate = {
  updateReady: boolean;
  apply: () => void;
  dismiss: () => void;
};

/**
 * Registers the service worker once (production only) and exposes the update prompt state.
 * `apply` activates the waiting worker; `dismiss` only hides the prompt.
 */
export function useServiceWorkerUpdate(): ServiceWorkerUpdate {
  const [updateReady, setUpdateReady] = useState(false);
  const applyRef = useRef<(() => void) | null>(null);
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD || registeredRef.current) return;
    registeredRef.current = true;
    void registerServiceWorker((applyUpdate) => {
      applyRef.current = applyUpdate;
      setUpdateReady(true);
    });
  }, []);

  const apply = useCallback(() => {
    applyRef.current?.();
  }, []);

  const dismiss = useCallback(() => {
    setUpdateReady(false);
  }, []);

  return { updateReady, apply, dismiss };
}
