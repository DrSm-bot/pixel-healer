/**
 * Pixel Repair Algorithm
 *
 * Replaces hot pixels with the average of their neighbors.
 * Uses a 3x3 neighborhood excluding the center pixel.
 */

/**
 * Repair a single pixel by averaging its neighbors
 */
export function repairPixel(imageData: ImageData, pixelIndex: number): void {
  const { data, width, height } = imageData;

  const x = pixelIndex % width;
  const y = Math.floor(pixelIndex / width);

  // Collect neighboring pixel values (3x3 excluding center)
  const neighbors: [number, number, number][] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      // Skip center pixel
      if (dx === 0 && dy === 0) continue;

      const nx = x + dx;
      const ny = y + dy;

      // Check bounds
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = (ny * width + nx) * 4;
        neighbors.push([data[idx]!, data[idx + 1]!, data[idx + 2]!]);
      }
    }
  }

  // Should never happen, but guard against edge cases
  if (neighbors.length === 0) return;

  // Calculate average
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (const [r, g, b] of neighbors) {
    sumR += r;
    sumG += g;
    sumB += b;
  }

  const idx = pixelIndex * 4;
  data[idx] = Math.round(sumR / neighbors.length);
  data[idx + 1] = Math.round(sumG / neighbors.length);
  data[idx + 2] = Math.round(sumB / neighbors.length);
  // Alpha channel unchanged
}

/**
 * Repair all hot pixels in an image
 * Modifies imageData in place
 */
export function repairAllPixels(imageData: ImageData, hotPixels: Set<number> | number[]): number {
  const pixels = Array.isArray(hotPixels) ? hotPixels : Array.from(hotPixels);

  for (const pixelIndex of pixels) {
    repairPixel(imageData, pixelIndex);
  }

  return pixels.length;
}

/**
 * Create a copy of ImageData
 */
export function cloneImageData(imageData: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}
