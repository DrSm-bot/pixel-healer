import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { useFileSystem } from '@/hooks/useFileSystem';
import { repairAllPixels } from '@/core/repair';
import type { FileProcessingResult } from '@/types';

export function ProcessingView() {
  const {
    inputFiles,
    inputDir,
    hotPixelMap,
    outputSettings,
    progress,
    isPaused,
    setProgress,
    setStats,
    setPaused,
    setCancelled,
    setStep,
    setError,
    setOutputSettings,
  } = useAppStore();

  const { loadImageData, saveImageData, saveImageToDirectory, selectOutputDirectory } =
    useFileSystem();

  const [isProcessing, setIsProcessing] = useState(false);
  const [showOutputPicker, setShowOutputPicker] = useState(false);
  const [isOutputSameAsInput, setIsOutputSameAsInput] = useState(false);

  // Auto-show output picker on mount if not set
  useEffect(() => {
    if (!outputSettings.outputDir && !showOutputPicker) {
      setShowOutputPicker(true);
    }
  }, [outputSettings.outputDir, showOutputPicker]);

  // Compare directory handles by entry (not object identity)
  useEffect(() => {
    let cancelled = false;

    const checkIfSameDirectory = async () => {
      if (!outputSettings.outputDir || !inputDir) {
        setIsOutputSameAsInput(false);
        return;
      }

      try {
        const same = await outputSettings.outputDir.isSameEntry(inputDir);
        if (!cancelled) {
          setIsOutputSameAsInput(same);
          if (!same && outputSettings.allowOverwrite) {
            setOutputSettings({ allowOverwrite: false });
          }
        }
      } catch {
        if (!cancelled) {
          setIsOutputSameAsInput(false);
        }
      }
    };

    void checkIfSameDirectory();

    return () => {
      cancelled = true;
    };
  }, [inputDir, outputSettings.outputDir, outputSettings.allowOverwrite, setOutputSettings]);

  const handleSelectOutputDir = useCallback(async () => {
    const dir = await selectOutputDirectory();
    if (dir) {
      setOutputSettings({ outputDir: dir });
      setShowOutputPicker(false);
    }
  }, [selectOutputDirectory, setOutputSettings]);

  const handleToggleOverwrite = useCallback(() => {
    setOutputSettings({ allowOverwrite: !outputSettings.allowOverwrite });
  }, [outputSettings.allowOverwrite, setOutputSettings]);

  const getOutputFormat = useCallback(
    (fileName: string): { format: 'image/jpeg' | 'image/png'; outputFileName: string } => {
      const lower = fileName.toLowerCase();

      if (lower.endsWith('.png')) {
        return { format: 'image/png', outputFileName: fileName };
      }

      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        return { format: 'image/jpeg', outputFileName: fileName };
      }

      // Fallback: enforce extension matching actual encoding
      const baseName = fileName.replace(/\.[^.]+$/, '');
      return { format: 'image/jpeg', outputFileName: `${baseName}.jpg` };
    },
    []
  );

  const handleProcess = useCallback(async () => {
    if (!hotPixelMap || !inputDir) {
      setError({
        message: 'No hot pixel data',
        details: 'Please run analysis first.',
        recoverable: true,
      });
      return;
    }

    if (!outputSettings.outputDir) {
      setError({
        message: 'No output directory selected',
        details: 'Please select an output directory first.',
        recoverable: true,
      });
      return;
    }

    if (isOutputSameAsInput && !outputSettings.allowOverwrite) {
      setError({
        message: 'Overwrite confirmation required',
        details:
          'Output folder matches input folder. Enable overwrite mode explicitly to modify originals.',
        recoverable: true,
      });
      return;
    }

    setIsProcessing(true);
    setCancelled(false);
    setPaused(false);

    const startTime = performance.now();
    let processedCount = 0;
    const hotPixelArray = Array.from(hotPixelMap.pixels);
    const fileResults: FileProcessingResult[] = [];

    try {
      for (let i = 0; i < inputFiles.length; i++) {
        // Check for cancellation
        if (useAppStore.getState().isCancelled) {
          break;
        }

        // Wait while paused
        while (useAppStore.getState().isPaused) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (useAppStore.getState().isCancelled) break;
        }

        const file = inputFiles[i]!;
        const elapsed = performance.now() - startTime;
        const avgTimePerFrame = processedCount > 0 ? elapsed / processedCount : 0;
        const remaining = inputFiles.length - i;
        const eta = avgTimePerFrame * remaining;

        setProgress({
          step: `Processing ${file.name}...`,
          current: i + 1,
          total: inputFiles.length,
          percentage: Math.round(((i + 1) / inputFiles.length) * 100),
          eta: Math.round(eta / 1000),
        });

        try {
          // Load image
          const imageData = await loadImageData(file);

          // Repair pixels
          repairAllPixels(imageData, hotPixelArray);

          const { format, outputFileName } = getOutputFormat(file.name);

          // Save to output directory
          if (outputSettings.allowOverwrite && isOutputSameAsInput) {
            // Overwrite mode: save to original file handle
            await saveImageData(imageData, file.handle, format);
          } else if (outputSettings.outputDir) {
            // Safe mode: save to output directory with same filename/format
            await saveImageToDirectory(
              imageData,
              outputSettings.outputDir,
              outputFileName,
              format
            );
          } else {
            throw new Error('No output directory selected');
          }

          fileResults.push({
            fileName: file.name,
            success: true,
          });

          processedCount++;
        } catch (err) {
          // Log error but continue processing other files
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Failed to process ${file.name}:`, errorMessage);

          fileResults.push({
            fileName: file.name,
            success: false,
            error: errorMessage,
          });
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const failedCount = fileResults.filter((r) => !r.success).length;

      setStats({
        framesProcessed: processedCount,
        hotPixelsFixed: hotPixelArray.length,
        processingTimeMs: totalTime,
        avgFrameTimeMs: processedCount > 0 ? totalTime / processedCount : 0,
        fileResults,
        failedCount,
      });

      setProgress(null);
      setStep('complete');
    } catch (err) {
      // Only fatal errors that prevent continuation
      setError({
        message: 'Processing failed',
        details: err instanceof Error ? err.message : 'Unknown error',
        recoverable: true,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    inputFiles,
    inputDir,
    hotPixelMap,
    outputSettings,
    isOutputSameAsInput,
    loadImageData,
    saveImageData,
    saveImageToDirectory,
    getOutputFormat,
    setProgress,
    setStats,
    setPaused,
    setCancelled,
    setStep,
    setError,
  ]);

  const formatTime = (seconds: number | undefined): string => {
    if (seconds === undefined) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isOutputDirSet = !!outputSettings.outputDir;
  const isSameAsInput = isOutputSameAsInput;

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">Process Images</h2>
        <p className="text-gray-400 mb-6">
          {hotPixelMap?.pixels.size ?? 0} hot pixels will be repaired in {inputFiles.length}{' '}
          images.
        </p>

        {/* Output Directory Selection */}
        {showOutputPicker && (
          <div className="bg-cosmos-900/50 rounded-lg p-6 mb-6 border border-cosmos-600">
            <h3 className="font-semibold mb-2">Select Output Directory</h3>
            <p className="text-sm text-gray-400 mb-4">
              Choose where to save the processed images. Original files will not be modified
              unless you explicitly enable overwrite mode.
            </p>
            <button
              onClick={handleSelectOutputDir}
              className="px-6 py-3 bg-cosmos-600 hover:bg-cosmos-500 rounded-lg font-medium"
            >
              📁 Choose Output Folder
            </button>
          </div>
        )}

        {/* Output Settings Display */}
        {isOutputDirSet && (
          <div className="bg-cosmos-900/50 rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold mb-1">Output Settings</h3>
                <p className="text-sm text-gray-400">
                  Output directory: <span className="text-white">{outputSettings.outputDir?.name}</span>
                </p>
                {isSameAsInput && (
                  <p className="text-sm text-yellow-400 mt-1">
                    ⚠️ Output directory is the same as input directory
                  </p>
                )}
              </div>
              <button
                onClick={handleSelectOutputDir}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                disabled={isProcessing}
              >
                Change
              </button>
            </div>

            {/* Overwrite Warning */}
            {isSameAsInput && (
              <div className="border-t border-cosmos-700 pt-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={outputSettings.allowOverwrite}
                    onChange={handleToggleOverwrite}
                    disabled={isProcessing}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium text-white">
                      Allow overwriting input files
                    </span>
                    <p className="text-sm text-gray-400 mt-1">
                      ⚠️ <strong className="text-yellow-400">WARNING:</strong> This will
                      permanently modify your original files. Make sure you have backups!
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {progress && (
          <div className="bg-cosmos-900/50 rounded-lg p-6 mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">{progress.step}</span>
              <span className="text-sm text-gray-400">
                {progress.current} / {progress.total}
              </span>
            </div>

            <div className="h-4 bg-cosmos-800 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-cosmos-500 transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>

            <div className="flex justify-between text-sm text-gray-500">
              <span>{progress.percentage}% complete</span>
              <span>ETA: {formatTime(progress.eta)}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          {!isProcessing && (
            <button
              onClick={() => setStep('review')}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
            >
              ← Back
            </button>
          )}

          {isProcessing ? (
            <>
              <button
                onClick={() => setPaused(!isPaused)}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-medium"
              >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>

              <button
                onClick={() => setCancelled(true)}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-medium"
              >
                ✕ Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleProcess}
              disabled={!isOutputDirSet}
              className="flex-1 px-6 py-3 bg-cosmos-600 hover:bg-cosmos-500
                         disabled:bg-cosmos-800 disabled:cursor-not-allowed
                         rounded-lg font-semibold transition-colors"
            >
              {!isOutputDirSet ? '📁 Select Output Directory First' : '🔧 Fix All Images'}
            </button>
          )}
        </div>

        {/* Safety Info */}
        {!isSameAsInput && isOutputDirSet && (
          <div className="mt-8 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
            <p className="text-green-300 text-sm">
              ✓ Safe mode: Processed images will be saved to the output directory. Original
              files will not be modified.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
