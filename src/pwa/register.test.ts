import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker, shouldPromptForUpdate } from './register';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('shouldPromptForUpdate', () => {
  it('is true for installed with a controller', () => {
    expect(shouldPromptForUpdate('installed', true)).toBe(true);
  });

  it('is false for installed without a controller', () => {
    expect(shouldPromptForUpdate('installed', false)).toBe(false);
  });

  it.each(['installing', 'activating', 'activated', 'redundant', 'parsed'])(
    'is false for state %s',
    (state) => {
      expect(shouldPromptForUpdate(state, true)).toBe(false);
      expect(shouldPromptForUpdate(state, false)).toBe(false);
    },
  );
});

describe('registerServiceWorker', () => {
  it('resolves without throwing when serviceWorker is absent', async () => {
    vi.stubGlobal('navigator', {});
    const onUpdateReady = vi.fn();
    await expect(registerServiceWorker(onUpdateReady)).resolves.toBeUndefined();
    expect(onUpdateReady).not.toHaveBeenCalled();
  });

  it('logs with console.error and does not throw when register rejects', async () => {
    const failure = new Error('register failed');
    const register = vi.fn().mockRejectedValue(failure);
    vi.stubGlobal('navigator', { serviceWorker: { register, controller: null } });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onUpdateReady = vi.fn();

    await expect(registerServiceWorker(onUpdateReady)).resolves.toBeUndefined();

    expect(register).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]).toContain(failure);
    expect(onUpdateReady).not.toHaveBeenCalled();
  });
});
