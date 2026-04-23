import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { useFileSystem } from '@/hooks/useFileSystem';
import { selectSampleFrames, analyzeFrame, detectHotPixels, extractBrightnessMap } from '@/core/detection';
import { imageDataToDataUrl, revokeDataUrl, createHotPixelOverlay } from '@/core/image-utils';
import {
  SENSITIVITY_DESCRIPTIONS,
  applySensitivityPreset,
  detectActivePreset,
} from '@/core/presets';
import type { SensitivityPreset, DetectionOptions } from '@/types';

export function AnalysisView() {
  // Use individual selectors for better re-render behavior
  const step = useAppStore((s) => s.step);
  const inputFiles = useAppStore((s) => s.inputFiles);
  const hotPixelMap = useAppStore((s) => s.hotPixelMap);
  const detectionOptions = useAppStore((s) => s.detectionOptions);
  const previewUrl = useAppStore((s) => s.previewUrl);
  const setHotPixelMap = useAppStore((s) => s.setHotPixelMap);
  const setSampleFrameData = useAppStore((s) => s.setSampleFrameData);
  const setPreviewUrl = useAppStore((s) => s.setPreviewUrl);
  const setStep = useAppStore((s) => s.setStep);
  const setError = useAppStore((s) => s.setError);
  const setProgress = useAppStore((s) => s.setProgress);
  const setDetectionOptions = useAppStore((s) => s.setDetectionOptions);

  const { loadImageData } = useFileSystem();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  // Determine if we're in review mode
  const isReviewStep = step === 'review';

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        revokeDataUrl(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSensitivityChange = useCallback(
    (preset: SensitivityPreset) => {
      const presetOptions = applySensitivityPreset(preset);
      setDetectionOptions(presetOptions);
    },
    [setDetectionOptions]
  );

  // Detect which preset (if any) matches current options
  const activePreset = detectActivePreset(detectionOptions);

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setProgress({
      step: 'Analyzing frames...',
      current: 0,
      total: detectionOptions.sampleFrames ?? 10,
      percentage: 0,
    });

    try {
      const sampleCount = Math.min(detectionOptions.sampleFrames ?? 10, inputFiles.length);

      if (sampleCount === 0) {
        throw new Error('No input files available for analysis. Please select a folder first.');
      }

      const sampleIndices = selectSampleFrames(inputFiles.length, sampleCount);

      const frameResults: Uint8Array[] = [];
      const frameBrightnessMaps: Uint8Array[] = [];
      let firstImageData: ImageData | null = null;
      let width = 0;
      let height = 0;

      for (let i = 0; i < sampleIndices.length; i++) {
        const frameIndex = sampleIndices[i]!;
        const file = inputFiles[frameIndex]!;

        setProgress({
          step: `Analyzing ${file.name}...`,
          current: i + 1,
          total: sampleCount,
          percentage: Math.round(((i + 1) / sampleCount) * 100),
        });

        const imageData = await loadImageData(file);

        if (i === 0) {
          firstImageData = imageData;
          width = imageData.width;
          height = imageData.height;
          setSampleFrameData(imageData);
        }

        const result = analyzeFrame(imageData, detectionOptions);
        frameResults.push(result);
        frameBrightnessMaps.push(extractBrightnessMap(imageData));
      }

      const hotPixelMap = detectHotPixels(
        frameResults,
        width,
        height,
        detectionOptions,
        frameBrightnessMaps
      );
      setHotPixelMap(hotPixelMap);

      // Create preview with overlay
      if (firstImageData) {
        const overlay = createHotPixelOverlay(firstImageData, hotPixelMap.pixels);
        const url = await imageDataToDataUrl(overlay);
        // Clean up old preview URL before setting new one
        const oldUrl = useAppStore.getState().previewUrl;
        if (oldUrl) revokeDataUrl(oldUrl);
        setPreviewUrl(url);
      }

      setProgress(null);
      setStep('review');
    } catch (err) {
      setError({
        message: 'Analysis failed',
        details: err instanceof Error ? err.message : 'Unknown error',
        recoverable: true,
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    inputFiles,
    detectionOptions,
    loadImageData,
    setHotPixelMap,
    setSampleFrameData,
    setPreviewUrl,
    setProgress,
    setStep,
    setError,
  ]);

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">
          {isReviewStep ? 'Review Detection' : 'Analyze Your Sequence'}
        </h2>
        <p className="text-gray-400 mb-6">
          {isReviewStep
            ? `${hotPixelMap?.pixels.size ?? 0} hot pixels detected. Review and continue to processing.`
            : `${inputFiles.length} images found. Configure detection settings and click analyze.`}
        </p>

        {!isReviewStep && (
          <div className="bg-cosmos-900/50 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Detection Sensitivity</h3>
              {!activePreset && (
                <span className="text-xs px-2 py-1 bg-cosmos-700 text-cosmos-300 rounded">
                  Custom
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Choose how aggressively to detect hot pixels. Start with Normal and adjust if needed.
            </p>

            <div className="grid grid-cols-1 gap-3">
              {(['low', 'normal', 'high'] as const).map((preset) => {
                const isActive = activePreset === preset;
                return (
                  <label
                    key={preset}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      isActive
                        ? 'border-cosmos-500 bg-cosmos-800/30'
                        : 'border-cosmos-700 hover:border-cosmos-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sensitivity"
                      value={preset}
                      checked={isActive}
                      onChange={() => handleSensitivityChange(preset)}
                      className="mt-1"
                      disabled={isAnalyzing}
                    />
                    <div className="flex-1">
                      <div className="font-medium capitalize">{preset}</div>
                      <div className="text-sm text-gray-400">
                        {SENSITIVITY_DESCRIPTIONS[preset]}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <button
              onClick={() => setAdvancedExpanded(!advancedExpanded)}
              className="mt-6 text-sm text-cosmos-400 hover:text-cosmos-300 flex items-center gap-2"
            >
              <span>{advancedExpanded ? '▼' : '▶'}</span>
              <span>Advanced Settings</span>
            </button>

            {advancedExpanded && (
              <div className="mt-4 pt-4 border-t border-cosmos-700">
                <AdvancedSettings
                  detectionOptions={detectionOptions}
                  setDetectionOptions={setDetectionOptions}
                  isAnalyzing={isAnalyzing}
                />
              </div>
            )}
          </div>
        )}

        {isReviewStep && hotPixelMap && (
          <div className="bg-cosmos-900/50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold mb-4">Processing Summary</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-400">Total Images</p>
                <p className="text-3xl font-bold text-white">{inputFiles.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Hot Pixels Detected</p>
                <p className="text-3xl font-bold text-cosmos-400">{hotPixelMap.pixels.size}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-cosmos-700">
              <p className="text-sm text-gray-400">
                These {hotPixelMap.pixels.size} hot pixels will be repaired across all{' '}
                {inputFiles.length} images in the next step.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          {isReviewStep ? (
            <>
              <button
                onClick={() => setStep('analyze')}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
              >
                ← Back to Analyze
              </button>

              <button
                onClick={() => setStep('process')}
                className="flex-1 px-6 py-3 bg-cosmos-600 hover:bg-cosmos-500 rounded-lg font-semibold transition-colors"
              >
                ➡ Continue to Process
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('select')}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
                disabled={isAnalyzing}
              >
                ← Back
              </button>

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="flex-1 px-6 py-3 bg-cosmos-600 hover:bg-cosmos-500
                           disabled:bg-cosmos-800 disabled:cursor-not-allowed
                           rounded-lg font-semibold transition-colors"
              >
                {isAnalyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden="true"
                    />
                    Analyzing...
                  </span>
                ) : (
                  '🔍 Analyze Sequence'
                )}
              </button>
            </>
          )}
        </div>

        {previewUrl && (
          <div className="mt-8">
            <h3 className="font-semibold mb-2">Preview</h3>
            <img
              src={previewUrl}
              alt="Analysis preview"
              className="max-w-full rounded-lg border border-cosmos-700"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Advanced Settings Component (shared between Simple collapsed and Advanced mode)
function AdvancedSettings({
  detectionOptions,
  setDetectionOptions,
  isAnalyzing,
}: {
  detectionOptions: DetectionOptions;
  setDetectionOptions: (options: Partial<DetectionOptions>) => void;
  isAnalyzing: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Brightness Threshold: {detectionOptions.threshold}
        </label>
        <input
          type="range"
          min="200"
          max="255"
          value={detectionOptions.threshold}
          onChange={(e) => setDetectionOptions({ threshold: parseInt(e.target.value) })}
          className="w-full"
          disabled={isAnalyzing}
        />
        <p className="text-xs text-gray-500 mt-1">
          Absolute brightness level (0-255)
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Sample Frames: {detectionOptions.sampleFrames}
        </label>
        <input
          type="range"
          min="5"
          max="20"
          value={detectionOptions.sampleFrames}
          onChange={(e) => setDetectionOptions({ sampleFrames: parseInt(e.target.value) })}
          className="w-full"
          disabled={isAnalyzing}
        />
        <p className="text-xs text-gray-500 mt-1">
          More frames = better accuracy, slower analysis
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Contrast Min Ratio: {detectionOptions.contrastMinRatio?.toFixed(1)}
        </label>
        <input
          type="range"
          min="1.0"
          max="3.0"
          step="0.1"
          value={detectionOptions.contrastMinRatio ?? 1.3}
          onChange={(e) => setDetectionOptions({ contrastMinRatio: parseFloat(e.target.value) })}
          className="w-full"
          disabled={isAnalyzing}
        />
        <p className="text-xs text-gray-500 mt-1">
          How much brighter than neighbors
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Min Consistency: {(detectionOptions.minConsistency ?? 0.9) * 100}%
        </label>
        <input
          type="range"
          min="0.5"
          max="1.0"
          step="0.05"
          value={detectionOptions.minConsistency ?? 0.9}
          onChange={(e) => setDetectionOptions({ minConsistency: parseFloat(e.target.value) })}
          className="w-full"
          disabled={isAnalyzing}
        />
        <p className="text-xs text-gray-500 mt-1">
          % of frames where pixel must be hot
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Temporal Min Run Ratio: {(detectionOptions.temporalMinRunRatio ?? 0.875) * 100}%
        </label>
        <input
          type="range"
          min="0.5"
          max="1.0"
          step="0.05"
          value={detectionOptions.temporalMinRunRatio ?? 0.875}
          onChange={(e) =>
            setDetectionOptions({ temporalMinRunRatio: parseFloat(e.target.value) })
          }
          className="w-full"
          disabled={isAnalyzing}
        />
        <p className="text-xs text-gray-500 mt-1">
          Consecutive-frame persistence requirement
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Variance Max Threshold: {detectionOptions.varianceMaxThreshold}
        </label>
        <input
          type="range"
          min="50"
          max="200"
          step="10"
          value={detectionOptions.varianceMaxThreshold ?? 100}
          onChange={(e) =>
            setDetectionOptions({ varianceMaxThreshold: parseInt(e.target.value) })
          }
          className="w-full"
          disabled={isAnalyzing}
        />
        <p className="text-xs text-gray-500 mt-1">
          Max brightness variance for hot pixels
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={detectionOptions.adaptiveThreshold ?? true}
            onChange={(e) => setDetectionOptions({ adaptiveThreshold: e.target.checked })}
            disabled={isAnalyzing}
          />
          <span>Adaptive Threshold</span>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          Per-frame percentile-based threshold
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={detectionOptions.contrastEnabled ?? true}
            onChange={(e) => setDetectionOptions({ contrastEnabled: e.target.checked })}
            disabled={isAnalyzing}
          />
          <span>Contrast Detection</span>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          Local 8-neighbor contrast check
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={detectionOptions.spatialIsolationEnabled ?? true}
            onChange={(e) => setDetectionOptions({ spatialIsolationEnabled: e.target.checked })}
            disabled={isAnalyzing}
          />
          <span>Spatial Isolation Filter</span>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          Filter clustered detections
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={detectionOptions.varianceFilterEnabled ?? true}
            onChange={(e) => setDetectionOptions({ varianceFilterEnabled: e.target.checked })}
            disabled={isAnalyzing}
          />
          <span>Variance Filter</span>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          Temporal brightness variance check
        </p>
      </div>
    </div>
  );
}
