import { describe, expect, it, vi } from 'vitest';
import {
  checkSameDirectory,
  shouldDisableOverwrite,
  waitForResumeOrCancel,
} from './processing-utils';

describe('ProcessingView robustness helpers', () => {
  it('disables overwrite when output is no longer same as input', () => {
    expect(shouldDisableOverwrite(false, true)).toBe(true);
    expect(shouldDisableOverwrite(true, true)).toBe(false);
    expect(shouldDisableOverwrite(false, false)).toBe(false);
  });

  it('treats missing directories as not-same', async () => {
    const controller = new AbortController();
    await expect(checkSameDirectory(null, null, controller.signal)).resolves.toBe(false);
  });

  it('returns null when same-directory check is aborted mid-flight', async () => {
    let resolveCheck: ((value: boolean) => void) | undefined;

    const outputDir = {
      isSameEntry: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            resolveCheck = resolve;
          })
      ),
    } as unknown as FileSystemDirectoryHandle;

    const inputDir = {} as FileSystemDirectoryHandle;
    const controller = new AbortController();
    const pendingCheck = checkSameDirectory(outputDir, inputDir, controller.signal);

    controller.abort();
    resolveCheck?.(true);

    await expect(pendingCheck).resolves.toBeNull();
  });

  it('reports cancelled while paused when abort fires', async () => {
    vi.useFakeTimers();

    const controller = new AbortController();
    const resultPromise = waitForResumeOrCancel({
      getIsPaused: () => true,
      getIsCancelled: () => false,
      signal: controller.signal,
      pollMs: 50,
    });

    controller.abort();
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toBe('cancelled');

    vi.useRealTimers();
  });

  it('resumes after pause clears', async () => {
    vi.useFakeTimers();

    let paused = true;
    const controller = new AbortController();
    const resultPromise = waitForResumeOrCancel({
      getIsPaused: () => paused,
      getIsCancelled: () => false,
      signal: controller.signal,
      pollMs: 50,
    });

    paused = false;
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toBe('resumed');

    vi.useRealTimers();
  });
});
