export type Strategy = 'navigation' | 'cache-first' | 'passthrough';

export type RoutingInput = {
  /** Absolute request URL. */
  url: string;
  /** Request.mode */
  mode: string;
  /** Request.method */
  method: string;
  /** Absolute scope URL, e.g. https://panzerarea51.github.io/Money-Manager/ */
  scope: string;
};

function parse(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function chooseStrategy({ url, mode, method, scope }: RoutingInput): Strategy {
  if (method !== 'GET') return 'passthrough';

  const requestUrl = parse(url);
  const scopeUrl = parse(scope);
  if (requestUrl === null || scopeUrl === null) return 'passthrough';

  if (requestUrl.origin !== scopeUrl.origin) return 'passthrough';
  if (!requestUrl.pathname.startsWith(scopeUrl.pathname)) return 'passthrough';

  return mode === 'navigate' ? 'navigation' : 'cache-first';
}
