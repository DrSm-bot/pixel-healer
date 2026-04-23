import type { ChangeEvent, ReactNode } from 'react';
import type { DetectionOptions } from '@/types';

interface AdvancedSettingsProps {
  detectionOptions: DetectionOptions;
  setDetectionOptions: (options: Partial<DetectionOptions>) => void;
  isAnalyzing: boolean;
}

interface RangeSettingProps {
  label: string;
  valueLabel: ReactNode;
  value: number | undefined;
  min: string;
  max: string;
  step?: string;
  helperText: string;
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function RangeSetting({
  label,
  valueLabel,
  value,
  min,
  max,
  step,
  helperText,
  disabled,
  onChange,
}: RangeSettingProps) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">
        {label}: {valueLabel}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full"
        disabled={disabled}
      />
      <p className="text-xs text-gray-500 mt-1">{helperText}</p>
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  checked: boolean;
  helperText: string;
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function ToggleSetting({ label, checked, helperText, disabled, onChange }: ToggleSettingProps) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-gray-400">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
        <span>{label}</span>
      </label>
      <p className="text-xs text-gray-500 mt-1">{helperText}</p>
    </div>
  );
}

export function AdvancedSettings({
  detectionOptions,
  setDetectionOptions,
  isAnalyzing,
}: AdvancedSettingsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <RangeSetting
        label="Brightness Threshold"
        valueLabel={detectionOptions.threshold}
        value={detectionOptions.threshold}
        min="200"
        max="255"
        helperText="Absolute brightness level (0-255)"
        disabled={isAnalyzing}
        onChange={(e) => setDetectionOptions({ threshold: parseInt(e.target.value, 10) })}
      />

      <RangeSetting
        label="Sample Frames"
        valueLabel={detectionOptions.sampleFrames}
        value={detectionOptions.sampleFrames}
        min="5"
        max="20"
        helperText="More frames = better accuracy, slower analysis"
        disabled={isAnalyzing}
        onChange={(e) => setDetectionOptions({ sampleFrames: parseInt(e.target.value, 10) })}
      />

      <RangeSetting
        label="Contrast Min Ratio"
        valueLabel={detectionOptions.contrastMinRatio?.toFixed(1)}
        value={detectionOptions.contrastMinRatio ?? 1.3}
        min="1.0"
        max="3.0"
        step="0.1"
        helperText="How much brighter than neighbors"
        disabled={isAnalyzing}
        onChange={(e) => setDetectionOptions({ contrastMinRatio: parseFloat(e.target.value) })}
      />

      <RangeSetting
        label="Min Consistency"
        valueLabel={`${(detectionOptions.minConsistency ?? 0.9) * 100}%`}
        value={detectionOptions.minConsistency ?? 0.9}
        min="0.5"
        max="1.0"
        step="0.05"
        helperText="% of frames where pixel must be hot"
        disabled={isAnalyzing}
        onChange={(e) => setDetectionOptions({ minConsistency: parseFloat(e.target.value) })}
      />

      <RangeSetting
        label="Temporal Min Run Ratio"
        valueLabel={`${(detectionOptions.temporalMinRunRatio ?? 0.875) * 100}%`}
        value={detectionOptions.temporalMinRunRatio ?? 0.875}
        min="0.5"
        max="1.0"
        step="0.05"
        helperText="Consecutive-frame persistence requirement"
        disabled={isAnalyzing}
        onChange={(e) => setDetectionOptions({ temporalMinRunRatio: parseFloat(e.target.value) })}
      />

      <RangeSetting
        label="Variance Max Threshold"
        valueLabel={detectionOptions.varianceMaxThreshold}
        value={detectionOptions.varianceMaxThreshold ?? 100}
        min="50"
        max="200"
        step="10"
        helperText="Max brightness variance for hot pixels"
        disabled={isAnalyzing}
        onChange={(e) => setDetectionOptions({ varianceMaxThreshold: parseInt(e.target.value, 10) })}
      />

      <ToggleSetting
        label="Adaptive Threshold"
        checked={detectionOptions.adaptiveThreshold ?? true}
        helperText="Per-frame percentile-based threshold"
        disabled={isAnalyzing}
        onChange={(e) => setDetectionOptions({ adaptiveThreshold: e.target.checked })}
      />

      <ToggleSetting
        label="Contrast Detection"
        checked={detectionOptions.contrastEnabled ?? true}
        helperText="Local 8-neighbor contrast check"
        disabled={isAnalyzing}
        onChange={(e) => setDetectionOptions({ contrastEnabled: e.target.checked })}
      />

      <ToggleSetting
        label="Spatial Isolation Filter"
        checked={detectionOptions.spatialIsolationEnabled ?? true}
        helperText="Filter clustered detections"
        disabled={isAnalyzing}
        onChange={(e) => setDetectionOptions({ spatialIsolationEnabled: e.target.checked })}
      />

      <ToggleSetting
        label="Variance Filter"
        checked={detectionOptions.varianceFilterEnabled ?? true}
        helperText="Temporal brightness variance check"
        disabled={isAnalyzing}
        onChange={(e) => setDetectionOptions({ varianceFilterEnabled: e.target.checked })}
      />
    </div>
  );
}
