import { cacheName, staleCacheNames } from './cacheNames';
import { chooseStrategy } from './requestRouting';

/** Injected at build time by the Vite service worker plugin. Relative to the scope. */
declare const __PRECACHE_URLS__: string[];
declare const __CACHE_PREFIX__: string;
declare const __CACHE_VERSION__: string;

// Minimal worker types. The project tsconfig has the DOM lib, not WebWorker.
type ExtendableEventLike = Event & { waitUntil(promise: Promise<unknown>): void };
type ExtendableMessageEventLike = ExtendableEventLike & { data: unknown };
type FetchEventLike = ExtendableEventLike & {
  request: Request;
  respondWith(response: Promise<Response>): void;
};
type WorkerScope = {
  registration: { scope: string };
  clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEventLike) => void): void;
  addEventListener(type: 'message', listener: (event: ExtendableMessageEventLike) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEventLike) => void): void;
};

const worker = self as unknown as WorkerScope;
const CURRENT_CACHE = cacheName(__CACHE_PREFIX__, __CACHE_VERSION__);

function isSkipWaiting(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'SKIP_WAITING'
  );
}

async function precache(): Promise<void> {
  const cache = await caches.open(CURRENT_CACHE);
  const requests = __PRECACHE_URLS__.map(
    (url) => new Request(new URL(url, worker.registration.scope).href, { cache: 'reload' }),
  );
  await cache.addAll(requests);
}

async function removeStaleCaches(): Promise<void> {
  const stale = staleCacheNames(await caches.keys(), __CACHE_PREFIX__, CURRENT_CACHE);
  await Promise.all(stale.map((name) => caches.delete(name)));
  await worker.clients.claim();
}

async function networkFirstNavigation(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(CURRENT_CACHE);
    const fallback = await cache.match(new URL('index.html', worker.registration.scope).href);
    if (fallback) return fallback;
    throw error;
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CURRENT_CACHE);
  const cached = await cache.match(request);
  return cached ?? fetch(request);
}

worker.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

worker.addEventListener('message', (event) => {
  if (isSkipWaiting(event.data)) {
    void worker.skipWaiting();
  }
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(removeStaleCaches());
});

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  const strategy = chooseStrategy({
    url: request.url,
    mode: request.mode,
    method: request.method,
    scope: worker.registration.scope,
  });
  if (strategy === 'passthrough') return;
  event.respondWith(
    strategy === 'navigation' ? networkFirstNavigation(request) : cacheFirst(request),
  );
});
