/**
 * Core types for Pixel Healer
 */

// ============================================================================
// File System Types
// ============================================================================

/**
 * Supported image file extensions
 */
export type SupportedExtension = '.jpg' | '.jpeg' | '.png';

/**
 * Represents a single image file in the sequence
 */
export interface ImageFile {
  /** File name without path */
  name: string;
  /** File handle for reading/writing */
  handle: FileSystemFileHandle;
  /** File size in bytes */
  size: number;
  /** Whether this file has been processed */
  processed: boolean;
}

// ============================================================================
// Detection Types
// ============================================================================

/**
 * A single hot pixel location
 */
export interface HotPixel {
  /** X coordinate (0-indexed) */
  x: number;
  /** Y coordinate (0-indexed) */
  y: number;
  /** Linear index in image data (y * width + x) */
  index: number;
  /** Average brightness across sampled frames (0-255) */
  avgBrightness: number;
  /** How consistently this pixel is hot (0-1) */
  consistency: number;
}

/**
 * Result of hot pixel detection analysis
 */
export interface HotPixelMap {
  /** Set of linear pixel indices that are hot */
  pixels: Set<number>;
  /** Detailed info for each hot pixel */
  details: HotPixel[];
  /** Brightness threshold used for detection */
  threshold: number;
  /** Minimum consistency required (0-1) */
  minConsistency: number;
  /** Image dimensions */
  width: number;
  height: number;
  /** Number of frames analyzed */
  framesAnalyzed: number;
}

/**
 * Options for hot pixel detection
 */
export interface DetectionOptions {
  /** Brightness threshold (0-255), default 240 */
  threshold?: number;
  /** Enable local 8-neighbor contrast analysis (default true) */
  contrastEnabled?: boolean;
  /** Minimum brightness-to-neighborhood ratio for contrast detection (default 1.5) */
  contrastMinRatio?: number;
  /** Minimum consistency across frames (0-1), default 0.9 */
  minConsistency?: number;
  /** Number of frames to sample for analysis, default 10 */
  sampleFrames?: number;
  /** Enable per-frame adaptive thresholding (default false) */
  adaptiveThreshold?: boolean;
  /** Brightness percentile used for adaptive thresholding (0-1, default 0.999) */
  adaptivePercentile?: number;
  /** Lower clamp for adaptive threshold (0-255, default 220) */
  adaptiveMinThreshold?: number;
  /** Upper clamp for adaptive threshold (0-255, default 255) */
  adaptiveMaxThreshold?: number;
  /** Minimum consecutive-hot run ratio required across sampled frames (0-1, default 0 = disabled) */
  temporalMinRunRatio?: number;
  /** Enable spatial isolation filtering after temporal/consistency checks (default false) */
  spatialIsolationEnabled?: boolean;
  /** Maximum number of hot neighbors (8-neighborhood) allowed for a hot pixel (default 8) */
  spatialMaxHotNeighbors?: number;
}

/**
 * Output processing settings
 */
export interface OutputSettings {
  /** Output directory handle (null means use input directory) */
  outputDir: FileSystemDirectoryHandle | null;
  /** Whether to overwrite input files (only if outputDir matches inputDir) */
  allowOverwrite: boolean;
}

// ============================================================================
// Processing Types
// ============================================================================

/**
 * Current processing status
 */
export type ProcessingStatus =
  | 'idle'
  | 'scanning'
  | 'analyzing'
  | 'reviewing'
  | 'processing'
  | 'complete'
  | 'error';

/**
 * Progress update during processing
 */
export interface ProcessingProgress {
  /** Current step description */
  step: string;
  /** Current item being processed */
  current: number;
  /** Total items to process */
  total: number;
  /** Percentage complete (0-100) */
  percentage: number;
  /** Estimated time remaining in seconds */
  eta?: number;
}

/**
 * Result for a single file processing attempt
 */
