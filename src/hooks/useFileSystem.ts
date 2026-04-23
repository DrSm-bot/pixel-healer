import { useCallback, useState } from 'react';
import type { ImageFile, SupportedExtension } from '@/types';

const SUPPORTED_EXTENSIONS: SupportedExtension[] = ['.jpg', '.jpeg', '.png'];

function isSupportedImage(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface UseFileSystemReturn {
  /** Whether File System Access API is supported */
  isSupported: boolean;
  /** Whether we're currently scanning */
  isScanning: boolean;
  /** Open directory picker and scan for images */
  selectDirectory: () => Promise<{
    handle: FileSystemDirectoryHandle;
    files: ImageFile[];
  } | null>;
  /** Open directory picker for output location */
  selectOutputDirectory: () => Promise<FileSystemDirectoryHandle | null>;
  /** Load an image file as ImageData */
  loadImageData: (file: ImageFile) => Promise<ImageData>;
  /** Save ImageData back to a file */
  saveImageData: (
    imageData: ImageData,
    handle: FileSystemFileHandle,
    format?: 'image/jpeg' | 'image/png'
  ) => Promise<void>;
  /** Save ImageData to a specific directory with a filename */
  saveImageToDirectory: (
    imageData: ImageData,
    directory: FileSystemDirectoryHandle,
    fileName: string,
    format?: 'image/jpeg' | 'image/png'
  ) => Promise<void>;
  /** Safely save ImageData by re-acquiring handle from directory (prevents stale handle errors) */
  saveImageToDirectorySafe: (
    imageData: ImageData,
    directory: FileSystemDirectoryHandle,
    fileName: string,
    format?: 'image/jpeg' | 'image/png'
  ) => Promise<void>;
}

export function useFileSystem(): UseFileSystemReturn {
  const [isScanning, setIsScanning] = useState(false);

  const isSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const selectDirectory = useCallback(async () => {
    if (!isSupported) {
      console.error('File System Access API not supported');
      return null;
    }

    try {
      const handle = await window.showDirectoryPicker({
        id: 'pixel-healer-input',
        mode: 'readwrite',
        startIn: 'pictures',
      });

      setIsScanning(true);

      const files: ImageFile[] = [];

      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && isSupportedImage(entry.name)) {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          files.push({
            name: entry.name,
            handle: fileHandle,
            size: file.size,
            processed: false,
          });
        }
      }

      // Sort by name (assumes sequential naming like IMG_0001.jpg)
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      setIsScanning(false);

      return { handle, files };
    } catch (err) {
      setIsScanning(false);
      // User cancelled the picker
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }, [isSupported]);

  const loadImageData = useCallback(async (file: ImageFile): Promise<ImageData> => {
    const blob = await file.handle.getFile();
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  }, []);

  const selectOutputDirectory = useCallback(async () => {
    if (!isSupported) {
      console.error('File System Access API not supported');
      return null;
    }

    try {
      const handle = await window.showDirectoryPicker({
        id: 'pixel-healer-output',
        mode: 'readwrite',
        startIn: 'pictures',
      });
      return handle;
    } catch (err) {
      // User cancelled the picker
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }, [isSupported]);

  const saveImageData = useCallback(
    async (
      imageData: ImageData,
      handle: FileSystemFileHandle,
      format: 'image/jpeg' | 'image/png' = 'image/jpeg'
    ): Promise<void> => {
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.putImageData(imageData, 0, 0);

      const options: ImageEncodeOptions =
        format === 'image/jpeg' ? { type: format, quality: 0.95 } : { type: format };
      const blob = await canvas.convertToBlob(options);

      // Attempt to write with retry logic for stale handle errors
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return; // Success
        } catch (err) {
          // InvalidStateError: "An operation that depends on state cached in an interface
          // object was made but the state had changed since it was read from disk."
          // This happens when the file handle is stale (file modified externally or
          // browser invalidated cached state). Retry is not helpful here without
          // re-acquiring the handle from the parent directory.
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt === 0 && err instanceof DOMException && err.name === 'InvalidStateError') {
            // For stale handle errors, we cannot recover without the parent directory
            // Throw immediately with a helpful error message
            throw new Error(
              `File handle is stale for "${handle.name}". ` +
              `This usually happens when the file was modified externally or too much time ` +
              `passed since the file was opened. Please try processing again.`
            );
          }
        }
      }

      throw lastError || new Error('Failed to save image data');
    },
    []
  );

  const saveImageToDirectory = useCallback(
    async (
      imageData: ImageData,
      directory: FileSystemDirectoryHandle,
      fileName: string,
      format: 'image/jpeg' | 'image/png' = 'image/jpeg'
    ): Promise<void> => {
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.putImageData(imageData, 0, 0);

      const options: ImageEncodeOptions =
        format === 'image/jpeg' ? { type: format, quality: 0.95 } : { type: format };
      const blob = await canvas.convertToBlob(options);

      const fileHandle = await directory.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    },
    []
  );

  /**
   * Safely save ImageData to a directory by always re-acquiring a fresh file handle.
   *
   * This method prevents "InvalidStateError: An operation that depends on state cached
   * in an interface object was made but the state had changed since it was read from disk."
   *
   * The error occurs when:
   * 1. A FileSystemFileHandle is obtained (e.g., during directory scan)
   * 2. Time passes or the file is modified externally
   * 3. The browser's cached file state becomes stale
   * 4. Attempting to createWritable() on the stale handle throws InvalidStateError
   *
   * This method mitigates the issue by:
   * - Always calling getFileHandle() immediately before writing (fresh state)
   * - Implementing retry logic with handle re-acquisition on InvalidStateError
   * - Ensuring atomic writes to prevent file corruption
   *
   * Use this instead of saveImageData() when you need to overwrite files in the same
   * directory where the original handles came from, especially after significant time
   * has passed or when there's a possibility of external file modifications.
   */
  const saveImageToDirectorySafe = useCallback(
    async (
      imageData: ImageData,
      directory: FileSystemDirectoryHandle,
      fileName: string,
      format: 'image/jpeg' | 'image/png' = 'image/jpeg'
    ): Promise<void> => {
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.putImageData(imageData, 0, 0);

      const options: ImageEncodeOptions =
        format === 'image/jpeg' ? { type: format, quality: 0.95 } : { type: format };
      const blob = await canvas.convertToBlob(options);

      // Re-acquire handle from directory to ensure fresh state
      // This prevents "InvalidStateError: state cached in interface object" errors
      const fileHandle = await directory.getFileHandle(fileName, { create: true });

      let lastError: Error | null = null;
      // Retry once in case of transient errors
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          return; // Success
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          // If this is a stale state error, re-acquire handle and retry
          if (attempt === 0 && err instanceof DOMException && err.name === 'InvalidStateError') {
            // Get a fresh handle for the retry
            const freshHandle = await directory.getFileHandle(fileName, { create: true });
            try {
              const writable = await freshHandle.createWritable();
              await writable.write(blob);
              await writable.close();
              return; // Success on retry with fresh handle
            } catch (retryErr) {
              lastError = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
            }
          }
        }
      }

      throw lastError || new Error('Failed to save image data');
    },
    []
  );

  return {
    isSupported,
    isScanning,
    selectDirectory,
    selectOutputDirectory,
    loadImageData,
    saveImageData,
    saveImageToDirectory,
    saveImageToDirectorySafe,
  };
}
