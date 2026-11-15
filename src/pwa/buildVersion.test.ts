import { describe, expect, it } from 'vitest';
import { computeBuildVersion } from './buildVersion';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('computeBuildVersion', () => {
  it('gives equal versions for equal inputs, regardless of order', () => {
    const a = { path: 'a.js', content: bytes(1, 2, 3) };
    const b = { path: 'b.css', content: bytes(4, 5) };
    expect(computeBuildVersion([a, b])).toBe(computeBuildVersion([b, a]));
  });

  it('returns 12 hex characters', () => {
    expect(computeBuildVersion([{ path: 'a.js', content: bytes(1) }])).toMatch(/^[0-9a-f]{12}$/);
  });

  it('changes when one byte changes', () => {
    const before = computeBuildVersion([{ path: 'a.js', content: bytes(1, 2, 3) }]);
    const after = computeBuildVersion([{ path: 'a.js', content: bytes(1, 2, 4) }]);
    expect(after).not.toBe(before);
  });
});
