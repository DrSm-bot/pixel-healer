import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './app-store';
import type { HotPixelMap } from '@/types';

function freshMap(): HotPixelMap {
  return {
    pixels: new Set<number>([11, 22]),
    details: [
      { x: 1, y: 1, index: 11, avgBrightness: 240, consistency: 0.95 },
      { x: 2, y: 2, index: 22, avgBrightness: 230, consistency: 0.92 },
    ],
    threshold: 240,
    minConsistency: 0.9,
    width: 10,
    height: 10,
    framesAnalyzed: 5,
  };
}

describe('app-store manual editing actions', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it('starts with no manual edits', () => {
    expect(useAppStore.getState().manualEditState.history).toEqual([]);
  });

  it('adds a manual hot pixel and tracks the edit', () => {
    useAppStore.getState().setHotPixelMap(freshMap());
    const changed = useAppStore.getState().addManualHotPixel(5, 5);
    expect(changed).toBe(true);
    const { hotPixelMap, manualEditState } = useAppStore.getState();
    expect(hotPixelMap!.pixels.has(5 * 10 + 5)).toBe(true);
    expect(manualEditState.history).toHaveLength(1);
    expect(manualEditState.history[0]!.kind).toBe('add');
  });

  it('toggle returns the action kind', () => {
    useAppStore.getState().setHotPixelMap(freshMap());
    const first = useAppStore.getState().toggleManualHotPixel(5, 5);
    expect(first).toBe('add');
    const second = useAppStore.getState().toggleManualHotPixel(5, 5);
    expect(second).toBe('remove');
    const oob = useAppStore.getState().toggleManualHotPixel(999, 999);
    expect(oob).toBe(null);
  });

  it('undoes the most recent edit', () => {
    useAppStore.getState().setHotPixelMap(freshMap());
    useAppStore.getState().addManualHotPixel(5, 5);
    useAppStore.getState().addManualHotPixel(6, 6);
    expect(useAppStore.getState().hotPixelMap!.pixels.size).toBe(4);
    const undone = useAppStore.getState().undoManualEdit();
    expect(undone).toBe(true);
    const map = useAppStore.getState().hotPixelMap!;
    expect(map.pixels.size).toBe(3);
    expect(map.pixels.has(6 * 10 + 6)).toBe(false);
  });

  it('undoing a remove restores the original detected detail', () => {
    useAppStore.getState().setHotPixelMap(freshMap());
    useAppStore.getState().removeManualHotPixel(1, 1);
    expect(useAppStore.getState().hotPixelMap!.pixels.has(11)).toBe(false);
    useAppStore.getState().undoManualEdit();
    const map = useAppStore.getState().hotPixelMap!;
    expect(map.pixels.has(11)).toBe(true);
    const detail = map.details.find((p) => p.index === 11);
    expect(detail?.consistency).toBeCloseTo(0.95);
  });

  it('returns false / null when there is no hot pixel map', () => {
    expect(useAppStore.getState().addManualHotPixel(1, 1)).toBe(false);
    expect(useAppStore.getState().removeManualHotPixel(1, 1)).toBe(false);
    expect(useAppStore.getState().toggleManualHotPixel(1, 1)).toBe(null);
    expect(useAppStore.getState().undoManualEdit()).toBe(false);
  });

  it('setHotPixelMap clears the manual edit history', () => {
    useAppStore.getState().setHotPixelMap(freshMap());
    useAppStore.getState().addManualHotPixel(5, 5);
    expect(useAppStore.getState().manualEditState.history.length).toBe(1);
    useAppStore.getState().setHotPixelMap(freshMap());
    expect(useAppStore.getState().manualEditState.history).toEqual([]);
  });

  it('resetManualEdits clears the history without touching the map', () => {
    useAppStore.getState().setHotPixelMap(freshMap());
    useAppStore.getState().addManualHotPixel(5, 5);
    const sizeBefore = useAppStore.getState().hotPixelMap!.pixels.size;
    useAppStore.getState().resetManualEdits();
    expect(useAppStore.getState().manualEditState.history).toEqual([]);
    expect(useAppStore.getState().hotPixelMap!.pixels.size).toBe(sizeBefore);
  });
});
