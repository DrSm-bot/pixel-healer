/**
 * Pure geometry helpers for the Before/After comparison UI.
 *
 * These helpers are intentionally DOM-free so they can be unit tested in
 * a Node environment without jsdom.
 */

/**
 * Clamp a value into the inclusive range [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Convert a pointer X coordinate (relative to the viewport) into a slider
 * percentage [0, 100] given the bounding rect of the container.
 *
 * Returns 50 if the container has zero width to avoid divide-by-zero.
 */
export function pointerXToPercent(
  clientX: number,
  rect: { left: number; width: number }
): number {
  if (!rect || rect.width <= 0) return 50;
  const raw = ((clientX - rect.left) / rect.width) * 100;
  return clamp(raw, 0, 100);
}

/**
 * Keyboard handler mapping for the slider handle.
 *
 * - ArrowLeft / ArrowRight step by `step`
 * - Shift + arrow steps by `bigStep`
 * - Home / End jump to 0 / 100
 *
 * Returns the new percentage, or `null` if the key is not handled (caller
 * should not preventDefault in that case).
 */
export function nextSliderPercent(
  key: string,
  current: number,
  options: { shift?: boolean; step?: number; bigStep?: number } = {}
): number | null {
  const step = options.step ?? 1;
  const bigStep = options.bigStep ?? 10;
  const delta = options.shift ? bigStep : step;

  switch (key) {
    case 'ArrowLeft':
      return clamp(current - delta, 0, 100);
    case 'ArrowRight':
      return clamp(current + delta, 0, 100);
    case 'Home':
      return 0;
    case 'End':
      return 100;
    default:
      return null;
  }
}
