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

export type {
  EvalReport,
  EvalScore,
  EvaluateOptions,
} from './eval';

export type { BaselineOptions } from './baseline';

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

// Re-export evaluation harness
export { evaluate } from './eval';

// Re-export baseline runner
export { runBaselineEvaluation, printBaselineEvaluation } from './baseline';

// Re-export RNG for advanced users
export { SeededRNG } from './rng';
