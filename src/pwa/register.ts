export type UpdateListener = (apply: () => void) => void;

let controllerListenerAdded = false;
let reloaded = false;

/** Show the update prompt only when a worker finished installing and a controller already exists. */
export function shouldPromptForUpdate(workerState: string, hasController: boolean): boolean {
  return workerState === 'installed' && hasController;
}

/** Registers one controllerchange listener that reloads the page at most once. */
function ensureReloadOnControllerChange(): void {
  if (controllerListenerAdded) return;
  controllerListenerAdded = true;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

function makeApply(registration: ServiceWorkerRegistration, fallback: ServiceWorker | null): () => void {
  return () => {
    ensureReloadOnControllerChange();
    const target = registration.waiting ?? fallback;
    target?.postMessage({ type: 'SKIP_WAITING' });
  };
}

export async function registerServiceWorker(onUpdateReady: UpdateListener): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const baseUrl = import.meta.env.BASE_URL;
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register(`${baseUrl}sw.js`, {
      scope: baseUrl,
      updateViaCache: 'none',
    });
  } catch (error) {
    console.error('Service worker registration failed', error);
    return;
  }

  const hasController = (): boolean => navigator.serviceWorker.controller !== null;

  if (registration.waiting && hasController()) {
    onUpdateReady(makeApply(registration, registration.waiting));
  }

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (shouldPromptForUpdate(worker.state, hasController())) {
        onUpdateReady(makeApply(registration, worker));
      }
    });
  });
}
