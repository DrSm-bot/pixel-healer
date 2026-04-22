import { describe, expect, it } from 'vitest';
import { analyzeFrame, detectHotPixels } from './detection';

describe('analyzeFrame adaptive thresholding', () => {
  function makeFrame(values: number[]): ImageData {
    const data = new Uint8ClampedArray(values.length * 4);
    values.forEach((value, index) => {
      const offset = index * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    });
    return new ImageData(data, values.length, 1);
  }

  it('uses static threshold when adaptive mode is disabled', () => {
    const frame = makeFrame([100, 200, 240, 250]);
    const result = analyzeFrame(frame, { threshold: 240, adaptiveThreshold: false });

    expect(Array.from(result)).toEqual([0, 0, 1, 1]);
  });

  it('uses percentile threshold when adaptive mode is enabled', () => {
    const frame = makeFrame([10, 20, 200, 250]);
    const result = analyzeFrame(frame, {
      threshold: 240,
      adaptiveThreshold: true,
      adaptivePercentile: 0.75,
      adaptiveMinThreshold: 0,
    });

    expect(Array.from(result)).toEqual([0, 0, 1, 1]);
  });

  it('respects adaptive minimum threshold clamp', () => {
    const frame = makeFrame([10, 20, 40, 60]);
    const result = analyzeFrame(frame, {
      adaptiveThreshold: true,
      adaptivePercentile: 0.25,
      adaptiveMinThreshold: 50,
    });

    expect(Array.from(result)).toEqual([0, 0, 0, 1]);
  });
});

describe('analyzeFrame contrast detection', () => {
  function makeGridFrame(width: number, height: number, values: number[]): ImageData {
    const data = new Uint8ClampedArray(values.length * 4);
    values.forEach((value, index) => {
      const offset = index * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    });
    return new ImageData(data, width, height);
  }

  it('detects a hot pixel via contrast when below the absolute threshold', () => {
    const frame = makeGridFrame(3, 3, [
      40, 40, 40,
      40, 80, 40,
      40, 40, 40,
    ]);

    const result = analyzeFrame(frame, {
      threshold: 240,
      contrastEnabled: true,
      contrastMinRatio: 1.5,
    });

    expect(Array.from(result)).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
  });

  it('detects hot pixels in fully dark neighborhoods using the min-average clamp', () => {
    const frame = makeGridFrame(3, 3, [
      0, 0, 0,
      0, 20, 0,
      0, 0, 0,
    ]);

    const result = analyzeFrame(frame, {
      threshold: 240,
      contrastEnabled: true,
      contrastMinRatio: 1.5,
    });

    expect(Array.from(result)).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
  });

  it('keeps contrast detection disabled when requested', () => {
    const frame = makeGridFrame(3, 3, [
      40, 40, 40,
      40, 80, 40,
      40, 40, 40,
    ]);

    const result = analyzeFrame(frame, {
      threshold: 240,
      contrastEnabled: false,
      contrastMinRatio: 1.5,
    });

    expect(Array.from(result)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('enables contrast detection by default', () => {
    const frame = makeGridFrame(3, 3, [
      40, 40, 40,
      40, 80, 40,
      40, 40, 40,
    ]);

    const result = analyzeFrame(frame, { threshold: 240 });

    expect(Array.from(result)).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
  });

  it('guards against near-zero neighbor averages causing false positives', () => {
    const frame = makeGridFrame(3, 3, [
      0, 0, 0,
      0, 2, 0,
      0, 0, 0,
    ]);

    const result = analyzeFrame(frame, {
      threshold: 240,
      contrastEnabled: true,
      contrastMinRatio: 1.5,
    });

    expect(Array.from(result)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('detectHotPixels temporal run filter', () => {
  it('rejects sparse temporal hits when min run ratio is enabled', () => {
    // One pixel hot on alternating frames: count is high, run length is short.
    const frameResults = [
      new Uint8Array([1]),
      new Uint8Array([0]),
      new Uint8Array([1]),
      new Uint8Array([0]),
      new Uint8Array([1]),
      new Uint8Array([0]),
    ];

    const withoutRunFilter = detectHotPixels(frameResults, 1, 1, {
      minConsistency: 0.5,
      temporalMinRunRatio: 0,
    });
    const withRunFilter = detectHotPixels(frameResults, 1, 1, {
      minConsistency: 0.5,
      temporalMinRunRatio: 0.5,
    });

    expect(withoutRunFilter.pixels.size).toBe(1);
    expect(withRunFilter.pixels.size).toBe(0);
  });

  it('keeps persistent temporal hits when run ratio is enabled', () => {
    const frameResults = [
      new Uint8Array([1]),
      new Uint8Array([1]),
      new Uint8Array([1]),
      new Uint8Array([1]),
      new Uint8Array([0]),
      new Uint8Array([0]),
    ];

    const result = detectHotPixels(frameResults, 1, 1, {
      minConsistency: 0.5,
      temporalMinRunRatio: 0.5,
    });

    expect(result.pixels.size).toBe(1);
  });
});

describe('detectHotPixels spatial isolation filter', () => {
  it('removes clustered detections when spatial isolation is enabled', () => {
    // 2x2 cluster in a 3x3 frame, all hot in all frames.
    const frame = new Uint8Array([
      1, 1, 0,
      1, 1, 0,
      0, 0, 0,
    ]);
    const frameResults = [frame, frame, frame, frame];

    const withoutSpatialFilter = detectHotPixels(frameResults, 3, 3, {
      minConsistency: 0.5,
      spatialIsolationEnabled: false,
    });

    const withSpatialFilter = detectHotPixels(frameResults, 3, 3, {
      minConsistency: 0.5,
      spatialIsolationEnabled: true,
      spatialMaxHotNeighbors: 0,
    });

    expect(withoutSpatialFilter.pixels.size).toBe(4);
    expect(withSpatialFilter.pixels.size).toBe(0);
  });

  it('keeps isolated detections when spatial isolation is enabled', () => {
    const frame = new Uint8Array([
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ]);
    const frameResults = [frame, frame, frame, frame];

    const result = detectHotPixels(frameResults, 3, 3, {
      minConsistency: 0.5,
      spatialIsolationEnabled: true,
      spatialMaxHotNeighbors: 0,
    });

    expect(result.pixels.size).toBe(1);
  });
});
