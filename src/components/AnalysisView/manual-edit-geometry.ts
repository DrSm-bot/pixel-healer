/**
 * Pure geometry helpers for manual pixel editing. Isolated from React so the
 * coordinate math can be tested without jsdom or canvas polyfills.
 */

export interface PointerRect {
  /** Offset of the click relative to the rendered element's top-left. */
  offsetX: number;
  offsetY: number;
  /** Rendered element dimensions in CSS pixels. */
  displayWidth: number;
  displayHeight: number;
}

export interface ImageDims {
  width: number;
  height: number;
}

/**
 * Convert a pointer event offset on the rendered image to integer pixel
 * coordinates in the source image. Returns `null` if the click falls outside
 * the image bounds or if the element hasn't laid out yet (zero size).
 */
export function clientToImagePixel(rect: PointerRect, dims: ImageDims): { x: number; y: number } | null {
  const { offsetX, offsetY, displayWidth, displayHeight } = rect;
  if (displayWidth <= 0 || displayHeight <= 0) return null;
  if (dims.width <= 0 || dims.height <= 0) return null;

  const relX = offsetX / displayWidth;
  const relY = offsetY / displayHeight;

  // Clamp to [0, 1) so we never index outside the image. A click exactly on the
  // bottom/right edge would otherwise produce width/height, one past the last
  // valid index.
  if (relX < 0 || relY < 0 || relX > 1 || relY > 1) return null;

  const x = Math.min(dims.width - 1, Math.max(0, Math.floor(relX * dims.width)));
  const y = Math.min(dims.height - 1, Math.max(0, Math.floor(relY * dims.height)));
  return { x, y };
}
