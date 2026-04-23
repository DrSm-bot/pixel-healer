import { describe, expect, it } from 'vitest';
import type { HotPixelMap } from '@/types';
import {
  INITIAL_MANUAL_EDIT_STATE,
  addHotPixel,
  countManualEdits,
  hasManualEdits,
  removeHotPixel,
  toggleManualHotPixel,
  undoLastManualEdit,
} from './manual-edit';

function makeMap(width = 10, height = 10, detectedPixels: Array<[number, number]> = []): HotPixelMap {
  const pixels = new Set<number>();
  const details = detectedPixels.map(([x, y]) => {
    const index = y * width + x;
    pixels.add(index);
    return {
      x,
      y,
      index,
      avgBrightness: 200,
      consistency: 0.95,
    };
  });
  return {
    pixels,
    details,
    threshold: 240,
    minConsistency: 0.9,
    width,
    height,
    framesAnalyzed: 5,
  };
}

describe('manual-edit', () => {
  describe('addHotPixel', () => {
    it('adds a new pixel to both the set and details', () => {
      const map = makeMap();
      const result = addHotPixel(map, INITIAL_MANUAL_EDIT_STATE, 3, 4);
      expect(result.changed).toBe(true);
      expect(result.map.pixels.size).toBe(1);
      expect(result.map.pixels.has(4 * 10 + 3)).toBe(true);
      expect(result.map.details).toHaveLength(1);
      expect(result.map.details[0]!.x).toBe(3);
      expect(result.map.details[0]!.y).toBe(4);
      expect(result.state.history).toHaveLength(1);
      expect(result.state.history[0]!.kind).toBe('add');
    });

    it('is a no-op when the pixel is already hot', () => {
      const map = makeMap(10, 10, [[3, 4]]);
      const result = addHotPixel(map, INITIAL_MANUAL_EDIT_STATE, 3, 4);
      expect(result.changed).toBe(false);
      expect(result.map).toBe(map);
      expect(result.state).toBe(INITIAL_MANUAL_EDIT_STATE);
    });

    it('rejects coordinates outside the image bounds', () => {
      const map = makeMap(10, 10);
      const result = addHotPixel(map, INITIAL_MANUAL_EDIT_STATE, -1, 0);
      expect(result.changed).toBe(false);
      const result2 = addHotPixel(map, INITIAL_MANUAL_EDIT_STATE, 0, 10);
      expect(result2.changed).toBe(false);
    });

    it('rejects non-integer coordinates', () => {
      const map = makeMap();
      const result = addHotPixel(map, INITIAL_MANUAL_EDIT_STATE, 3.5, 4);
      expect(result.changed).toBe(false);
    });

    it('does not mutate the input map', () => {
      const map = makeMap();
      addHotPixel(map, INITIAL_MANUAL_EDIT_STATE, 3, 4);
      expect(map.pixels.size).toBe(0);
      expect(map.details).toHaveLength(0);
    });
  });

  describe('removeHotPixel', () => {
    it('removes an existing pixel and captures its detail for undo', () => {
      const map = makeMap(10, 10, [[2, 2]]);
      const result = removeHotPixel(map, INITIAL_MANUAL_EDIT_STATE, 2, 2);
      expect(result.changed).toBe(true);
      expect(result.map.pixels.size).toBe(0);
      expect(result.map.details).toHaveLength(0);
      expect(result.state.history).toHaveLength(1);
      expect(result.state.history[0]!.kind).toBe('remove');
      expect(result.state.history[0]!.removedDetail?.consistency).toBeCloseTo(0.95);
    });

    it('is a no-op when the pixel is not hot', () => {
      const map = makeMap();
      const result = removeHotPixel(map, INITIAL_MANUAL_EDIT_STATE, 1, 1);
      expect(result.changed).toBe(false);
    });
  });

  describe('toggleManualHotPixel', () => {
    it('adds when pixel is not hot and removes when it already is', () => {
      let map = makeMap();
      let state = INITIAL_MANUAL_EDIT_STATE;

      let result = toggleManualHotPixel(map, state, 5, 5);
      expect(result.changed).toBe(true);
      expect(result.kind).toBe('add');
      map = result.map;
      state = result.state;
      expect(map.pixels.has(55)).toBe(true);

      result = toggleManualHotPixel(map, state, 5, 5);
      expect(result.changed).toBe(true);
      expect(result.kind).toBe('remove');
      expect(result.map.pixels.has(55)).toBe(false);
    });

    it('returns null kind on out-of-bounds clicks', () => {
      const map = makeMap(10, 10);
      const result = toggleManualHotPixel(map, INITIAL_MANUAL_EDIT_STATE, 50, 50);
      expect(result.changed).toBe(false);
      expect(result.kind).toBe(null);
    });
  });

  describe('undoLastManualEdit', () => {
    it('reverses an add', () => {
      const map = makeMap();
      const { map: m1, state: s1 } = addHotPixel(map, INITIAL_MANUAL_EDIT_STATE, 1, 1);
      const undone = undoLastManualEdit(m1, s1);
      expect(undone.changed).toBe(true);
      expect(undone.map.pixels.size).toBe(0);
      expect(undone.map.details).toHaveLength(0);
      expect(undone.state.history).toHaveLength(0);
    });

    it('reverses a remove and restores the detail', () => {
      const map = makeMap(10, 10, [[2, 2]]);
      const { map: m1, state: s1 } = removeHotPixel(map, INITIAL_MANUAL_EDIT_STATE, 2, 2);
      const undone = undoLastManualEdit(m1, s1);
      expect(undone.changed).toBe(true);
      expect(undone.map.pixels.has(2 * 10 + 2)).toBe(true);
      expect(undone.map.details).toHaveLength(1);
      expect(undone.map.details[0]!.consistency).toBeCloseTo(0.95);
      expect(undone.state.history).toHaveLength(0);
    });

    it('is a no-op when history is empty', () => {
      const map = makeMap();
      const result = undoLastManualEdit(map, INITIAL_MANUAL_EDIT_STATE);
      expect(result.changed).toBe(false);
    });

    it('undoes only the most recent edit in a sequence', () => {
      let map = makeMap();
      let state = INITIAL_MANUAL_EDIT_STATE;
      ({ map, state } = addHotPixel(map, state, 1, 1));
      ({ map, state } = addHotPixel(map, state, 2, 2));
      ({ map, state } = addHotPixel(map, state, 3, 3));
      expect(map.pixels.size).toBe(3);

      const undone = undoLastManualEdit(map, state);
      expect(undone.map.pixels.size).toBe(2);
      expect(undone.map.pixels.has(3 * 10 + 3)).toBe(false);
      expect(undone.state.history).toHaveLength(2);
    });
  });

  describe('counts', () => {
    it('counts adds and removes separately', () => {
      let map = makeMap(10, 10, [[4, 4]]);
      let state = INITIAL_MANUAL_EDIT_STATE;
      ({ map, state } = addHotPixel(map, state, 1, 1));
      ({ map, state } = addHotPixel(map, state, 2, 2));
      ({ map, state } = removeHotPixel(map, state, 4, 4));

      expect(countManualEdits(state)).toEqual({ added: 2, removed: 1 });
      expect(hasManualEdits(state)).toBe(true);
    });

    it('reports no edits on a fresh state', () => {
      expect(countManualEdits(INITIAL_MANUAL_EDIT_STATE)).toEqual({ added: 0, removed: 0 });
      expect(hasManualEdits(INITIAL_MANUAL_EDIT_STATE)).toBe(false);
    });
  });
});
