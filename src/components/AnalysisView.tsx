import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { useFileSystem } from '@/hooks/useFileSystem';
import { selectSampleFrames, analyzeFrame, detectHotPixels } from '@/core/detection';
import { imageDataToDataUrl, revokeDataUrl, createHotPixelOverlay } from '@/core/image-utils';

export function AnalysisView() {
  const {
    inputFiles,
    detectionOptions,
    setHotPixelMap,
    setSampleFrameData,
    setStep,
    setError,
    setProgress,
  } = useAppStore();

  const { loadImageData } = useFileSystem();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        revokeDataUrl(previewUrl);
      }
    };
  }, [previewUrl]);

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

        const result = analyzeFrame(imageData, detectionOptions.threshold ?? 240);
        frameResults.push(result);
      }

      const hotPixelMap = detectHotPixels(frameResults, width, height, detectionOptions);
      setHotPixelMap(hotPixelMap);

      // Create preview with overlay
      if (firstImageData) {
        const overlay = createHotPixelOverlay(firstImageData, hotPixelMap.pixels);
        const url = await imageDataToDataUrl(overlay);
        setPreviewUrl((prev) => {
          if (prev) revokeDataUrl(prev);
          return url;
        });
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
    setProgress,
    setStep,
    setError,
  ]);

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">Analyze Your Sequence</h2>
        <p className="text-gray-400 mb-6">
          {inputFiles.length} images found. Click analyze to detect hot pixels.
        </p>

        <div className="bg-cosmos-900/50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold mb-4">Detection Settings</h3>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Brightness Threshold: {detectionOptions.threshold}
              </label>
              <input
                type="range"
                min="200"
                max="255"
                value={detectionOptions.threshold}
                onChange={(e) =>
                  useAppStore.getState().setDetectionOptions({
                    threshold: parseInt(e.target.value),
                  })
                }
                className="w-full"
                disabled={isAnalyzing}
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher = fewer false positives, lower = more sensitive
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
                onChange={(e) =>
                  useAppStore.getState().setDetectionOptions({
                    sampleFrames: parseInt(e.target.value),
                  })
                }
                className="w-full"
                disabled={isAnalyzing}
              />
              <p className="text-xs text-gray-500 mt-1">
                More frames = better accuracy, slower analysis
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
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
                <span className="animate-spin">⟳</span>
                Analyzing...
              </span>
            ) : (
              '🔍 Analyze Sequence'
            )}
          </button>
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
