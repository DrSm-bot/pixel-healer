import { useState, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { useFileSystem } from '@/hooks/useFileSystem';
import { repairAllPixels } from '@/core/repair';

export function ProcessingView() {
  const {
    inputFiles,
    inputDir,
    hotPixelMap,
    progress,
    isPaused,
    setProgress,
    setStats,
    setPaused,
    setCancelled,
    setStep,
    setError,
  } = useAppStore();

  const { loadImageData, saveImageData } = useFileSystem();

  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcess = useCallback(async () => {
    if (!hotPixelMap || !inputDir) {
      setError({
        message: 'No hot pixel data',
        details: 'Please run analysis first.',
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

        // Load, repair, save
        const imageData = await loadImageData(file);
        repairAllPixels(imageData, hotPixelArray);
        await saveImageData(imageData, file.handle);

        processedCount++;
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      setStats({
        framesProcessed: processedCount,
        hotPixelsFixed: hotPixelArray.length,
        processingTimeMs: totalTime,
        avgFrameTimeMs: totalTime / processedCount,
      });

      setProgress(null);
      setStep('complete');
    } catch (err) {
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
    loadImageData,
    saveImageData,
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

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">Process Images</h2>
        <p className="text-gray-400 mb-6">
          {hotPixelMap?.pixels.size ?? 0} hot pixels will be repaired in{' '}
          {inputFiles.length} images.
        </p>

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
              className="flex-1 px-6 py-3 bg-cosmos-600 hover:bg-cosmos-500 
                         rounded-lg font-semibold transition-colors"
            >
              🔧 Fix All Images
            </button>
          )}
        </div>

        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-300 text-sm">
            ⚠️ Images will be modified in place. Make sure you have backups if needed.
          </p>
        </div>
      </div>
    </div>
  );
}
