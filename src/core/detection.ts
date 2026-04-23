/**
 * Hot Pixel Detection Algorithm
 *
 * Strategy:
 * 1. Sample N frames from the sequence
 * 2. For each pixel, count how many frames it appears "hot" (brightness > threshold)
 * 3. Pixels that are hot in most/all frames are defective (stuck pixels)
 * 4. Moving objects (stars, planes) will only be hot in some frames
 */

import type { HotPixelMap, HotPixel, DetectionOptions } from '@/types';
import { withDetectionDefaults } from './presets';

const MIN_CONTRAST_NEIGHBOR_AVG = 8;

/**
 * Analyze a single frame and count hot pixels.
 * Returns a binary map where each element is 1 if hot, otherwise 0.
 */
export function analyzeFrame(
  imageData: ImageData,
  thresholdOrOptions: number | DetectionOptions
): Uint8Array {
  const options: DetectionOptions =
    typeof thresholdOrOptions === 'number'
      ? { threshold: thresholdOrOptions, adaptiveThreshold: false }
      : thresholdOrOptions;

  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const result = new Uint8Array(pixelCount);

  const threshold = resolveThreshold(imageData, options);
  const contrastEnabled = options.contrastEnabled ?? true;
  const contrastMinRatio = Math.max(1, options.contrastMinRatio ?? 1.5);

  for (let i = 0; i < pixelCount; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    const brightness = getPixelBrightness(data, i);
    const passesAbsoluteThreshold = brightness >= threshold;
    const passesContrastThreshold =
      contrastEnabled &&
      passesContrastCheck(data, x, y, width, height, brightness, contrastMinRatio);

    result[i] = passesAbsoluteThreshold || passesContrastThreshold ? 1 : 0;
  }

  return result;
}

/**
 * Combine analysis results from multiple frames to identify hot pixels
 */
function resolveThreshold(imageData: ImageData, options: DetectionOptions): number {
  const normalizedOptions = withDetectionDefaults(options);
  const baseThreshold = clampToByte(normalizedOptions.threshold ?? 240);

  if (!normalizedOptions.adaptiveThreshold) {
    return baseThreshold;
  }

  const percentile = clamp01(normalizedOptions.adaptivePercentile ?? 0.999);
  const [adaptiveMin, adaptiveMax] = normalizeAdaptiveBounds(
    normalizedOptions.adaptiveMinThreshold,
    normalizedOptions.adaptiveMaxThreshold
  );

  const percentileThreshold = getBrightnessPercentileThreshold(imageData, percentile);
  return clampToByte(Math.max(adaptiveMin, Math.min(adaptiveMax, percentileThreshold)));
}

function normalizeAdaptiveBounds(
  adaptiveMinThreshold: number | undefined,
  adaptiveMaxThreshold: number | undefined
): [number, number] {
  const clampedMin = clampToByte(adaptiveMinThreshold ?? 220);
  const clampedMax = clampToByte(adaptiveMaxThreshold ?? 255);
  return [Math.min(clampedMin, clampedMax), Math.max(clampedMin, clampedMax)];
}

function getBrightnessPercentileThreshold(imageData: ImageData, percentile: number): number {
  const histogram = new Uint32Array(256);
  const { data } = imageData;
  const pixelCount = imageData.width * imageData.height;

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const brightness = Math.max(data[idx]!, data[idx + 1]!, data[idx + 2]!);
    histogram[brightness]!++;
  }

  const target = Math.max(1, Math.ceil(pixelCount * percentile));
  let cumulative = 0;

  for (let brightness = 0; brightness < histogram.length; brightness++) {
    cumulative += histogram[brightness]!;
    if (cumulative >= target) {
      return brightness;
    }
  }

  return 255;
}

function getPixelBrightness(data: Uint8ClampedArray, pixelIndex: number): number {
  const idx = pixelIndex * 4;
  return Math.max(data[idx]!, data[idx + 1]!, data[idx + 2]!);
}

