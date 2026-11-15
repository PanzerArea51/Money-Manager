import fc from 'fast-check';
import { describe, it } from 'vitest';
import { toBasePath } from './basePath';

// Feature: pwa-github-pages, Property 1: Base path normalization
// **Validates: Requirements 3.2, 11.3**
describe('Property 1: Base path normalization', () => {
  const name = fc.stringMatching(/^[^/]+$/).filter((s) => s.length > 0 && !s.includes('/'));
  const slashes = fc.nat(5).map((n) => '/'.repeat(n));

  it('wraps any name in single slashes regardless of surrounding slashes', () => {
    fc.assert(
      fc.property(name, slashes, slashes, (n, lead, trail) => {
        return toBasePath(`${lead}${n}${trail}`) === `/${n}/`;
      }),
      { numRuns: 100 },
    );
  });

  it('is idempotent on its own output', () => {
    fc.assert(
      fc.property(name, slashes, slashes, (n, lead, trail) => {
        const once = toBasePath(`${lead}${n}${trail}`);
        return toBasePath(once) === once;
      }),
      { numRuns: 100 },
    );
  });
});
