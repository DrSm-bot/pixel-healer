/**
 * Sensitivity Presets for Hot Pixel Detection
 *
 * These presets control the detection sensitivity by adjusting key parameters.
 * Users can choose from three levels in Simple Mode, or override manually in Advanced Settings.
 */

import type { DetectionOptions, SensitivityPreset } from '@/types';

/**
 * Sensitivity preset configurations
 *
 * - Low: Conservative detection, fewer false positives
 * - Normal: Balanced detection (matches optimized defaults from main)
 * - High: Aggressive detection, more sensitive, may include more detections
 */
export const SENSITIVITY_PRESETS: Record<SensitivityPreset, DetectionOptions> = {
  low: {
    threshold: 240,
    contrastEnabled: true,
    contrastMinRatio: 2.0, // More conservative: pixel must be 2x brighter than neighbors
    minConsistency: 0.95, // Higher consistency requirement: must appear in 95% of frames
    sampleFrames: 10,
    adaptiveThreshold: true,
    adaptivePercentile: 0.995,
    adaptiveMinThreshold: 220,
    adaptiveMaxThreshold: 255,
    temporalMinRunRatio: 0.9, // Longer consecutive run required
    spatialIsolationEnabled: true,
    spatialMaxHotNeighbors: 0,
    varianceFilterEnabled: true,
    varianceMaxThreshold: 80, // Lower variance tolerance
  },
  normal: {
    // These values match the optimized defaults from detection tuning
    threshold: 240,
    contrastEnabled: true,
    contrastMinRatio: 1.3, // Balanced: 30% brighter than neighbors
    minConsistency: 0.9, // Must appear in 90% of frames
    sampleFrames: 10,
    adaptiveThreshold: true,
    adaptivePercentile: 0.995,
    adaptiveMinThreshold: 200,
    adaptiveMaxThreshold: 255,
    temporalMinRunRatio: 0.875,
    spatialIsolationEnabled: true,
    spatialMaxHotNeighbors: 0,
    varianceFilterEnabled: true,
    varianceMaxThreshold: 100,
  },
  high: {
    threshold: 240,
    contrastEnabled: true,
    contrastMinRatio: 1.1, // More sensitive: only 10% brighter than neighbors
    minConsistency: 0.8, // Lower consistency: must appear in 80% of frames
    sampleFrames: 10,
    adaptiveThreshold: true,
    adaptivePercentile: 0.995,
    adaptiveMinThreshold: 180, // Lower minimum threshold
    adaptiveMaxThreshold: 255,
    temporalMinRunRatio: 0.75, // Shorter run required
    spatialIsolationEnabled: true,
    spatialMaxHotNeighbors: 0,
    varianceFilterEnabled: true,
    varianceMaxThreshold: 120, // Higher variance tolerance
  },
};

export const DEFAULT_SENSITIVITY_PRESET: SensitivityPreset = 'normal';
export const DEFAULT_DETECTION_OPTIONS: DetectionOptions = {
  ...SENSITIVITY_PRESETS[DEFAULT_SENSITIVITY_PRESET],
};

const PRESET_MATCH_KEYS = Object.keys(DEFAULT_DETECTION_OPTIONS) as Array<keyof DetectionOptions>;

/**
 * Descriptions for each sensitivity level
 */
export const SENSITIVITY_DESCRIPTIONS: Record<SensitivityPreset, string> = {
  low: 'Fewest detections, conservative, minimal false positives',
  normal: 'Balanced detection, recommended for most scenarios',
  high: 'Most detections, aggressive, may include some false positives',
};

/**
 * Apply a sensitivity preset to detection options
 */
export function applySensitivityPreset(preset: SensitivityPreset): DetectionOptions {
  return { ...SENSITIVITY_PRESETS[preset] };
}

export function withDetectionDefaults(options: DetectionOptions = {}): DetectionOptions {
  return { ...DEFAULT_DETECTION_OPTIONS, ...options };
}

/**
 * Determine if current options match a preset
 */
export function matchesPreset(
  options: DetectionOptions,
  preset: SensitivityPreset
): boolean {
  const normalizedOptions = withDetectionDefaults(options);
  const normalizedPreset = withDetectionDefaults(SENSITIVITY_PRESETS[preset]);

  // Matching semantics:
  // a preset is active only when all preset-controlled detection fields are equal.
  return PRESET_MATCH_KEYS.every((key) => normalizedOptions[key] === normalizedPreset[key]);
}

/**
 * Detect which preset is currently active (if any)
 */
export function detectActivePreset(options: DetectionOptions): SensitivityPreset | null {
  if (matchesPreset(options, 'low')) return 'low';
  if (matchesPreset(options, 'normal')) return 'normal';
  if (matchesPreset(options, 'high')) return 'high';
  return null; // Custom values
}
