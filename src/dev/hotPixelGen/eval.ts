/**
 * Evaluation harness for synthetic hot pixel detection and healing.
 */

import type { HotPixelMask, SyntheticHotPixel } from '../../types';
import { applyMask } from './generator';

export interface EvalScore {
  precision: number;
  recall: number;
  f1: number;
}

export interface EvalReport {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;

  psnrVsClean: number;
  ssimVsClean: number;
  maxAbsErrorVsClean: number;

  detectionMs: number;
  healingMs: number;
  framesProcessed: number;

  perType: Record<SyntheticHotPixel['type'], EvalScore>;
  perChannel: Record<SyntheticHotPixel['channel'], EvalScore>;
}

export interface EvaluateOptions {
  cleanFrames: ImageData[];
  mask: HotPixelMask;
  detect: (frames: ImageData[]) => Promise<Set<string>>;
  heal: (frames: ImageData[], detected: Set<string>) => Promise<ImageData[]>;
}

type GroupKey = SyntheticHotPixel['type'] | SyntheticHotPixel['channel'];

const HOT_PIXEL_TYPES: SyntheticHotPixel['type'][] = ['stuck', 'warm', 'flicker'];
const HOT_PIXEL_CHANNELS: SyntheticHotPixel['channel'][] = ['r', 'g', 'b', 'rgb'];

export async function evaluate(opts: EvaluateOptions): Promise<EvalReport> {
  validateInputs(opts.cleanFrames, opts.mask);

  const corruptedFrames = opts.cleanFrames.map((frame, frameIndex) =>
    applyMask(frame, opts.mask, frameIndex)
  );

  const detectionStartedAt = nowMs();
  const detected = normalizeDetectedSet(await opts.detect(corruptedFrames));
  const detectionMs = nowMs() - detectionStartedAt;

  const healingStartedAt = nowMs();
  const healedFrames = await opts.heal(corruptedFrames, detected);
  const healingMs = nowMs() - healingStartedAt;

  validateHealedFrames(opts.cleanFrames, healedFrames);

  const truth = buildTruthSet(opts.mask);
  const { truePositives, falsePositives, falseNegatives } =
    calculateConfusion(truth, detected);
  const overall = score(truePositives, falsePositives, falseNegatives);
  const imageQuality = calculateImageQuality(opts.cleanFrames, healedFrames);

  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision: overall.precision,
    recall: overall.recall,
    f1: overall.f1,
    psnrVsClean: imageQuality.psnr,
    ssimVsClean: imageQuality.ssim,
    maxAbsErrorVsClean: imageQuality.maxAbsError,
    detectionMs,
    healingMs,
    framesProcessed: opts.cleanFrames.length,
    perType: buildGroupScores(opts.mask, detected, 'type', HOT_PIXEL_TYPES),
    perChannel: buildGroupScores(opts.mask, detected, 'channel', HOT_PIXEL_CHANNELS),
  };
}

function validateInputs(cleanFrames: ImageData[], mask: HotPixelMask): void {
  if (cleanFrames.length === 0) {
    throw new Error('Cannot evaluate an empty frame sequence');
  }

  for (let i = 0; i < cleanFrames.length; i++) {
    const frame = cleanFrames[i];
    if (!frame) {
      throw new Error(`Clean frame ${i} is undefined`);
    }
    if (frame.width !== mask.width || frame.height !== mask.height) {
      throw new Error(
        `Clean frame ${i} dimensions (${frame.width}x${frame.height}) do not match mask (${mask.width}x${mask.height})`
      );
    }
  }
}

function validateHealedFrames(cleanFrames: ImageData[], healedFrames: ImageData[]): void {
  if (healedFrames.length !== cleanFrames.length) {
    throw new Error(
      `Heal function returned ${healedFrames.length} frames; expected ${cleanFrames.length}`
    );
  }

  for (let i = 0; i < cleanFrames.length; i++) {
    const clean = cleanFrames[i];
    const healed = healedFrames[i];
    if (!clean || !healed) {
      throw new Error(`Healed frame ${i} is undefined`);
    }
    if (clean.width !== healed.width || clean.height !== healed.height) {
      throw new Error(
        `Healed frame ${i} dimensions (${healed.width}x${healed.height}) do not match clean frame (${clean.width}x${clean.height})`
      );
    }
  }
}

function buildTruthSet(mask: HotPixelMask): Set<string> {
  return new Set(mask.pixels.map((pixel) => coordinateKey(pixel.x, pixel.y)));
}

function normalizeDetectedSet(detected: Set<string>): Set<string> {
  const normalized = new Set<string>();
  for (const key of detected) {
    const parsed = parseCoordinateKey(key);
    normalized.add(coordinateKey(parsed.x, parsed.y));
  }
  return normalized;
}

function calculateConfusion(
  truth: Set<string>,
  detected: Set<string>
): { truePositives: number; falsePositives: number; falseNegatives: number } {
  let truePositives = 0;
  let falsePositives = 0;

  for (const key of detected) {
    if (truth.has(key)) {
      truePositives++;
    } else {
      falsePositives++;
    }
  }

  let falseNegatives = 0;
  for (const key of truth) {
    if (!detected.has(key)) {
      falseNegatives++;
    }
  }

  return { truePositives, falsePositives, falseNegatives };
}

