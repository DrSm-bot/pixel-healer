import type { HotPixelMap } from '../../types';
import { cloneImageData, repairAllPixels } from '../../core/repair';

/**
 * Build the repaired ("after") ImageData by cloning the sample frame and
 * running the repair algorithm against it. Returns null if either input is
 * missing so callers can bail out cleanly.
 *
 * This function is intentionally pure and DOM-free so it can be unit tested
 * in a Node environment.
 */
export function buildAfterImage(
  sampleFrameData: ImageData | null,
  hotPixelMap: HotPixelMap | null
): ImageData | null {
  if (!sampleFrameData || !hotPixelMap) return null;
  const after = cloneImageData(sampleFrameData);
  repairAllPixels(after, hotPixelMap.pixels);
  return after;
}
