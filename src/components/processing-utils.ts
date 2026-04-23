export function shouldDisableOverwrite(
  isOutputSameAsInput: boolean,
  allowOverwrite: boolean,
  hasVerifiedDirectoryComparison = true
): boolean {
  return hasVerifiedDirectoryComparison && !isOutputSameAsInput && allowOverwrite;
}

export async function checkSameDirectory(
  outputDir: FileSystemDirectoryHandle | null,
  inputDir: FileSystemDirectoryHandle | null,
  signal: AbortSignal
): Promise<boolean | null> {
  if (!outputDir || !inputDir) {
    return false;
  }

  if (signal.aborted) {
    return null;
  }

  const same = await outputDir.isSameEntry(inputDir);

  if (signal.aborted) {
    return null;
  }

  return same;
}

export async function waitForResumeOrCancel(options: {
  getIsPaused: () => boolean;
  getIsCancelled: () => boolean;
  signal: AbortSignal;
  pollMs?: number;
}): Promise<'resumed' | 'cancelled'> {
  const { getIsPaused, getIsCancelled, signal, pollMs = 100 } = options;

  while (getIsPaused()) {
    if (signal.aborted || getIsCancelled()) {
      return 'cancelled';
    }

    await sleep(pollMs, signal);
  }

  return signal.aborted || getIsCancelled() ? 'cancelled' : 'resumed';
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', onAbort);
      resolve();
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}
