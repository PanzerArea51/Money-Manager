import { describe, expect, it } from 'vitest';
import { chooseStrategy } from './requestRouting';

const scope = 'https://panzerarea51.github.io/Money-Manager/';

describe('chooseStrategy', () => {
  it('uses navigation for a GET navigation in scope', () => {
    expect(chooseStrategy({ url: scope, mode: 'navigate', method: 'GET', scope })).toBe(
      'navigation',
    );
  });

  it('uses cache-first for an asset in scope', () => {
    expect(
      chooseStrategy({ url: `${scope}assets/index-abc.js`, mode: 'no-cors', method: 'GET', scope }),
    ).toBe('cache-first');
  });

  it('passes through cross-origin requests', () => {
    expect(
      chooseStrategy({
        url: 'https://example.com/Money-Manager/app.js',
        mode: 'cors',
        method: 'GET',
        scope,
      }),
    ).toBe('passthrough');
  });

  it('passes through same-origin requests outside the scope', () => {
    expect(
      chooseStrategy({
        url: 'https://panzerarea51.github.io/Other/index.html',
        mode: 'navigate',
        method: 'GET',
        scope,
      }),
    ).toBe('passthrough');
  });

  it('passes through POST requests', () => {
    expect(chooseStrategy({ url: scope, mode: 'cors', method: 'POST', scope })).toBe(
      'passthrough',
    );
  });
});
