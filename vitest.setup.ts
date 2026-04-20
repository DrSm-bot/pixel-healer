/**
 * Vitest setup file
 * Polyfills browser APIs for Node environment
 */

// Polyfill ImageData for Node environment
// ImageData is a browser API that's not available in Node
class ImageDataPolyfill {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;

  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      // Constructor: new ImageData(width, height)
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      // Constructor: new ImageData(data, width, height)
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = height!;

      // Validate
      if (this.data.length !== this.width * this.height * 4) {
        throw new Error('ImageData size mismatch');
      }
    }
  }
}

// Add to global scope
global.ImageData = ImageDataPolyfill as any;
