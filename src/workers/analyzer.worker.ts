/**
 * Analyzer Web Worker
 *
 * Handles frame analysis off the main thread.
 * Uses Comlink for easy RPC-style communication.
 */

import * as Comlink from 'comlink';
import { analyzeFrame, detectHotPixels } from '@/core/detection';
import type { HotPixelMap, DetectionOptions } from '@/types';

interface AnalyzerWorkerApi {
  /**
   * Analyze a single frame and return hot pixel counts
   */
  analyzeFrame: (imageData: ImageData, threshold: number) => Uint8Array;

  /**
   * Combine multiple frame analyses into a final hot pixel map
   */
  detectHotPixels: (
    frameResults: Uint8Array[],
    width: number,
    height: number,
    options: DetectionOptions
  ) => HotPixelMap;

  /**
   * Process multiple frames and return the combined result
   * For when you want to do everything in one call
   */
  analyzeAndDetect: (
    frames: ImageData[],
    options: DetectionOptions
  ) => HotPixelMap;
}

const api: AnalyzerWorkerApi = {
  analyzeFrame(imageData: ImageData, threshold: number): Uint8Array {
    return analyzeFrame(imageData, threshold);
  },

  detectHotPixels(
    frameResults: Uint8Array[],
    width: number,
    height: number,
    options: DetectionOptions
  ): HotPixelMap {
    return detectHotPixels(frameResults, width, height, options);
  },

  analyzeAndDetect(frames: ImageData[], options: DetectionOptions): HotPixelMap {
    if (frames.length === 0) {
      throw new Error('No frames provided');
    }

    const threshold = options.threshold ?? 240;
    const firstFrame = frames[0]!;

    // Analyze each frame
    const frameResults = frames.map((frame) => analyzeFrame(frame, threshold));

    // Combine results
    return detectHotPixels(
      frameResults,
      firstFrame.width,
      firstFrame.height,
      options
    );
  },
};

Comlink.expose(api);

export type { AnalyzerWorkerApi };
