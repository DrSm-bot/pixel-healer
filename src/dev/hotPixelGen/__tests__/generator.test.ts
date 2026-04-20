/**
 * Unit tests for synthetic hot pixel generator
 */

import { describe, it, expect } from 'vitest';
import {
  generateMask,
  applyMask,
  corruptSequence,
  serializeMask,
  deserializeMask,
  SeededRNG,
} from '../index';
import type { GeneratorConfig } from '../../../types';

describe('SeededRNG', () => {
  it('produces deterministic values for same seed', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);

    const values1 = Array.from({ length: 10 }, () => rng1.next());
    const values2 = Array.from({ length: 10 }, () => rng2.next());

    expect(values1).toEqual(values2);
  });

  it('produces different values for different seeds', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(54321);

    const values1 = Array.from({ length: 10 }, () => rng1.next());
    const values2 = Array.from({ length: 10 }, () => rng2.next());

    expect(values1).not.toEqual(values2);
  });

  it('hash function is deterministic', () => {
    const hash1 = SeededRNG.hash(100, 50, 10);
    const hash2 = SeededRNG.hash(100, 50, 10);
    expect(hash1).toBe(hash2);
  });

  it('hash produces different values for different inputs', () => {
    const hash1 = SeededRNG.hash(100, 50, 10);
    const hash2 = SeededRNG.hash(100, 50, 11);
    const hash3 = SeededRNG.hash(100, 51, 10);
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });
});

describe('generateMask', () => {
  const baseConfig: GeneratorConfig = {
    width: 1920,
    height: 1080,
    seed: 1337,
    density: 150,
  };

  it('generates deterministic masks for same config', () => {
    const mask1 = generateMask(baseConfig);
    const mask2 = generateMask(baseConfig);

    expect(mask1.pixels).toEqual(mask2.pixels);
    expect(mask1.seed).toBe(mask2.seed);
    expect(mask1.generatedAt).toBe(mask2.generatedAt);
  });

  it('generates different masks for different seeds', () => {
    const mask1 = generateMask({ ...baseConfig, seed: 1337 });
    const mask2 = generateMask({ ...baseConfig, seed: 9001 });

    expect(mask1.pixels).not.toEqual(mask2.pixels);
  });

  it('respects density parameter', () => {
    const lowDensity = generateMask({ ...baseConfig, density: 50 });
    const highDensity = generateMask({ ...baseConfig, density: 300 });

    const megapixels = (baseConfig.width * baseConfig.height) / 1_000_000;
    expect(lowDensity.pixels.length).toBeCloseTo(50 * megapixels, 0);
    expect(highDensity.pixels.length).toBeCloseTo(300 * megapixels, 0);
  });

  it('includes schemaVersion 1', () => {
    const mask = generateMask(baseConfig);
    expect(mask.schemaVersion).toBe(1);
  });

  it('respects image dimensions', () => {
    const mask = generateMask(baseConfig);
    expect(mask.width).toBe(baseConfig.width);
    expect(mask.height).toBe(baseConfig.height);
  });

  it('generates valid pixel coordinates within bounds', () => {
    const mask = generateMask(baseConfig);
    for (const pixel of mask.pixels) {
      expect(pixel.x).toBeGreaterThanOrEqual(1);
      expect(pixel.x).toBeLessThan(baseConfig.width - 1);
      expect(pixel.y).toBeGreaterThanOrEqual(1);
      expect(pixel.y).toBeLessThan(baseConfig.height - 1);
    }
  });

  it('handles very small frame sizes without out-of-bounds coordinates', () => {
    const tinyMask = generateMask({
      width: 3,
      height: 3,
      seed: 123,
      density: 1000,
    });

    for (const pixel of tinyMask.pixels) {
      expect(pixel.x).toBeGreaterThanOrEqual(0);
      expect(pixel.x).toBeLessThan(3);
      expect(pixel.y).toBeGreaterThanOrEqual(0);
      expect(pixel.y).toBeLessThan(3);
    }

    // Cannot exceed unique available coordinates
    expect(tinyMask.pixels.length).toBeLessThanOrEqual(9);
  });

  it('generates valid pixel types', () => {
    const mask = generateMask(baseConfig);
    const validTypes = new Set(['stuck', 'warm', 'flicker']);
    for (const pixel of mask.pixels) {
      expect(validTypes.has(pixel.type)).toBe(true);
    }
  });

  it('generates valid channels', () => {
    const mask = generateMask(baseConfig);
    const validChannels = new Set(['r', 'g', 'b', 'rgb']);
    for (const pixel of mask.pixels) {
      expect(validChannels.has(pixel.channel)).toBe(true);
    }
  });

  it('generates valid intensity values', () => {
    const mask = generateMask(baseConfig);
    for (const pixel of mask.pixels) {
      expect(pixel.intensity).toBeGreaterThanOrEqual(0);
      expect(pixel.intensity).toBeLessThanOrEqual(255);
    }
  });
});

