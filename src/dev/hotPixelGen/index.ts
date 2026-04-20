/**
 * Synthetic Hot Pixel Generator
 *
 * Dev-only module for generating realistic, reproducible hot pixel corruptions
 * for testing and benchmarking detection/healing algorithms.
 *
 * @module hotPixelGen
 */

// Re-export types
export type {
  SyntheticHotPixel,
  HotPixelMask,
  GeneratorConfig,
} from '../../types';

// Re-export core API
export {
  applyMask,
  corruptSequence,
  serializeMask,
  deserializeMask,
  profiles,
} from './generator';

// Re-export mask generation
export { generateMask } from './mask';

// Re-export RNG for advanced users
export { SeededRNG } from './rng';
