/**
 * Hot pixel mask generation logic
 */

import type { GeneratorConfig, HotPixelMask, SyntheticHotPixel } from '../../types';
import { SeededRNG } from './rng';

/**
 * Default configuration values
 */
const DEFAULTS = {
  density: 150, // hot pixels per megapixel
  typeMix: { stuck: 0.3, warm: 0.6, flicker: 0.1 },
  channelMix: { r: 0.33, g: 0.33, b: 0.33, rgb: 0.01 },
  warmIntensityMean: 40,
  stuckIntensityMax255Prob: 0.8,
  flickerProbabilityRange: [0.3, 0.9] as [number, number],
};

/**
 * Generate a hot pixel mask from configuration
 */
export function generateMask(config: GeneratorConfig): HotPixelMask {
  const rng = new SeededRNG(config.seed);

  // Merge with defaults
  const density = config.density ?? DEFAULTS.density;
  const typeMix = config.typeMix ?? DEFAULTS.typeMix;
  const channelMix = config.channelMix ?? DEFAULTS.channelMix;
  const warmIntensityMean = config.warmIntensityMean ?? DEFAULTS.warmIntensityMean;
  const stuckIntensityMax255Prob = config.stuckIntensityMax255Prob ?? DEFAULTS.stuckIntensityMax255Prob;
  const flickerProbabilityRange = config.flickerProbabilityRange ?? DEFAULTS.flickerProbabilityRange;

  if (config.width < 1 || config.height < 1) {
    throw new Error('Invalid dimensions: width and height must be >= 1');
  }

  // Calculate total number of hot pixels
  const megapixels = (config.width * config.height) / 1_000_000;
  const requestedPixels = Math.max(0, Math.round(megapixels * density));

  // Build cumulative distribution arrays for sampling
  const typeWeights = buildCumulativeWeights([typeMix.stuck, typeMix.warm, typeMix.flicker]);
  const channelWeights = buildCumulativeWeights([
    channelMix.r,
    channelMix.g,
    channelMix.b,
    channelMix.rgb,
  ]);

  const pixels: SyntheticHotPixel[] = [];
  const usedPositions = new Set<string>();

  // Prefer interior pixels; gracefully relax for tiny frames
  const minX = config.width > 2 ? 1 : 0;
  const maxX = config.width > 2 ? config.width - 2 : config.width - 1;
  const minY = config.height > 2 ? 1 : 0;
  const maxY = config.height > 2 ? config.height - 2 : config.height - 1;

  const availablePositions = Math.max(0, (maxX - minX + 1) * (maxY - minY + 1));
  const totalPixels = Math.min(requestedPixels, availablePositions);

  for (let i = 0; i < totalPixels; i++) {
    // Generate unique position
    let x: number, y: number, posKey: string;
    let attempts = 0;
    do {
      x = rng.nextInt(minX, maxX);
      y = rng.nextInt(minY, maxY);
      posKey = `${x},${y}`;
      attempts++;
      // Fallback if we can't find unique position (very unlikely)
      if (attempts > 1000) break;
    } while (usedPositions.has(posKey));

    if (attempts > 1000) continue; // Skip if we couldn't find unique position
    usedPositions.add(posKey);

    // Sample type
    const typeRoll = rng.next();
    const type = sampleFromCDF(['stuck', 'warm', 'flicker'] as const, typeWeights, typeRoll);

    // Sample channel
    const channelRoll = rng.next();
    const channel = sampleFromCDF(['r', 'g', 'b', 'rgb'] as const, channelWeights, channelRoll);

    // Generate intensity based on type
    let intensity: number;
    if (type === 'stuck') {
      if (rng.next() < stuckIntensityMax255Prob) {
        intensity = 255;
      } else {
        intensity = rng.nextInt(180, 254);
      }
    } else if (type === 'warm') {
      // Long-tail distribution using exponential, clamped to reasonable range
      const lambda = 1 / warmIntensityMean;
      intensity = Math.round(rng.nextExponential(lambda));
      intensity = Math.max(10, Math.min(200, intensity));
    } else {
      // flicker: treat like stuck for intensity
      if (rng.next() < stuckIntensityMax255Prob) {
        intensity = 255;
      } else {
        intensity = rng.nextInt(180, 254);
      }
    }

    // Activation threshold (mostly high for warm pixels to show in dark regions)
    const activationThreshold = type === 'warm' ? rng.nextInt(100, 200) : 255;

    // Flicker probability
    const flickerProbability = type === 'flicker'
      ? rng.nextFloat(flickerProbabilityRange[0], flickerProbabilityRange[1])
      : 1.0;

    pixels.push({
      x,
      y,
      channel,
      type,
      intensity,
      activationThreshold,
      flickerProbability,
    });
  }

  const mask: HotPixelMask = {
    schemaVersion: 1,
    width: config.width,
    height: config.height,
    pixels,
    seed: config.seed,
    generatedAt: deterministicGeneratedAt(config),
  };

  return mask;
}

/**
 * Build cumulative distribution function for weighted sampling
 */
function buildCumulativeWeights(weights: number[]): number[] {
  const cdf: number[] = [];
  let sum = 0;
  for (const w of weights) {
    sum += w;
    cdf.push(sum);
  }
  // Normalize to ensure last value is exactly 1.0
  return cdf.map(v => v / sum);
}

/**
 * Sample from cumulative distribution function
 */
function sampleFromCDF<T>(values: readonly T[], cdf: number[], roll: number): T {
  for (let i = 0; i < cdf.length; i++) {
    const threshold = cdf[i];
    if (threshold !== undefined && roll < threshold) {
      const value = values[i];
      if (value !== undefined) {
        return value;
      }
    }
  }
  const lastValue = values[values.length - 1];
  if (lastValue === undefined) {
    throw new Error('CDF sampling failed: values array is empty');
  }
  return lastValue;
}

/**
 * Deterministic timestamp derived from configuration.
 * Keeps mask generation fully reproducible for identical config/seed.
 */
function deterministicGeneratedAt(config: GeneratorConfig): string {
  const hash = SeededRNG.hash(
    SeededRNG.hash(config.seed, config.width, config.height),
    Math.round((config.density ?? DEFAULTS.density) * 1000),
    1
  );
  return new Date(hash * 1000).toISOString();
}
