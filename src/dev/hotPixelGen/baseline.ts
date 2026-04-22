/**
 * Small dev-only baseline runner for synthetic hot pixel metrics.
 */

import { analyzeFrame, detectHotPixels } from '../../core/detection';
import { cloneImageData, repairAllPixels } from '../../core/repair';
import type { DetectionOptions, GeneratorConfig } from '../../types';
import type { EvalReport } from './eval';
import { evaluate } from './eval';
import { profiles } from './generator';
import { generateMask } from './mask';

export interface BaselineOptions {
  width?: number;
  height?: number;
  frameCount?: number;
  seed?: number;
  density?: number;
  detectionOptions?: DetectionOptions;
}

export async function runBaselineEvaluation(options: BaselineOptions = {}): Promise<EvalReport> {
  const width = options.width ?? 96;
  const height = options.height ?? 64;
  const frameCount = options.frameCount ?? 8;
  const cleanFrames = createBaselineFrames(frameCount, width, height);
  const maskConfig: GeneratorConfig = {
    ...profiles.typical,
    width,
    height,
    seed: options.seed ?? 1337,
    density: options.density ?? 3500,
  };
  const mask = generateMask(maskConfig);
  const detectionOptions: DetectionOptions = {
    threshold: 180,
    minConsistency: 0.5,
    sampleFrames: frameCount,
    ...options.detectionOptions,
  };

  return evaluate({
    cleanFrames,
    mask,
    detect: async (frames) => {
      const analyzedFrames = frames.map((frame) => analyzeFrame(frame, detectionOptions));
      const detected = detectHotPixels(analyzedFrames, width, height, detectionOptions);

      return new Set(
        Array.from(detected.pixels).map((pixelIndex) =>
          coordinateKey(pixelIndex % width, Math.floor(pixelIndex / width))
        )
      );
    },
    heal: async (frames, detected) =>
      frames.map((frame) => {
        const healed = cloneImageData(frame);
        repairAllPixels(healed, detectedCoordinatesToIndices(detected, width));
        return healed;
      }),
  });
}

export async function printBaselineEvaluation(options: BaselineOptions = {}): Promise<EvalReport> {
  const report = await runBaselineEvaluation(options);
  console.table({
    precision: roundMetric(report.precision),
    recall: roundMetric(report.recall),
    f1: roundMetric(report.f1),
    psnrVsClean: Number.isFinite(report.psnrVsClean)
      ? roundMetric(report.psnrVsClean)
      : report.psnrVsClean,
    ssimVsClean: roundMetric(report.ssimVsClean),
    maxAbsErrorVsClean: report.maxAbsErrorVsClean,
    detectionMs: roundMetric(report.detectionMs),
    healingMs: roundMetric(report.healingMs),
    framesProcessed: report.framesProcessed,
  });

  return report;
}

function createBaselineFrames(count: number, width: number, height: number): ImageData[] {
  return Array.from({ length: count }, (_, frameIndex) => {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const base = 18 + ((x + y + frameIndex) % 12);
        data[offset] = base;
        data[offset + 1] = base + 2;
        data[offset + 2] = base + 4;
        data[offset + 3] = 255;
      }
    }

    return new ImageData(data, width, height);
  });
}

function detectedCoordinatesToIndices(detected: Set<string>, width: number): number[] {
  return Array.from(detected).map((key) => {
    const [xValue, yValue] = key.split(',');
    const x = Number(xValue);
    const y = Number(yValue);

    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error(`Invalid detected coordinate key "${key}"; expected "x,y"`);
    }

    return y * width + x;
  });
}

function coordinateKey(x: number, y: number): string {
  return `${x},${y}`;
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}
