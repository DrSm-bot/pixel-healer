/**
 * Image Utility Functions
 */

/**
 * Create an overlay showing hot pixels on an image
 * Returns a new canvas with hot pixels highlighted in red
 */
export function createHotPixelOverlay(
  imageData: ImageData,
  hotPixels: Set<number>,
  overlayColor: [number, number, number, number] = [255, 0, 0, 200]
): ImageData {
  // Clone the image data
  const overlay = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );

  const [r, g, b, a] = overlayColor;

  for (const pixelIndex of hotPixels) {
    const idx = pixelIndex * 4;
    overlay.data[idx] = r;
    overlay.data[idx + 1] = g;
    overlay.data[idx + 2] = b;
    overlay.data[idx + 3] = a;
  }

  return overlay;
}

/**
 * Create a side-by-side comparison image
 */
export function createComparison(
  before: ImageData,
  after: ImageData
): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
  const canvas = new OffscreenCanvas(before.width * 2, before.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.putImageData(before, 0, 0);
  ctx.putImageData(after, before.width, 0);

  return { canvas, ctx };
}

/**
 * Calculate image brightness statistics
 */
export function getImageStats(imageData: ImageData): {
  min: number;
  max: number;
  mean: number;
  hotPixelCount: number;
} {
  const { data, width, height } = imageData;
  const pixelCount = width * height;

  let min = 255;
  let max = 0;
  let sum = 0;
  let hotCount = 0;

  const hotThreshold = 250;

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const brightness = Math.max(data[idx]!, data[idx + 1]!, data[idx + 2]!);

    if (brightness < min) min = brightness;
    if (brightness > max) max = brightness;
    sum += brightness;

    if (brightness >= hotThreshold) hotCount++;
  }

  return {
    min,
    max,
    mean: sum / pixelCount,
    hotPixelCount: hotCount,
  };
}

/**
 * Convert ImageData to a displayable data URL
 */
export async function imageDataToDataUrl(
  imageData: ImageData,
  format: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<string> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.putImageData(imageData, 0, 0);

  const blob = await canvas.convertToBlob({ type: format, quality: 0.9 });
  return URL.createObjectURL(blob);
}

/**
 * Clean up a data URL created with imageDataToDataUrl
 */
export function revokeDataUrl(url: string): void {
  URL.revokeObjectURL(url);
}