describe('applyMask', () => {
  const config: GeneratorConfig = {
    width: 100,
    height: 100,
    seed: 42,
    density: 50,
  };

  function createTestFrame(width: number, height: number, fillValue = 50): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fillValue; // R
      data[i + 1] = fillValue; // G
      data[i + 2] = fillValue; // B
      data[i + 3] = 255; // A
    }
    return new ImageData(data, width, height);
  }

  it('is deterministic for same mask and frame index', () => {
    const mask = generateMask(config);
    const frame = createTestFrame(100, 100);

    const result1 = applyMask(frame, mask, 0);
    const result2 = applyMask(frame, mask, 0);

    expect(result1.data).toEqual(result2.data);
  });

  it('does not mutate original frame', () => {
    const mask = generateMask(config);
    const frame = createTestFrame(100, 100);
    const originalData = new Uint8ClampedArray(frame.data);

    applyMask(frame, mask, 0);

    expect(frame.data).toEqual(originalData);
  });

  it('only corrupts pixels in the mask', () => {
    const mask = generateMask(config);
    const frame = createTestFrame(100, 100, 50);
    const corrupted = applyMask(frame, mask, 0);

    let changedPixels = 0;
    let unchangedPixels = 0;

    for (let i = 0; i < frame.data.length; i++) {
      if (corrupted.data[i] !== frame.data[i]) {
        changedPixels++;
      } else {
        unchangedPixels++;
      }
    }

    // Most pixels should remain unchanged
    expect(unchangedPixels).toBeGreaterThan(changedPixels);
  });

  it('clamps warm pixels to 255', () => {
    // Create a mask with a warm pixel
    const mask = generateMask({
      ...config,
      seed: 100,
      density: 10,
      typeMix: { stuck: 0, warm: 1, flicker: 0 },
      warmIntensityMean: 150,
    });

    // Create frame with bright pixels
    const frame = createTestFrame(100, 100, 200);
    const corrupted = applyMask(frame, mask, 0);

    // Check that no value exceeds 255
    for (let i = 0; i < corrupted.data.length; i++) {
      expect(corrupted.data[i]).toBeLessThanOrEqual(255);
    }
  });

  it('respects activation threshold for warm pixels', () => {
    // Create mask with high activation threshold warm pixels
    const mask = generateMask({
      ...config,
      seed: 200,
      density: 10,
      typeMix: { stuck: 0, warm: 1, flicker: 0 },
    });

    // Create frame with very bright pixels (should not be corrupted)
    const brightFrame = createTestFrame(100, 100, 250);
    const brightCorrupted = applyMask(brightFrame, mask, 0);

    // Check that bright pixels remain mostly unchanged
    let changedCount = 0;
    for (let i = 0; i < brightFrame.data.length; i += 4) {
      if (
        brightCorrupted.data[i] !== brightFrame.data[i] ||
        brightCorrupted.data[i + 1] !== brightFrame.data[i + 1] ||
        brightCorrupted.data[i + 2] !== brightFrame.data[i + 2]
      ) {
        changedCount++;
      }
    }

    // Very few bright pixels should be corrupted
    expect(changedCount).toBeLessThan(5);
  });

  it('handles flicker pixels deterministically across frames', () => {
    const mask = generateMask({
      ...config,
      seed: 300,
      density: 100,
      typeMix: { stuck: 0, warm: 0, flicker: 1 },
    });

    const frame = createTestFrame(100, 100, 50);

    // Apply to same frame index multiple times
    const result1 = applyMask(frame, mask, 5);
    const result2 = applyMask(frame, mask, 5);
    expect(result1.data).toEqual(result2.data);

    // Different frame indices may produce different results
    const result3 = applyMask(frame, mask, 10);
    // Don't assert they're different (might be same), just check determinism
    const result4 = applyMask(frame, mask, 10);
    expect(result3.data).toEqual(result4.data);
  });

  it('throws error when frame dimensions do not match mask', () => {
    const mask = generateMask(config);
    const wrongFrame = createTestFrame(50, 50);

    expect(() => applyMask(wrongFrame, mask, 0)).toThrow();
  });
});

