import { describe, expect, it } from 'vitest';
import { buildAfterImage } from './before-after-image';
import type { HotPixelMap } from '../../types';

// Build a small synthetic 3x3 RGBA image where the center pixel is "hot"
// (255,255,255) and the surrounding neighbours are mid-grey (128,128,128).
// After repairing the center pixel, it should equal the average of its
// 8 neighbours, i.e. (128,128,128).
function makeSyntheticFrame(): ImageData {
  const width = 3;
  const height = 3;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    // center pixel index = 4 (x=1,y=1)
    if (i === 4) {
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    } else {
      data[idx] = 128;
      data[idx + 1] = 128;
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
}

function makeHotPixelMap(indices: number[], width: number, height: number): HotPixelMap {
  return {
    pixels: new Set(indices),
    details: indices.map((index) => ({
      index,
      x: index % width,
      y: Math.floor(index / width),
      avgBrightness: 255,
      consistency: 1,
    })),
    threshold: 250,
    minConsistency: 0.5,
    width,
    height,
    framesAnalyzed: 1,
  };
}

describe('buildAfterImage', () => {
  it('returns null when sample frame is missing', () => {
    expect(buildAfterImage(null, makeHotPixelMap([], 1, 1))).toBeNull();
  });

  it('returns null when hot pixel map is missing', () => {
    const frame = makeSyntheticFrame();
    expect(buildAfterImage(frame, null)).toBeNull();
  });

  it('does not mutate the original frame', () => {
    const frame = makeSyntheticFrame();
    const hotPixels = makeHotPixelMap([4], 3, 3);

    const before = Array.from(frame.data);
    const after = buildAfterImage(frame, hotPixels);

    // Original data unchanged
    expect(Array.from(frame.data)).toEqual(before);
    // Returned image is a distinct buffer
    expect(after).not.toBeNull();
    expect(after!.data).not.toBe(frame.data);
  });

  it('repairs the hot pixel by averaging its 3x3 neighbours', () => {
    const frame = makeSyntheticFrame();
    const hotPixels = makeHotPixelMap([4], 3, 3);

    const after = buildAfterImage(frame, hotPixels);
    expect(after).not.toBeNull();

    const idx = 4 * 4;
    expect(after!.data[idx]).toBe(128);
    expect(after!.data[idx + 1]).toBe(128);
    expect(after!.data[idx + 2]).toBe(128);
    // Alpha is preserved by the repair algorithm
    expect(after!.data[idx + 3]).toBe(255);
  });

  it('returns a frame identical to the input when no hot pixels are provided', () => {
    const frame = makeSyntheticFrame();
    const hotPixels = makeHotPixelMap([], 3, 3);

    const after = buildAfterImage(frame, hotPixels);
    expect(after).not.toBeNull();
    expect(Array.from(after!.data)).toEqual(Array.from(frame.data));
  });

  it('preserves image dimensions', () => {
    const frame = makeSyntheticFrame();
    const hotPixels = makeHotPixelMap([4], 3, 3);
    const after = buildAfterImage(frame, hotPixels);
    expect(after!.width).toBe(frame.width);
    expect(after!.height).toBe(frame.height);
  });
});
