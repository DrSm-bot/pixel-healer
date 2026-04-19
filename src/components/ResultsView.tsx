import { useAppStore } from '@/store/app-store';

export function ResultsView() {
  const { stats, hotPixelMap, reset } = useAppStore();

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <span className="text-6xl">✅</span>
        </div>

        <h2 className="text-3xl font-bold mb-4 text-green-400">Processing Complete!</h2>
        <p className="text-gray-400 mb-8">
          Your images have been successfully repaired.
        </p>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-cosmos-900/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-cosmos-400">
                {stats.framesProcessed}
              </div>
              <div className="text-sm text-gray-500">Frames Processed</div>
            </div>

            <div className="bg-cosmos-900/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-cosmos-400">
                {hotPixelMap?.pixels.size ?? 0}
              </div>
              <div className="text-sm text-gray-500">Hot Pixels Fixed</div>
            </div>

            <div className="bg-cosmos-900/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-cosmos-400">
                {formatTime(stats.processingTimeMs)}
              </div>
              <div className="text-sm text-gray-500">Total Time</div>
            </div>

            <div className="bg-cosmos-900/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-cosmos-400">
                {formatTime(stats.avgFrameTimeMs)}
              </div>
              <div className="text-sm text-gray-500">Per Frame</div>
            </div>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-8 py-4 bg-cosmos-600 hover:bg-cosmos-500 
                       rounded-lg font-semibold transition-colors"
          >
            📁 Process Another Folder
          </button>
        </div>

        <div className="mt-12 text-sm text-gray-500">
          <p>
            Enjoying Pixel Healer?{' '}
            <a
              href="https://github.com/DrSm-bot/pixel-healer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cosmos-400 hover:underline"
            >
              Star us on GitHub
            </a>{' '}
            ⭐
          </p>
        </div>
      </div>
    </div>
  );
}