describe('corruptSequence', () => {
  function createTestFrames(count: number, width: number, height: number): ImageData[] {
    const frames: ImageData[] = [];
    for (let i = 0; i < count; i++) {
      const data = new Uint8ClampedArray(width * height * 4);
      // Fill with varying gray levels
      const gray = 30 + i * 10;
      for (let j = 0; j < data.length; j += 4) {
        data[j] = gray;
        data[j + 1] = gray;
        data[j + 2] = gray;
        data[j + 3] = 255;
      }
      frames.push(new ImageData(data, width, height));
    }
    return frames;
  }

  it('corrupts all frames in sequence', () => {
    const frames = createTestFrames(5, 100, 100);
    const config: GeneratorConfig = {
      width: 100,
      height: 100,
      seed: 500,
      density: 50,
    };

    const { corrupted, mask } = corruptSequence(frames, config);

    expect(corrupted.length).toBe(frames.length);
    expect(mask.pixels.length).toBeGreaterThan(0);
  });

  it('returns deterministic results for same input', () => {
    const frames = createTestFrames(3, 50, 50);
    const config: GeneratorConfig = {
      width: 50,
      height: 50,
      seed: 600,
      density: 50,
    };

    const result1 = corruptSequence(frames, config);
    const result2 = corruptSequence(frames, config);

    expect(result1.mask).toEqual(result2.mask);
    for (let i = 0; i < result1.corrupted.length; i++) {
      const corrupted1 = result1.corrupted[i];
      const corrupted2 = result2.corrupted[i];
      expect(corrupted1).toBeDefined();
      expect(corrupted2).toBeDefined();
      if (corrupted1 && corrupted2) {
        expect(corrupted1.data).toEqual(corrupted2.data);
      }
    }
  });

  it('throws error for empty frame sequence', () => {
    const config: GeneratorConfig = {
      width: 100,
      height: 100,
      seed: 700,
      density: 50,
    };

    expect(() => corruptSequence([], config)).toThrow();
  });

  it('throws error when frames have mismatched dimensions', () => {
    const frame1 = createTestFrames(1, 100, 100)[0];
    const frame2 = createTestFrames(1, 200, 200)[0];
    if (!frame1 || !frame2) {
      throw new Error('Test setup failed: frames undefined');
    }
    const frames = [frame1, frame2];
    const config: GeneratorConfig = {
      width: 100,
      height: 100,
      seed: 800,
      density: 50,
    };

    expect(() => corruptSequence(frames, config)).toThrow();
  });
});

describe('serialization', () => {
  it('serializes and deserializes mask without loss', () => {
    const config: GeneratorConfig = {
      width: 1920,
      height: 1080,
      seed: 9001,
      density: 150,
    };

    const original = generateMask(config);
    const serialized = serializeMask(original);
    const deserialized = deserializeMask(serialized);

    expect(deserialized).toEqual(original);
  });

  it('throws error for invalid schema version', () => {
    const invalidJson = JSON.stringify({ schemaVersion: 999, pixels: [] });
    expect(() => deserializeMask(invalidJson)).toThrow();
  });

  it('throws error for malformed JSON', () => {
    expect(() => deserializeMask('not json')).toThrow();
  });

  it('throws error for missing required fields', () => {
    const invalidJson = JSON.stringify({ schemaVersion: 1 });
    expect(() => deserializeMask(invalidJson)).toThrow();
  });
});