function score(truePositives: number, falsePositives: number, falseNegatives: number): EvalScore {
  const precision = divideOrOne(truePositives, truePositives + falsePositives);
  const recall = divideOrOne(truePositives, truePositives + falseNegatives);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return { precision, recall, f1 };
}

function buildGroupScores<T extends GroupKey>(
  mask: HotPixelMask,
  detected: Set<string>,
  field: 'type' | 'channel',
  groups: readonly T[]
): Record<T, EvalScore> {
  const result = {} as Record<T, EvalScore>;
  const truth = buildTruthSet(mask);
  const { falsePositives } = calculateConfusion(truth, detected);

  for (const group of groups) {
    const groupTruth = new Set(
      mask.pixels
        .filter((pixel) => pixel[field] === group)
        .map((pixel) => coordinateKey(pixel.x, pixel.y))
    );
    const { truePositives, falseNegatives } = calculateGroupConfusion(groupTruth, detected);
    result[group] = score(truePositives, falsePositives, falseNegatives);
  }

  return result;
}

function calculateGroupConfusion(
  groupTruth: Set<string>,
  detected: Set<string>
): { truePositives: number; falseNegatives: number } {
  let truePositives = 0;
  let falseNegatives = 0;

  for (const key of groupTruth) {
    if (detected.has(key)) {
      truePositives++;
    } else {
      falseNegatives++;
    }
  }

  return { truePositives, falseNegatives };
}

function calculateImageQuality(
  cleanFrames: ImageData[],
  healedFrames: ImageData[]
): { psnr: number; ssim: number; maxAbsError: number } {
  let psnrSum = 0;
  let ssimSum = 0;
  let maxAbsError = 0;

  for (let i = 0; i < cleanFrames.length; i++) {
    const clean = cleanFrames[i];
    const healed = healedFrames[i];
    if (!clean || !healed) {
      throw new Error(`Frame ${i} is undefined`);
    }

    psnrSum += calculatePsnr(clean, healed);
    ssimSum += calculateSsim(clean, healed);
    maxAbsError = Math.max(maxAbsError, calculateMaxAbsError(clean, healed));
  }

  return {
    psnr: psnrSum / cleanFrames.length,
    ssim: ssimSum / cleanFrames.length,
    maxAbsError,
  };
}

function calculatePsnr(clean: ImageData, healed: ImageData): number {
  let squaredErrorSum = 0;
  let sampleCount = 0;

  for (let i = 0; i < clean.data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      const diff = clean.data[i + channel]! - healed.data[i + channel]!;
      squaredErrorSum += diff * diff;
      sampleCount++;
    }
  }

  if (squaredErrorSum === 0) {
    return Infinity;
  }

  const mse = squaredErrorSum / sampleCount;
  return 10 * Math.log10((255 * 255) / mse);
}

function calculateSsim(clean: ImageData, healed: ImageData): number {
  const sampleCount = clean.width * clean.height * 3;
  let cleanSum = 0;
  let healedSum = 0;

  for (let i = 0; i < clean.data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      cleanSum += clean.data[i + channel]!;
      healedSum += healed.data[i + channel]!;
    }
  }

  const cleanMean = cleanSum / sampleCount;
  const healedMean = healedSum / sampleCount;
  let cleanVariance = 0;
  let healedVariance = 0;
  let covariance = 0;

  for (let i = 0; i < clean.data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      const cleanDelta = clean.data[i + channel]! - cleanMean;
      const healedDelta = healed.data[i + channel]! - healedMean;
      cleanVariance += cleanDelta * cleanDelta;
      healedVariance += healedDelta * healedDelta;
      covariance += cleanDelta * healedDelta;
    }
  }

  cleanVariance /= sampleCount;
  healedVariance /= sampleCount;
  covariance /= sampleCount;

  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const numerator = (2 * cleanMean * healedMean + c1) * (2 * covariance + c2);
  const denominator =
    (cleanMean * cleanMean + healedMean * healedMean + c1) *
    (cleanVariance + healedVariance + c2);

  return denominator === 0 ? 1 : numerator / denominator;
}

function calculateMaxAbsError(clean: ImageData, healed: ImageData): number {
  let maxAbsError = 0;

  for (let i = 0; i < clean.data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      maxAbsError = Math.max(
        maxAbsError,
        Math.abs(clean.data[i + channel]! - healed.data[i + channel]!)
      );
    }
  }

  return maxAbsError;
}

function parseCoordinateKey(key: string): { x: number; y: number } {
  const [xValue, yValue, extra] = key.split(',');
  const x = Number(xValue);
  const y = Number(yValue);

  if (extra !== undefined || !Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error(`Invalid detected coordinate key "${key}"; expected "x,y"`);
  }

  return { x, y };
}

function coordinateKey(x: number, y: number): string {
  return `${x},${y}`;
}

function divideOrOne(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

function nowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}
