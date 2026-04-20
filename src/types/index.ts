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
  /** Minimum consistency across frames (0-1), default 0.9 */
  minConsistency?: number;
  /** Number of frames to sample for analysis, default 10 */
  sampleFrames?: number;
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
