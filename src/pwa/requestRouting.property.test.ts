import fc from 'fast-check';
import { describe, it } from 'vitest';
import { chooseStrategy } from './requestRouting';

// Feature: pwa-github-pages, Property 4: Request routing
// **Validates: Requirements 4.3, 4.4, 4.5, 5.4, 5.5**
describe('Feature: pwa-github-pages, Property 4: Request routing', () => {
  const segment = fc.stringMatching(/^[a-z0-9]{1,8}$/);
  const host = fc.stringMatching(/^[a-z]{1,10}$/);
  const origin = fc.tuple(fc.constantFrom('http', 'https'), host).map(([p, h]) => `${p}://${h}.example.com`);
  const rest = fc.array(segment, { maxLength: 4 }).map((s) => s.join('/'));
  const modes = fc.constantFrom('navigate', 'cors', 'no-cors', 'same-origin');
  const methods = fc.constantFrom('POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS');

  const base = fc.record({ origin, repo: segment, rest, mode: modes });

  it('passes through non-GET requests', () => {
    fc.assert(
      fc.property(base, methods, ({ origin: o, repo, rest: r, mode }, method) => {
        return (
          chooseStrategy({ url: `${o}/${repo}/${r}`, mode, method, scope: `${o}/${repo}/` }) === 'passthrough'
        );
      }),
      { numRuns: 100 },
    );
  });

  it('passes through requests to a different origin', () => {
    fc.assert(
      fc.property(base, host, ({ origin: o, repo, rest: r, mode }, other) => {
        const otherOrigin = `${o}.${other}.test`;
        return (
          chooseStrategy({ url: `${otherOrigin}/${repo}/${r}`, mode, method: 'GET', scope: `${o}/${repo}/` }) ===
          'passthrough'
        );
      }),
      { numRuns: 100 },
    );
  });

  it('passes through paths outside the scope', () => {
    fc.assert(
      fc.property(base, ({ origin: o, repo, rest: r, mode }) => {
        // `${repo}z` can never start with `${repo}/`
        return (
          chooseStrategy({ url: `${o}/${repo}z/${r}`, mode, method: 'GET', scope: `${o}/${repo}/` }) ===
          'passthrough'
        );
      }),
      { numRuns: 100 },
    );
  });

  it('chooses navigation for navigate mode and cache-first otherwise when in scope', () => {
    fc.assert(
      fc.property(base, ({ origin: o, repo, rest: r, mode }) => {
        const result = chooseStrategy({ url: `${o}/${repo}/${r}`, mode, method: 'GET', scope: `${o}/${repo}/` });
        return result === (mode === 'navigate' ? 'navigation' : 'cache-first');
      }),
      { numRuns: 100 },
    );
  });
});