export function extractBrightnessMap(imageData: ImageData): Uint8Array {
  const pixelCount = imageData.width * imageData.height;
  const brightnessMap = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    brightnessMap[i] = getPixelBrightness(imageData.data, i);
  }

  return brightnessMap;
}

function passesContrastCheck(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number,
  brightness: number,
  contrastMinRatio: number
): boolean {
  let neighborBrightnessSum = 0;
  let neighborCount = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      neighborBrightnessSum += getPixelBrightness(data, ny * width + nx);
      neighborCount++;
    }
  }

  if (neighborCount === 0) {
    return false;
  }

  const neighborAvg = neighborBrightnessSum / neighborCount;
  const safeNeighborAvg = Math.max(neighborAvg, MIN_CONTRAST_NEIGHBOR_AVG);
  return brightness / safeNeighborAvg >= contrastMinRatio;
}

export function detectHotPixels(
  frameResults: Uint8Array[],
  width: number,
  height: number,
  options: DetectionOptions = {},
  frameBrightnessMaps?: Uint8Array[]
): HotPixelMap {
  const normalizedOptions = withDetectionDefaults(options);
  const { threshold = 240, minConsistency = 0.9 } = normalizedOptions;

  const pixelCount = width * height;
  const frameCount = frameResults.length;

  if (frameCount === 0 || pixelCount === 0) {
    return {
      pixels: new Set<number>(),
      details: [],
      threshold,
      minConsistency,
      width,
      height,
      framesAnalyzed: frameCount,
    };
  }

  const minHotFrames = Math.max(1, Math.floor(frameCount * minConsistency));
  const minRunRatio = clamp01(normalizedOptions.temporalMinRunRatio ?? 0);
  const minHotRunFrames = Math.max(1, Math.ceil(frameCount * minRunRatio));
  const spatialIsolationEnabled = normalizedOptions.spatialIsolationEnabled ?? false;
  const spatialMaxHotNeighbors = Math.max(0, Math.floor(normalizedOptions.spatialMaxHotNeighbors ?? 8));
  const varianceMaxThreshold = Math.max(0, normalizedOptions.varianceMaxThreshold ?? 100);
  const hasValidBrightnessMaps =
    Array.isArray(frameBrightnessMaps) &&
    frameBrightnessMaps.length === frameCount &&
    frameBrightnessMaps.every((frame) => frame.length === pixelCount);
  const varianceFilterEnabled = (normalizedOptions.varianceFilterEnabled ?? true) && hasValidBrightnessMaps;

  // Sum up hot counts across all frames and track temporal persistence
  const hotCounts = new Uint16Array(pixelCount);
  const currentRuns = new Uint16Array(pixelCount);
  const maxRuns = new Uint16Array(pixelCount);

  for (const frame of frameResults) {
    for (let i = 0; i < pixelCount; i++) {
      const isHot = frame[i] === 1;

      if (isHot) {
        hotCounts[i]! += 1;
        const updatedRun = currentRuns[i]! + 1;
        currentRuns[i] = updatedRun;
        if (updatedRun > maxRuns[i]!) {
          maxRuns[i] = updatedRun;
        }
      } else {
        currentRuns[i] = 0;
      }
    }
  }

  // Identify candidate pixels that are hot in enough frames and persistent enough over time
  const candidatePixels = new Set<number>();

  for (let i = 0; i < pixelCount; i++) {
    const count = hotCounts[i]!;
    const longestRun = maxRuns[i]!;
    const passesTemporalRun = minRunRatio <= 0 ? true : longestRun >= minHotRunFrames;

    if (count >= minHotFrames && passesTemporalRun) {
      candidatePixels.add(i);
    }
  }

  // Optionally remove clustered detections: true hot pixels are usually isolated.
  const pixels = new Set<number>();
  const details: HotPixel[] = [];

  for (const index of candidatePixels) {
    const x = index % width;
    const y = Math.floor(index / width);

    const passesSpatialIsolation =
      !spatialIsolationEnabled ||
      countHotNeighbors(candidatePixels, x, y, width, height) <= spatialMaxHotNeighbors;

    if (!passesSpatialIsolation) {
      continue;
    }

    const consistency = hotCounts[index]! / frameCount;

    if (
      varianceFilterEnabled &&
      consistency < 1 &&
      calculatePixelVariance(frameResults, frameBrightnessMaps!, index) > varianceMaxThreshold
    ) {
      continue;
    }

    pixels.add(index);
    details.push({
      x,
      y,
      index,
      avgBrightness: hasValidBrightnessMaps
        ? calculatePixelMean(frameResults, frameBrightnessMaps!, index)
        : 255,
      consistency,
    });
  }

  return {
    pixels,
    details,
    threshold,
    minConsistency,
    width,
    height,
    framesAnalyzed: frameCount,
  };
}

