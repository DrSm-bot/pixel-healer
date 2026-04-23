import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DETECTION_OPTIONS,
  SENSITIVITY_PRESETS,
  applySensitivityPreset,
  detectActivePreset,
  matchesPreset,
  withDetectionDefaults,
} from './presets';

describe('detection defaults', () => {
  it('uses the normal sensitivity preset as the default source of truth', () => {
    expect(DEFAULT_DETECTION_OPTIONS).toEqual(SENSITIVITY_PRESETS.normal);
    expect(withDetectionDefaults({})).toEqual(DEFAULT_DETECTION_OPTIONS);
  });

  it('returns a copy when applying a preset', () => {
    const preset = applySensitivityPreset('normal');
    preset.threshold = 1;

    expect(SENSITIVITY_PRESETS.normal.threshold).toBe(240);
  });
});

describe('preset matching semantics', () => {
  it('matches a preset only when all preset-controlled fields match after normalization', () => {
    const options = { ...applySensitivityPreset('normal'), adaptiveMinThreshold: 201 };

    expect(matchesPreset(options, 'normal')).toBe(false);
    expect(detectActivePreset(options)).toBeNull();
  });

  it('detects presets from fully matching option sets', () => {
    const low = applySensitivityPreset('low');
    const normal = applySensitivityPreset('normal');
    const high = applySensitivityPreset('high');

    expect(detectActivePreset(low)).toBe('low');
    expect(detectActivePreset(normal)).toBe('normal');
    expect(detectActivePreset(high)).toBe('high');
  });
});
