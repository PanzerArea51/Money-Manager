import fc from 'fast-check';
import { describe, it } from 'vitest';
import { staleCacheNames } from './cacheNames';

// Feature: pwa-github-pages, Property 3: Stale cache selection
// **Validates: Requirements 5.2, 11.2**
describe('Feature: pwa-github-pages, Property 3: Stale cache selection', () => {
  const prefix = fc.string({ minLength: 1, maxLength: 6 });
  // Bias names toward sharing the prefix so both branches are exercised.
  const nameFor = (p: string) =>
    fc.oneof(
      fc.string({ maxLength: 8 }).map((s) => `${p}-${s}`),
      fc.string({ maxLength: 10 }),
      fc.constant(p),
    );
  const scenario = prefix.chain((p) =>
    fc.record({
      p: fc.constant(p),
      names: fc.array(nameFor(p), { maxLength: 15 }),
      current: nameFor(p),
    }),
  );

  it('returns exactly the prefixed names that differ from current', () => {
    fc.assert(
      fc.property(scenario, ({ p, names, current }) => {
        const result = staleCacheNames(names, p, current);
        const expected = names.filter((n) => n.startsWith(`${p}-`) && n !== current);
        return (
          result.length === expected.length &&
          result.every((n, i) => n === expected[i]) &&
          !result.includes(current) &&
          result.every((n) => n.startsWith(`${p}-`))
        );
      }),
      { numRuns: 100 },
    );
  });

  it('returns an empty list once the result has been removed', () => {
    fc.assert(
      fc.property(scenario, ({ p, names, current }) => {
        const stale = new Set(staleCacheNames(names, p, current));
        const remaining = names.filter((n) => !stale.has(n));
        return staleCacheNames(remaining, p, current).length === 0;
      }),
      { numRuns: 100 },
    );
  });
});
