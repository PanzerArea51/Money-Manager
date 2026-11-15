import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The shared `renderHook` helper renders with `react-dom/server`, which never runs
 * effects, and no DOM library is available. So this test swaps `useState` and
 * `useEffect` for a tiny runtime that does run effects, cleanups and re-renders.
 * `useObjectUrl` itself is the real code.
 */
type Effect = { deps: unknown[] | undefined; cleanup: void | (() => void) };

const runtime = vi.hoisted(() => ({
  states: [] as unknown[],
  effects: [] as Effect[],
  pending: [] as Array<() => void>,
  stateIndex: 0,
  effectIndex: 0,
  rerender: () => {},
}));

vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const i = runtime.stateIndex++;
    if (!(i in runtime.states)) runtime.states[i] = initial;
    const set = (value: unknown) => {
      if (Object.is(runtime.states[i], value)) return;
      runtime.states[i] = value;
      runtime.rerender();
    };
    return [runtime.states[i], set];
  },
  useEffect: (fn: () => void | (() => void), deps?: unknown[]) => {
    const i = runtime.effectIndex++;
    const prev = runtime.effects[i];
    const changed = !prev || !deps || !prev.deps || deps.some((d, k) => !Object.is(d, prev.deps?.[k]));
    if (!changed) return;
    runtime.pending.push(() => {
      if (prev && typeof prev.cleanup === 'function') prev.cleanup();
      const entry: Effect = { deps, cleanup: undefined };
      runtime.effects[i] = entry; // register before running so a nested re-render sees the deps
      entry.cleanup = fn();
    });
  },
}));

import { useObjectUrl } from './useObjectUrl';

function renderUseObjectUrl(initial: Blob | null) {
  let blob = initial;
  const result = { current: null as string | null };
  const render = () => {
    runtime.stateIndex = 0;
    runtime.effectIndex = 0;
    result.current = useObjectUrl(blob);
    const effects = runtime.pending.splice(0);
    effects.forEach((run) => run());
  };
  runtime.rerender = render;
  render();
  return {
    result,
    setBlob(next: Blob | null) {
      blob = next;
      render();
    },
    unmount() {
      runtime.effects.forEach((e) => typeof e.cleanup === 'function' && e.cleanup());
    },
  };
}

describe('useObjectUrl', () => {
  let counter = 0;
  const create = vi.fn((_blob: Blob | MediaSource) => `blob:test/${++counter}`);
  const revoke = vi.fn((_url: string) => {});

  beforeEach(() => {
    counter = 0;
    runtime.states = [];
    runtime.effects = [];
    runtime.pending = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(create);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    create.mockClear();
    revoke.mockClear();
  });

  it('creates an object URL for the blob without revoking it', () => {
    const blob = new Blob(['a']);
    const { result } = renderUseObjectUrl(blob);
    expect(create).toHaveBeenCalledExactlyOnceWith(blob);
    expect(result.current).toBe('blob:test/1');
    expect(revoke).not.toHaveBeenCalled();
  });

  it('revokes the previous URL when the blob changes', () => {
    const { result, setBlob } = renderUseObjectUrl(new Blob(['a']));
    setBlob(new Blob(['b']));
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test/1');
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.current).toBe('blob:test/2');
  });

  it('revokes the URL when the blob becomes null', () => {
    const { result, setBlob } = renderUseObjectUrl(new Blob(['a']));
    setBlob(null);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test/1');
    expect(result.current).toBeNull();
  });

  it('revokes the URL on unmount', () => {
    const { unmount } = renderUseObjectUrl(new Blob(['a']));
    unmount();
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test/1');
  });

  it('does not create a URL when there is no blob', () => {
    const { result } = renderUseObjectUrl(null);
    expect(create).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });
});
