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

/**
 * Analyze a single frame and count hot pixels
 * Returns a Uint16Array where each element is the brightness of that pixel
 */
export function analyzeFrame(imageData: ImageData, threshold: number): Uint8Array {
  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const result = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    // Get max of RGB channels as brightness
    const brightness = Math.max(data[idx]!, data[idx + 1]!, data[idx + 2]!);
    // Store 1 if hot, 0 if not
    result[i] = brightness >= threshold ? 1 : 0;
  }

  return result;
}

/**
 * Combine analysis results from multiple frames to identify hot pixels
 */
export function detectHotPixels(
  frameResults: Uint8Array[],
  width: number,
  height: number,
  options: DetectionOptions = {}
): HotPixelMap {
  const { threshold = 240, minConsistency = 0.9 } = options;

  const pixelCount = width * height;
  const frameCount = frameResults.length;
  const minHotFrames = Math.floor(frameCount * minConsistency);

  // Sum up hot counts across all frames
  const hotCounts = new Uint16Array(pixelCount);

  for (const frame of frameResults) {
    for (let i = 0; i < pixelCount; i++) {
      hotCounts[i]! += frame[i]!;
    }
  }

  // Identify pixels that are hot in enough frames
  const pixels = new Set<number>();
  const details: HotPixel[] = [];

  for (let i = 0; i < pixelCount; i++) {
    const count = hotCounts[i]!;
    if (count >= minHotFrames) {
      pixels.add(i);

      const x = i % width;
      const y = Math.floor(i / width);
      const consistency = count / frameCount;

      details.push({
        x,
        y,
        index: i,
        avgBrightness: 255, // Placeholder - would need actual values
        consistency,
      });
    }
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
