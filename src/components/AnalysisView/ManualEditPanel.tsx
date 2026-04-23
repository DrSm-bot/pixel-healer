import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useAppStore } from '@/store/app-store';
import { createHotPixelOverlay, imageDataToDataUrl, revokeDataUrl } from '@/core/image-utils';
import { countManualEdits } from '@/core/manual-edit';
import { clientToImagePixel } from './manual-edit-geometry';

/**
 * Review-step UI that lets users add or remove hot pixels by clicking on the
 * analysis preview. The panel owns its own preview <img> so click coordinates
 * always map to the current hot-pixel overlay, and it regenerates that overlay
 * whenever the user's edits change the map.
 */
export function ManualEditPanel() {
  const hotPixelMap = useAppStore((s) => s.hotPixelMap);
  const sampleFrameData = useAppStore((s) => s.sampleFrameData);
  const manualEditState = useAppStore((s) => s.manualEditState);
  const toggleManual = useAppStore((s) => s.toggleManualHotPixel);
  const undoManual = useAppStore((s) => s.undoManualEdit);
  const resetManual = useAppStore((s) => s.resetManualEdits);
  const [editMode, setEditMode] = useState(false);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const counts = useMemo(() => countManualEdits(manualEditState), [manualEditState]);

  // Rebuild the overlay whenever the pixel set or source frame changes. The
  // URL is a blob object so we always revoke the previous value before
  // creating a new one to avoid leaks.
  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    if (!sampleFrameData || !hotPixelMap) {
      setOverlayUrl(null);
      return () => {};
    }

    const overlay = createHotPixelOverlay(sampleFrameData, hotPixelMap.pixels);
    imageDataToDataUrl(overlay)
      .then((url) => {
        if (cancelled) {
          revokeDataUrl(url);
          return;
        }
        createdUrl = url;
        setOverlayUrl((prev) => {
          if (prev) revokeDataUrl(prev);
          return url;
        });
      })
      .catch(() => {
        if (!cancelled) setOverlayUrl(null);
      });

    return () => {
      cancelled = true;
      if (createdUrl) revokeDataUrl(createdUrl);
    };
  }, [sampleFrameData, hotPixelMap]);

  // Release the last overlay URL on unmount.
  useEffect(() => {
    return () => {
      if (overlayUrl) revokeDataUrl(overlayUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePreviewClick = useCallback(
    (event: MouseEvent<HTMLImageElement>) => {
      if (!editMode || !hotPixelMap) return;
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      const pixel = clientToImagePixel(
        {
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
          displayWidth: rect.width,
          displayHeight: rect.height,
        },
        { width: hotPixelMap.width, height: hotPixelMap.height }
      );
      if (!pixel) return;
      const kind = toggleManual(pixel.x, pixel.y);
      if (kind === 'add') setLastAction(`Added hot pixel at (${pixel.x}, ${pixel.y})`);
      else if (kind === 'remove') setLastAction(`Removed hot pixel at (${pixel.x}, ${pixel.y})`);
    },
    [editMode, hotPixelMap, toggleManual]
  );

  const handleUndo = useCallback(() => {
    const changed = undoManual();
    if (changed) setLastAction('Undid last edit');
  }, [undoManual]);

  const handleReset = useCallback(() => {
    if (!hotPixelMap || counts.added + counts.removed === 0) return;
    // Clearing edit history disables undo but leaves the current map alone,
    // so the user can continue editing or go back to analyze to restart.
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            'Clear manual edit history? The current hot-pixel map stays, but you will not be able to undo earlier edits.'
          );
    if (!confirmed) return;
    resetManual();
    setLastAction('Cleared manual-edit history');
  }, [hotPixelMap, counts, resetManual]);

  if (!hotPixelMap) return null;

  const totalManual = counts.added + counts.removed;

  return (
    <div
      className="bg-cosmos-900/50 rounded-lg p-6 mb-6"
      data-testid="manual-edit-panel"
    >
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h3 className="font-semibold">Manual Pixel Editing</h3>
          <p className="text-sm text-gray-400 mt-1">
            {editMode
              ? 'Click a pixel on the preview to toggle it. Click a red marker again to remove it.'
              : 'Enable edit mode to add missed hot pixels or remove false positives.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          aria-pressed={editMode}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            editMode
              ? 'bg-cosmos-500 hover:bg-cosmos-400 text-white'
              : 'bg-cosmos-700 hover:bg-cosmos-600 text-cosmos-100'
          }`}
        >
          {editMode ? '✓ Edit mode on' : '✎ Enable edit mode'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm mb-4">
        <div>
          <p className="text-gray-400">Added manually</p>
          <p className="text-2xl font-semibold text-green-400">{counts.added}</p>
        </div>
        <div>
          <p className="text-gray-400">Removed manually</p>
          <p className="text-2xl font-semibold text-amber-400">{counts.removed}</p>
        </div>
        <div>
          <p className="text-gray-400">Current total</p>
          <p className="text-2xl font-semibold text-cosmos-300">{hotPixelMap.pixels.size}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleUndo}
          disabled={totalManual === 0}
          className="px-3 py-2 rounded-lg text-sm bg-cosmos-700 hover:bg-cosmos-600
                     disabled:bg-cosmos-900 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          ↶ Undo last edit
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={totalManual === 0}
          className="px-3 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600
                     disabled:bg-gray-900 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          Clear edit history
        </button>
        {lastAction && (
          <span role="status" aria-live="polite" className="text-xs text-gray-400 ml-auto">
            {lastAction}
          </span>
        )}
      </div>

      {overlayUrl && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Preview</h4>
            <span className="text-xs text-gray-500">
              {hotPixelMap.width}×{hotPixelMap.height}
            </span>
          </div>
          <img
            src={overlayUrl}
            alt="Hot pixel preview"
            onClick={handlePreviewClick}
            data-testid="manual-edit-preview"
            className={`max-w-full rounded-lg border border-cosmos-700 select-none ${
              editMode ? 'cursor-crosshair ring-2 ring-cosmos-500' : 'cursor-default'
            }`}
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
