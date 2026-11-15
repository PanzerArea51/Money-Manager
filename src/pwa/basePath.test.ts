import { describe, expect, it } from 'vitest';
import { toBasePath } from './basePath';

describe('toBasePath', () => {
  it.each(['Money-Manager', '/Money-Manager/', 'Money-Manager/', '/Money-Manager'])(
    'normalizes %s',
    (input) => {
      expect(toBasePath(input)).toBe('/Money-Manager/');
    },
  );
});
