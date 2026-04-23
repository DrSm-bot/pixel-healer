import { describe, expect, it, vi } from 'vitest';
import { writeBlobWithInvalidStateRecovery } from './useFileSystem';

function createDomException(name: string, message: string): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException(message, name);
  }

  const error = new Error(message);
  error.name = name;
  return error;
}

describe('writeBlobWithInvalidStateRecovery', () => {
  it('recovers from a first InvalidStateError by refreshing the file handle once', async () => {
    const blob = new Blob(['image-data']);
    const invalidState = createDomException('InvalidStateError', 'stale state');

    const firstHandle = {
      createWritable: vi.fn().mockRejectedValueOnce(invalidState),
    };

    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);

    const freshHandle = {
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    };

    const reacquireHandle = vi.fn().mockResolvedValue(freshHandle);

    await writeBlobWithInvalidStateRecovery(firstHandle, reacquireHandle, blob, 'frame-001.jpg');

    expect(firstHandle.createWritable).toHaveBeenCalledTimes(1);
    expect(reacquireHandle).toHaveBeenCalledTimes(1);
    expect(freshHandle.createWritable).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('fails with an explicit message after repeated InvalidStateError', async () => {
    const blob = new Blob(['image-data']);
    const firstInvalidState = createDomException('InvalidStateError', 'first stale state');
    const secondInvalidState = createDomException('InvalidStateError', 'second stale state');

    const firstHandle = {
      createWritable: vi.fn().mockRejectedValueOnce(firstInvalidState),
    };

    const freshHandle = {
      createWritable: vi.fn().mockRejectedValueOnce(secondInvalidState),
    };

    const reacquireHandle = vi.fn().mockResolvedValue(freshHandle);

    await expect(
      writeBlobWithInvalidStateRecovery(firstHandle, reacquireHandle, blob, 'frame-002.jpg')
    ).rejects.toThrow(
      'Failed to save "frame-002.jpg" after refreshing the file handle. The file state is still invalid.'
    );

    expect(firstHandle.createWritable).toHaveBeenCalledTimes(1);
    expect(reacquireHandle).toHaveBeenCalledTimes(1);
    expect(freshHandle.createWritable).toHaveBeenCalledTimes(1);
  });

  it('does not retry on non-InvalidStateError DOMException', async () => {
    const blob = new Blob(['image-data']);
    const notAllowed = createDomException('NotAllowedError', 'permission denied');

    const firstHandle = {
      createWritable: vi.fn().mockRejectedValueOnce(notAllowed),
    };

    const reacquireHandle = vi.fn();

    await expect(
      writeBlobWithInvalidStateRecovery(firstHandle, reacquireHandle, blob, 'frame-003.jpg')
    ).rejects.toBe(notAllowed);

    expect(firstHandle.createWritable).toHaveBeenCalledTimes(1);
    expect(reacquireHandle).not.toHaveBeenCalled();
  });
});
