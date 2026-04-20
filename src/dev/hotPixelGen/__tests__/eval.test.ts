/**
 * Unit tests for synthetic hot pixel evaluation harness.
 */

import { describe, expect, it } from 'vitest';
import { evaluate } from '../index';
import type { HotPixelMask } from '../../../types';

describe('evaluate', () => {
  it('reports perfect precision and recall for an oracle detector and healer', async () => {
    const cleanFrames = createFrames(3, 6, 6, 20);
    const mask = createMask();

    const report = await evaluate({
      cleanFrames,
      mask,
      detect: async () => new Set(mask.pixels.map((pixel) => `${pixel.x},${pixel.y}`)),
      heal: async () => cleanFrames.map(cloneImageData),
    });

    expect(report.truePositives).toBe(mask.pixels.length);
    expect(report.falsePositives).toBe(0);
    expect(report.falseNegatives).toBe(0);
    expect(report.precision).toBe(1);
    expect(report.recall).toBe(1);
    expect(report.f1).toBe(1);
    expect(report.psnrVsClean).toBe(Infinity);
    expect(report.ssimVsClean).toBeCloseTo(1);
    expect(report.maxAbsErrorVsClean).toBe(0);
    expect(report.framesProcessed).toBe(cleanFrames.length);
    expect(report.detectionMs).toBeGreaterThanOrEqual(0);
    expect(report.healingMs).toBeGreaterThanOrEqual(0);
    expect(report.perType.stuck.precision).toBe(1);
    expect(report.perType.warm.recall).toBe(1);
    expect(report.perChannel.b.f1).toBe(1);
  });

  it('calculates confusion metrics for partial detections', async () => {
    const cleanFrames = createFrames(1, 6, 6, 20);
    const mask = createMask();

    const report = await evaluate({
      cleanFrames,
      mask,
      detect: async () => new Set(['1,1', '2,2', '5,5']),
      heal: async (frames) => frames.map(cloneImageData),
    });

    expect(report.truePositives).toBe(2);
    expect(report.falsePositives).toBe(1);
    expect(report.falseNegatives).toBe(1);
    expect(report.precision).toBeCloseTo(2 / 3);
    expect(report.recall).toBeCloseTo(2 / 3);
    expect(report.f1).toBeCloseTo(2 / 3);
    expect(report.maxAbsErrorVsClean).toBeGreaterThan(0);

    expect(report.perType.stuck.precision).toBe(1);
    expect(report.perType.stuck.recall).toBe(1);
    expect(report.perType.warm.precision).toBe(1);
    expect(report.perType.warm.recall).toBe(1);
    expect(report.perType.flicker.precision).toBe(1);
    expect(report.perType.flicker.recall).toBe(0);

    expect(report.perChannel.r.precision).toBe(1);
    expect(report.perChannel.g.precision).toBe(1);
    expect(report.perChannel.b.recall).toBe(0);
  });

  it('passes corrupted frames into the detector', async () => {
    const cleanFrames = createFrames(1, 6, 6, 20);
    const mask = createMask();
    const stuckPixelOffset = (1 * mask.width + 1) * 4;

    await evaluate({
      cleanFrames,
      mask,
      detect: async (frames) => {
        const firstFrame = frames[0];
        expect(firstFrame).toBeDefined();
        expect(firstFrame?.data[stuckPixelOffset]).toBe(250);
        expect(cleanFrames[0]?.data[stuckPixelOffset]).toBe(20);
        return new Set();
      },
      heal: async (frames) => frames.map(cloneImageData),
    });
  });

  it('throws when heal returns the wrong number of frames', async () => {
    const cleanFrames = createFrames(2, 6, 6, 20);
    const mask = createMask();

    await expect(
      evaluate({
        cleanFrames,
        mask,
        detect: async () => new Set(),
        heal: async () => [],
      })
    ).rejects.toThrow('Heal function returned 0 frames; expected 2');
  });

  it('averages PSNR over finite frames when sequence mixes perfect and imperfect heals', async () => {
    const cleanFrames = createFrames(2, 6, 6, 20);
    const mask = createMask();

    const report = await evaluate({
      cleanFrames,
      mask,
      detect: async () => new Set(mask.pixels.map((pixel) => `${pixel.x},${pixel.y}`)),
      heal: async (frames) => {
        const first = cloneImageData(cleanFrames[0]!);
        const second = cloneImageData(frames[1]!); // imperfect on purpose
        return [first, second];
      },
    });

    expect(Number.isFinite(report.psnrVsClean)).toBe(true);
    expect(report.psnrVsClean).toBeGreaterThan(0);
  });
});

function createMask(): HotPixelMask {
  return {
    schemaVersion: 1,
    width: 6,
    height: 6,
    seed: 123,
    generatedAt: '1970-01-01T00:00:00.000Z',
    pixels: [
      {
        x: 1,
        y: 1,
        channel: 'r',
        type: 'stuck',
        intensity: 250,
        activationThreshold: 255,
        flickerProbability: 1,
      },
      {
        x: 2,
        y: 2,
        channel: 'g',
        type: 'warm',
        intensity: 30,
        activationThreshold: 255,
        flickerProbability: 1,
      },
      {
        x: 3,
        y: 3,
        channel: 'b',
        type: 'flicker',
        intensity: 240,
        activationThreshold: 255,
        flickerProbability: 1,
      },
    ],
  };
}

function createFrames(count: number, width: number, height: number, value: number): ImageData[] {
  return Array.from({ length: count }, () => {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }

    return new ImageData(data, width, height);
  });
}

function cloneImageData(imageData: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}
