import { describe, expect, it } from 'vitest';
import { clientToImagePixel } from './manual-edit-geometry';

describe('clientToImagePixel', () => {
  it('maps the top-left corner to pixel (0, 0)', () => {
    const pixel = clientToImagePixel(
      { offsetX: 0, offsetY: 0, displayWidth: 800, displayHeight: 600 },
      { width: 1600, height: 1200 }
    );
    expect(pixel).toEqual({ x: 0, y: 0 });
  });

  it('maps the bottom-right corner to the last pixel, not one past it', () => {
    const pixel = clientToImagePixel(
      { offsetX: 800, offsetY: 600, displayWidth: 800, displayHeight: 600 },
      { width: 1600, height: 1200 }
    );
    expect(pixel).toEqual({ x: 1599, y: 1199 });
  });

  it('scales click offsets relative to the rendered size', () => {
    const pixel = clientToImagePixel(
      { offsetX: 400, offsetY: 300, displayWidth: 800, displayHeight: 600 },
      { width: 1600, height: 1200 }
    );
    expect(pixel).toEqual({ x: 800, y: 600 });
  });

  it('returns null for clicks outside the image', () => {
    expect(
      clientToImagePixel(
        { offsetX: -5, offsetY: 10, displayWidth: 100, displayHeight: 100 },
        { width: 200, height: 200 }
      )
    ).toBeNull();
    expect(
      clientToImagePixel(
        { offsetX: 110, offsetY: 10, displayWidth: 100, displayHeight: 100 },
        { width: 200, height: 200 }
      )
    ).toBeNull();
  });

  it('returns null when the rendered element has zero size', () => {
    const pixel = clientToImagePixel(
      { offsetX: 5, offsetY: 5, displayWidth: 0, displayHeight: 0 },
      { width: 200, height: 200 }
    );
    expect(pixel).toBeNull();
  });
});
