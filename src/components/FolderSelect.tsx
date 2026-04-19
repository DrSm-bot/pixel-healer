import { useFileSystem } from '@/hooks/useFileSystem';
import { useAppStore } from '@/store/app-store';

export function FolderSelect() {
  const { isSupported, isScanning, selectDirectory } = useFileSystem();
  const { inputFiles, setInputDir, setInputFiles, setStep, setError } = useAppStore();

  const handleSelectFolder = async () => {
    try {
      const result = await selectDirectory();
      if (result) {
        setInputDir(result.handle);
        setInputFiles(result.files);
        if (result.files.length > 0) {
          setStep('analyze');
        } else {
          setError({
            message: 'No supported images found',
            details: 'The folder must contain JPG, JPEG, or PNG files.',
            recoverable: true,
          });
        }
      }
    } catch (err) {
      setError({
        message: 'Failed to access folder',
        details: err instanceof Error ? err.message : 'Unknown error',
        recoverable: true,
      });
    }
  };

  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Browser Not Supported</h2>
          <p className="text-gray-300">
            Pixel Healer requires the File System Access API, which is only available in
            Chromium-based browsers (Chrome, Edge, Brave, etc.).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="max-w-lg text-center">
        <h2 className="text-3xl font-bold mb-4">
          Remove Hot Pixels from Your Time-Lapses
        </h2>
        <p className="text-gray-400 mb-8">
          Select a folder containing your image sequence. Pixel Healer will automatically
          detect and fix stuck pixels that appear in every frame.
        </p>

        <button
          onClick={handleSelectFolder}
          disabled={isScanning}
          className="px-8 py-4 bg-cosmos-600 hover:bg-cosmos-500 disabled:bg-cosmos-800 
                     disabled:cursor-not-allowed rounded-lg font-semibold text-lg 
                     transition-colors duration-200 flex items-center gap-3 mx-auto"
        >
          {isScanning ? (
            <>
              <span className="animate-spin">⟳</span>
              Scanning...
            </>
          ) : (
            <>
              📁 Select Folder
            </>
          )}
        </button>

        {inputFiles.length > 0 && (
          <p className="mt-4 text-cosmos-400">
            Found {inputFiles.length} images
          </p>
        )}

        <div className="mt-12 text-sm text-gray-500">
          <p>✓ 100% local processing — your images never leave your computer</p>
          <p>✓ Supports JPG, JPEG, PNG formats</p>
          <p>✓ Works with sequences of 500+ images</p>
        </div>
      </div>
    </div>
  );
}
