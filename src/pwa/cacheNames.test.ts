import { describe, expect, it } from 'vitest';
import { cacheName, cachePrefix, staleCacheNames } from './cacheNames';

describe('cacheName and cachePrefix', () => {
  it('joins prefix and version', () => {
    expect(cacheName('money-manager', 'abc123')).toBe('money-manager-abc123');
  });

  it('lowercases the repository name', () => {
    expect(cachePrefix('Money-Manager')).toBe('money-manager');
  });
});

describe('staleCacheNames', () => {
  const prefix = 'money-manager';
  const current = 'money-manager-v2';

  it('returns nothing for an empty list', () => {
    expect(staleCacheNames([], prefix, current)).toEqual([]);
  });

  it('keeps the current cache', () => {
    expect(staleCacheNames([current], prefix, current)).toEqual([]);
  });

  it('returns older caches with this prefix', () => {
    expect(staleCacheNames(['money-manager-v1', current], prefix, current)).toEqual([
      'money-manager-v1',
    ]);
  });

  it('keeps caches that belong to another project', () => {
    expect(staleCacheNames(['other-app-v1', 'money-manager2-v1'], prefix, current)).toEqual([]);
  });
});
