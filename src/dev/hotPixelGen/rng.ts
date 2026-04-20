/**
 * Seeded PRNG for deterministic hot pixel generation
 * Uses mulberry32 algorithm for deterministic, fast pseudo-random numbers
 */

/**
 * Mulberry32 PRNG - 32-bit state, good quality, very fast
 * https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    // Ensure seed is a 32-bit unsigned integer
    this.state = seed >>> 0;
  }

  /**
   * Generate next random number in range [0, 1)
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer in range [min, max] inclusive
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate random float in range [min, max)
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Generate random value from exponential distribution
   * Used for realistic long-tail intensity distributions
   */
  nextExponential(lambda: number): number {
    return -Math.log(1 - this.next()) / lambda;
  }

  /**
   * Select random element from array
   */
  choice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    const selected = array[this.nextInt(0, array.length - 1)];
    if (selected === undefined) {
      throw new Error('Array index out of bounds');
    }
    return selected;
  }

  /**
   * Generate deterministic hash for flicker decision
   * Uses simple hash combining seed, pixel index, and frame index
   */
  static hash(seed: number, pixelIndex: number, frameIndex: number): number {
    let h = seed;
    h = Math.imul(h ^ pixelIndex, 0x85ebca6b);
    h = Math.imul(h ^ frameIndex, 0xc2b2ae35);
    h = h ^ (h >>> 13);
    h = Math.imul(h, 0x27d4eb2d);
    h = h ^ (h >>> 15);
    return ((h >>> 0) / 4294967296);
  }
}
