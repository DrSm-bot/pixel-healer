/**
 * Core API for synthetic hot pixel generation and application
 */

import type { GeneratorConfig, HotPixelMask, SyntheticHotPixel } from '../../types';
import { generateMask } from './mask';
import { SeededRNG } from './rng';

/**
 * Apply hot pixel mask to a single frame
 * Deterministic based on mask, frameIndex, and pixel characteristics
 */
export function applyMask(
  frame: ImageData,
  mask: HotPixelMask,
  frameIndex: number
): ImageData {
  // Clone the frame to avoid mutating the original
  const corrupted = new ImageData(
    new Uint8ClampedArray(frame.data),
    frame.width,
    frame.height
  );

  if (frame.width !== mask.width || frame.height !== mask.height) {
    throw new Error(
      `Frame dimensions (${frame.width}x${frame.height}) do not match mask (${mask.width}x${mask.height})`
    );
  }

  const data = corrupted.data;

  for (let i = 0; i < mask.pixels.length; i++) {
    const pixel = mask.pixels[i];
    if (!pixel) continue;

    // Check if flicker pixel should manifest in this frame
    if (pixel.type === 'flicker') {
      const flickerHash = SeededRNG.hash(mask.seed, i, frameIndex);
      if (flickerHash >= pixel.flickerProbability) {
        continue; // Skip this pixel in this frame
      }
    }

    const offset = (pixel.y * frame.width + pixel.x) * 4;

    // Determine which channels to corrupt
    const channels = getChannelIndices(pixel.channel);

    for (const ch of channels) {
      const channelOffset = offset + ch;
      const originalValue = data[channelOffset];
      if (originalValue === undefined) continue;

      // Check activation threshold
      if (originalValue >= pixel.activationThreshold) {
        continue; // Don't corrupt bright pixels
      }

      if (pixel.type === 'stuck') {
        // Stuck: set to fixed high value
        data[channelOffset] = pixel.intensity;
      } else if (pixel.type === 'warm') {
        // Warm: add offset, clamped to 255
        data[channelOffset] = Math.min(255, originalValue + pixel.intensity);
      } else {
        // Flicker: treat like stuck when active
        data[channelOffset] = pixel.intensity;
      }
    }
  }

  return corrupted;
}

/**
 * Corrupt an entire sequence of frames with synthetic hot pixels
 * Returns both the corrupted frames and the mask used
 */
export function corruptSequence(
  frames: ImageData[],
  config: GeneratorConfig
): { corrupted: ImageData[]; mask: HotPixelMask } {
  if (frames.length === 0) {
    throw new Error('Cannot corrupt empty frame sequence');
  }

  // Validate all frames have same dimensions
  const firstFrame = frames[0];
  if (!firstFrame) {
    throw new Error('First frame is undefined');
  }
  const width = firstFrame.width;
  const height = firstFrame.height;
  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i];
    if (!frame) {
      throw new Error(`Frame ${i} is undefined`);
    }
    if (frame.width !== width || frame.height !== height) {
      throw new Error(
        `Frame ${i} dimensions (${frame.width}x${frame.height}) do not match first frame (${width}x${height})`
      );
    }
  }

  // Generate mask
  const mask = generateMask({
    ...config,
    width,
    height,
  });

  // Apply mask to each frame
  const corrupted = frames.map((frame, index) => applyMask(frame, mask, index));

  return { corrupted, mask };
}

/**
 * Serialize mask to JSON string
 */
export function serializeMask(mask: HotPixelMask): string {
  return JSON.stringify(mask, null, 2);
}

/**
 * Deserialize mask from JSON string
 */
export function deserializeMask(json: string): HotPixelMask {
  const mask = JSON.parse(json) as HotPixelMask;

  // Validate schema version
  if (mask.schemaVersion !== 1) {
    throw new Error(`Unsupported mask schema version: ${mask.schemaVersion}`);
  }

  // Basic validation
  if (!mask.width || !mask.height || !Array.isArray(mask.pixels)) {
    throw new Error('Invalid mask format');
  }

  return mask;
}

/**
 * Get channel indices for RGBA data array
 */
function getChannelIndices(channel: SyntheticHotPixel['channel']): number[] {
  switch (channel) {
    case 'r':
      return [0];
    case 'g':
      return [1];
    case 'b':
      return [2];
    case 'rgb':
      return [0, 1, 2];
  }
}

/**
 * Difficulty profiles for testing
 */
export const profiles: Record<
  'easy' | 'typical' | 'nasty' | 'pathological',
  Partial<GeneratorConfig>
> = {
  easy: {
    density: 50,
    typeMix: { stuck: 0.8, warm: 0.15, flicker: 0.05 },
    stuckIntensityMax255Prob: 0.95,
  },
  typical: {
    density: 150,
    typeMix: { stuck: 0.3, warm: 0.6, flicker: 0.1 },
  },
  nasty: {
    density: 400,
    typeMix: { stuck: 0.2, warm: 0.7, flicker: 0.1 },
    warmIntensityMean: 50,
  },
  pathological: {
    density: 800,
    typeMix: { stuck: 0.2, warm: 0.5, flicker: 0.3 },
    flickerProbabilityRange: [0.4, 0.8],
  },
};
