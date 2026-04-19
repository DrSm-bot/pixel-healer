import { useCallback, useState } from 'react';
import type { ImageFile, SupportedExtension } from '@/types';

const SUPPORTED_EXTENSIONS: SupportedExtension[] = ['.jpg', '.jpeg', '.png', '.webp'];

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
  /** Load an image file as ImageData */
  loadImageData: (file: ImageFile) => Promise<ImageData>;
  /** Save ImageData back to a file */
  saveImageData: (
    imageData: ImageData,
    handle: FileSystemFileHandle,
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

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    },
    []
  );

  return {
    isSupported,
    isScanning,
    selectDirectory,
    loadImageData,
    saveImageData,
  };
}