/**
 * Select which frame indices to sample for analysis
 * Distributes samples evenly across the sequence
 */
export function selectSampleFrames(totalFrames: number, sampleCount: number): number[] {
  if (sampleCount >= totalFrames) {
    return Array.from({ length: totalFrames }, (_, i) => i);
  }

  const indices: number[] = [];
  const step = (totalFrames - 1) / (sampleCount - 1);

  for (let i = 0; i < sampleCount; i++) {
    indices.push(Math.round(i * step));
  }

  return indices;
}

function calculatePixelMean(
  frameResults: Uint8Array[],
  frameBrightnessMaps: Uint8Array[],
  pixelIndex: number
): number {
  const hotFrameValues = collectHotFrameBrightnessValues(
    frameResults,
    frameBrightnessMaps,
    pixelIndex
  );

  if (hotFrameValues.length === 0) {
    return 0;
  }

  let sum = 0;
  for (const value of hotFrameValues) {
    sum += value;
  }

  return sum / hotFrameValues.length;
}

function calculatePixelVariance(
  frameResults: Uint8Array[],
  frameBrightnessMaps: Uint8Array[],
  pixelIndex: number
): number {
  const hotFrameValues = collectHotFrameBrightnessValues(
    frameResults,
    frameBrightnessMaps,
    pixelIndex
  );

  if (hotFrameValues.length < 2) {
    return 0;
  }

  const mean = hotFrameValues.reduce((sum, value) => sum + value, 0) / hotFrameValues.length;
  let squaredDiffSum = 0;

  for (const value of hotFrameValues) {
    const delta = value - mean;
    squaredDiffSum += delta * delta;
  }

  return squaredDiffSum / hotFrameValues.length;
}

function collectHotFrameBrightnessValues(
  frameResults: Uint8Array[],
  frameBrightnessMaps: Uint8Array[],
  pixelIndex: number
): number[] {
  const values: number[] = [];

  for (let frameIndex = 0; frameIndex < frameResults.length; frameIndex++) {
    if (frameResults[frameIndex]![pixelIndex] === 1) {
      values.push(frameBrightnessMaps[frameIndex]![pixelIndex]!);
    }
  }

  return values;
}

/**
 * Add or remove a hot pixel manually
 */
export function toggleHotPixel(map: HotPixelMap, x: number, y: number): HotPixelMap {
  const index = y * map.width + x;
  const newPixels = new Set(map.pixels);
  let newDetails = [...map.details];

  if (newPixels.has(index)) {
    // Remove
    newPixels.delete(index);
    newDetails = newDetails.filter((p) => p.index !== index);
  } else {
    // Add
    newPixels.add(index);
    newDetails.push({
      x,
      y,
      index,
      avgBrightness: 255,
      consistency: 1.0, // Manual addition = 100% confidence
    });
  }

  return {
    ...map,
    pixels: newPixels,
    details: newDetails,
  };
}

function countHotNeighbors(
  candidatePixels: Set<number>,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  let neighborCount = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const neighborIndex = ny * width + nx;
      if (candidatePixels.has(neighborIndex)) {
        neighborCount++;
      }
    }
  }

  return neighborCount;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampToByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}
