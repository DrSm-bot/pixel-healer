/**
 * Manual hot pixel editing utilities.
 *
 * The detection pipeline produces a `HotPixelMap` automatically. The review
 * step lets users refine that map by adding pixels that detection missed and
 * removing false positives. This module keeps that behaviour as a set of pure
 * helpers so the store can stay thin and the logic is easy to test.
 *
 * Edits are tracked in a small history stack so the UI can offer a single-step
 * undo and reset path without having to re-run analysis.
 */

import type { HotPixel, HotPixelMap } from '@/types';

export type ManualEditKind = 'add' | 'remove';

export interface ManualEdit {
  kind: ManualEditKind;
  x: number;
  y: number;
  index: number;
  /** Snapshot of the removed pixel's details (used to restore on undo). */
  removedDetail?: HotPixel;
}

export interface ManualEditState {
  history: ManualEdit[];
}

export const INITIAL_MANUAL_EDIT_STATE: ManualEditState = {
  history: [],
};

/**
 * Confidence value used for manually-added pixels. 1.0 expresses "user is
 * certain" and keeps the value outside the normal detection consistency range
 * so downstream code can distinguish manual additions if needed.
 */
export const MANUAL_PIXEL_CONSISTENCY = 1;

/**
 * Default brightness for manually-added pixels. We don't measure brightness
 * at add-time because we'd need the full sample frame, and for the repair
 * step only the coordinates matter.
 */
export const MANUAL_PIXEL_BRIGHTNESS = 255;

export function coordsInBounds(x: number, y: number, width: number, height: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height;
}

export function pixelIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

/**
 * Apply a user-initiated add at the given coordinates. If the pixel is already
 * in the map this is a no-op (returns the same map/state references) so the
 * UI can safely emit duplicate click events without corrupting state.
 */
export function addHotPixel(
  map: HotPixelMap,
  state: ManualEditState,
  x: number,
  y: number
): { map: HotPixelMap; state: ManualEditState; changed: boolean } {
  if (!coordsInBounds(x, y, map.width, map.height)) {
    return { map, state, changed: false };
  }

  const index = pixelIndex(x, y, map.width);
  if (map.pixels.has(index)) {
    return { map, state, changed: false };
  }

  const newPixels = new Set(map.pixels);
  newPixels.add(index);

  const newDetails: HotPixel[] = [
    ...map.details,
    {
      x,
      y,
      index,
      avgBrightness: MANUAL_PIXEL_BRIGHTNESS,
      consistency: MANUAL_PIXEL_CONSISTENCY,
    },
  ];

  const newMap: HotPixelMap = { ...map, pixels: newPixels, details: newDetails };
  const newState: ManualEditState = {
    history: [...state.history, { kind: 'add', x, y, index }],
  };

  return { map: newMap, state: newState, changed: true };
}

/**
 * Remove a pixel from the map. The previous detail entry (if any) is stashed
 * in the edit history so undo can restore it exactly, including auto-detection
 * metadata like consistency and avgBrightness.
 */
export function removeHotPixel(
  map: HotPixelMap,
  state: ManualEditState,
  x: number,
  y: number
): { map: HotPixelMap; state: ManualEditState; changed: boolean } {
  if (!coordsInBounds(x, y, map.width, map.height)) {
    return { map, state, changed: false };
  }

  const index = pixelIndex(x, y, map.width);
  if (!map.pixels.has(index)) {
    return { map, state, changed: false };
  }

  const newPixels = new Set(map.pixels);
  newPixels.delete(index);

  const removedDetail = map.details.find((p) => p.index === index);
  const newDetails = map.details.filter((p) => p.index !== index);

  const newMap: HotPixelMap = { ...map, pixels: newPixels, details: newDetails };
  const edit: ManualEdit = removedDetail
    ? { kind: 'remove', x, y, index, removedDetail }
    : { kind: 'remove', x, y, index };
  const newState: ManualEditState = {
    history: [...state.history, edit],
  };

  return { map: newMap, state: newState, changed: true };
}

/**
 * Convenience helper that adds or removes a pixel based on current state.
 * Most UI surfaces only need one entry point, so this keeps them simple.
 */
export function toggleManualHotPixel(
  map: HotPixelMap,
  state: ManualEditState,
  x: number,
  y: number
): { map: HotPixelMap; state: ManualEditState; changed: boolean; kind: ManualEditKind | null } {
  if (!coordsInBounds(x, y, map.width, map.height)) {
    return { map, state, changed: false, kind: null };
  }

  const index = pixelIndex(x, y, map.width);
  if (map.pixels.has(index)) {
    const result = removeHotPixel(map, state, x, y);
    return { ...result, kind: 'remove' };
  }
  const result = addHotPixel(map, state, x, y);
  return { ...result, kind: 'add' };
}

/**
 * Reverse the last edit. Adds the removed detail back verbatim (when we have
 * it) and removes freshly-added pixels. Returns the map/state unchanged if
 * there is nothing to undo.
 */
export function undoLastManualEdit(
  map: HotPixelMap,
  state: ManualEditState
): { map: HotPixelMap; state: ManualEditState; changed: boolean } {
  if (state.history.length === 0) {
    return { map, state, changed: false };
  }

  const last = state.history[state.history.length - 1]!;
  const newHistory = state.history.slice(0, -1);
  const newPixels = new Set(map.pixels);
  let newDetails = map.details;

  if (last.kind === 'add') {
    // Undo an add == remove the pixel.
    newPixels.delete(last.index);
    newDetails = map.details.filter((p) => p.index !== last.index);
  } else {
    // Undo a remove == put the pixel back with its previous details if we
    // captured them, otherwise synthesize a manual-style entry.
    newPixels.add(last.index);
    const restored: HotPixel = last.removedDetail ?? {
      x: last.x,
      y: last.y,
      index: last.index,
      avgBrightness: MANUAL_PIXEL_BRIGHTNESS,
      consistency: MANUAL_PIXEL_CONSISTENCY,
    };
    newDetails = [...map.details, restored];
  }

  return {
    map: { ...map, pixels: newPixels, details: newDetails },
    state: { history: newHistory },
    changed: true,
  };
}

/**
 * Count how many adds / removes are currently in the edit history. Handy for
 * surfacing a "3 added, 1 removed" summary in the UI.
 */
export function countManualEdits(state: ManualEditState): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const edit of state.history) {
    if (edit.kind === 'add') added++;
    else removed++;
  }
  return { added, removed };
}

export function hasManualEdits(state: ManualEditState): boolean {
  return state.history.length > 0;
}