export interface FileProcessingResult {
  /** File name */
  fileName: string;
  /** Whether processing succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Final processing statistics
 */
export interface ProcessingStats {
  /** Total frames processed */
  framesProcessed: number;
  /** Total hot pixels fixed per frame */
  hotPixelsFixed: number;
  /** Total processing time in milliseconds */
  processingTimeMs: number;
  /** Average time per frame in milliseconds */
  avgFrameTimeMs: number;
  /** Per-file results */
  fileResults: FileProcessingResult[];
  /** Number of failed files */
  failedCount: number;
}

// ============================================================================
// App State Types
// ============================================================================

/**
 * Current step in the workflow
 */
export type AppStep = 'select' | 'analyze' | 'review' | 'process' | 'complete';

/**
 * Error state
 */
export interface AppError {
  /** Error message for display */
  message: string;
  /** Technical details */
  details?: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
}

// ============================================================================
// Web Worker Message Types
// ============================================================================

/**
 * Message to analyzer worker
 */
export interface AnalyzerWorkerInput {
  type: 'analyze';
  imageData: ImageData;
  frameIndex: number;
  options: DetectionOptions;
}

/**
 * Response from analyzer worker
 */
export interface AnalyzerWorkerOutput {
  type: 'frame-result' | 'complete' | 'error';
  frameIndex?: number;
  hotPixelCounts?: Uint16Array;
  error?: string;
}

/**
 * Message to fixer worker
 */
export interface FixerWorkerInput {
  type: 'fix';
  imageData: ImageData;
  hotPixels: number[];
}

/**
 * Response from fixer worker
 */
export interface FixerWorkerOutput {
  type: 'fixed' | 'error';
  imageData?: ImageData;
  error?: string;
}

// ============================================================================
// File System Access API Type Extensions
// ============================================================================

/**
 * Options for showDirectoryPicker
 */
export interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

/**
 * Extended window interface for File System Access API
 */
declare global {
  interface Window {
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }
}

// ============================================================================
// Synthetic Hot Pixel Generator Types (Dev Only)
// ============================================================================

/**
 * Synthetic hot pixel for testing/evaluation
 */
export interface SyntheticHotPixel {
  /** X coordinate (0-indexed) */
  x: number;
  /** Y coordinate (0-indexed) */
  y: number;
  /** Affected channel(s) */
  channel: 'r' | 'g' | 'b' | 'rgb';
  /** Pixel behavior class */
  type: 'stuck' | 'warm' | 'flicker';
  /** Intensity value (stuck: absolute 0-255, warm: additive offset) */
  intensity: number;
  /** Corrupt only when underlying value is below this threshold */
  activationThreshold: number;
  /** Per-frame manifestation probability for flicker pixels (0-1) */
  flickerProbability: number;
}

/**
 * Hot pixel mask with ground truth for evaluation
 */
export interface HotPixelMask {
  /** Schema version for future compatibility */
  schemaVersion: 1;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** List of synthetic hot pixels */
  pixels: SyntheticHotPixel[];
  /** Random seed used for generation */
  seed: number;
  /** ISO timestamp of when mask was generated */
  generatedAt: string;
  /** Optional profile name used for generation */
  profileName?: string;
}

/**
 * Configuration for synthetic hot pixel mask generation
 */
export interface GeneratorConfig {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Random seed for deterministic generation */
  seed: number;
  /** Hot pixels per megapixel (default: 150) */
  density: number;
  /** Distribution of pixel types (must sum to 1.0) */
  typeMix?: { stuck: number; warm: number; flicker: number };
  /** Distribution of affected channels (must sum to 1.0) */
  channelMix?: { r: number; g: number; b: number; rgb: number };
  /** Mean intensity for warm pixels (default: 40) */
  warmIntensityMean?: number;
  /** Probability that stuck pixels have intensity=255 (default: 0.8) */
  stuckIntensityMax255Prob?: number;
  /** Range of flicker probabilities [min, max] (default: [0.3, 0.9]) */
  flickerProbabilityRange?: [number, number];
}
