import { useCallback, useEffect, useMemo, useState } from 'react';
import { analyzeFrame, detectHotPixels, extractBrightnessMap } from '@/core/detection';
import { cloneImageData, repairAllPixels } from '@/core/repair';
import { useAppStore } from '@/store/app-store';
import type { EvalReport } from '@/dev/hotPixelGen';
import type { GeneratorConfig, HotPixelMask } from '@/types';
import { corruptSequence, evaluate, profiles } from '@/dev/hotPixelGen';

type ProfileName = keyof typeof profiles;
type PreviewMode = 'clean' | 'corrupted' | 'healed';

interface GeneratedSequence {
  clean: ImageData[];
  corrupted: ImageData[];
  mask: HotPixelMask;
}

interface EvalState {
  report: EvalReport;
  healed: ImageData[];
  detected: Set<string>;
}

const FRAME_COUNT = 8;

export function DevPanel() {
  const sampleFrameData = useAppStore((state) => state.sampleFrameData);
  const detectionOptions = useAppStore((state) => state.detectionOptions);
  const [isOpen, setIsOpen] = useState(() => hasDevQueryParam());
  const [profile, setProfile] = useState<ProfileName>('typical');
  const [seed, setSeed] = useState('1337');
  const [sequence, setSequence] = useState<GeneratedSequence | null>(null);
  const [evalState, setEvalState] = useState<EvalState | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('corrupted');
  const [previewFrameIndex, setPreviewFrameIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setIsOpen((value) => !value);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedFrames = useMemo(() => {
    if (!sequence) return [];
    if (previewMode === 'clean') return sequence.clean;
    if (previewMode === 'corrupted') return sequence.corrupted;
    return evalState?.healed ?? [];
  }, [evalState?.healed, previewMode, sequence]);

  useEffect(() => {
    const frame = selectedFrames[previewFrameIndex] ?? selectedFrames[0];
    if (!frame) {
      setPreviewUrl(null);
      return;
    }

    const url = imageDataToObjectUrl(frame);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFrameIndex, selectedFrames]);

  const diff = useMemo(() => {
    const clean = sequence?.clean[previewFrameIndex] ?? sequence?.clean[0];
    const current = selectedFrames[previewFrameIndex] ?? selectedFrames[0];
    if (!clean || !current) return null;
    return calculateDiff(clean, current);
  }, [previewFrameIndex, selectedFrames, sequence?.clean]);

  const generate = useCallback(() => {
    setError(null);
    setEvalState(null);

    if (!sampleFrameData) {
      setError('Analyze a folder first so the app has a clean frame in memory.');
      return;
    }

    const parsedSeed = Number(seed);
    if (!Number.isInteger(parsedSeed)) {
      setError('Seed must be an integer.');
      return;
    }

    try {
      const clean = createSequenceFromFrame(sampleFrameData, FRAME_COUNT, parsedSeed);
      const profileConfig = profiles[profile];
      const config: GeneratorConfig = {
        width: sampleFrameData.width,
        height: sampleFrameData.height,
        seed: parsedSeed,
        density: profileConfig.density ?? 150,
        ...profileConfig,
      };
      const result = corruptSequence(clean, config);
      setSequence({ clean, corrupted: result.corrupted, mask: result.mask });
      setPreviewFrameIndex(0);
      setPreviewMode('corrupted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate synthetic sequence.');
    }
  }, [profile, sampleFrameData, seed]);

  const runEvaluation = useCallback(async () => {
    if (!sequence) {
      setError('Generate a corrupted sequence first.');
      return;
    }

    setError(null);
    setIsEvaluating(true);

    try {
      let capturedDetected = new Set<string>();
      let capturedHealed: ImageData[] = [];
      const report = await evaluate({
        cleanFrames: sequence.clean,
        mask: sequence.mask,
        detect: async (frames) => {
          const frameResults = frames.map((frame) => analyzeFrame(frame, detectionOptions));
          const frameBrightnessMaps = frames.map((frame) => extractBrightnessMap(frame));
          const detected = detectHotPixels(
            frameResults,
            sequence.mask.width,
            sequence.mask.height,
            {
              ...detectionOptions,
              sampleFrames: frames.length,
            },
            frameBrightnessMaps
          );
          capturedDetected = new Set(
            Array.from(detected.pixels).map((pixelIndex) =>
              coordinateKey(pixelIndex % sequence.mask.width, Math.floor(pixelIndex / sequence.mask.width))
            )
          );
          return capturedDetected;
        },
        heal: async (frames, detected) => {
          capturedHealed = frames.map((frame) => {
            const healed = cloneImageData(frame);
            repairAllPixels(healed, coordinatesToPixelIndices(detected, frame.width));
            return healed;
          });
          return capturedHealed;
        },
      });

      setEvalState({
        report,
        healed: capturedHealed,
        detected: capturedDetected,
      });
      setPreviewMode('healed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed.');
    } finally {
      setIsEvaluating(false);
    }
  }, [detectionOptions, sequence]);

  if (!isOpen) {
    return null;
  }

  const report = evalState?.report;

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[min(520px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-auto rounded-lg border border-cosmos-600 bg-cosmos-950 p-4 text-sm shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Synthetic Harness</h2>
          <p className="text-xs text-gray-400">Dev only. Open with ?dev=1 or Ctrl+Shift+D.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded bg-cosmos-800 px-2 py-1 text-gray-300 hover:bg-cosmos-700"
        >
          Close
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-gray-400">Profile</span>
          <select
            value={profile}
            onChange={(event) => setProfile(event.target.value as ProfileName)}
            className="w-full rounded border border-cosmos-700 bg-cosmos-900 px-2 py-2 text-white"
          >
            {Object.keys(profiles).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-gray-400">Seed</span>
          <input
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            className="w-full rounded border border-cosmos-700 bg-cosmos-900 px-2 py-2 text-white"
            inputMode="numeric"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generate}
          className="rounded bg-cosmos-600 px-3 py-2 font-medium text-white hover:bg-cosmos-500"
        >
          Generate Corrupted Sequence
        </button>
        <button
          type="button"
          onClick={() => void runEvaluation()}
          disabled={!sequence || isEvaluating}
          className="rounded bg-green-700 px-3 py-2 font-medium text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-700"
        >
          {isEvaluating ? 'Running...' : 'Run Evaluation'}
        </button>
      </div>

      {!sampleFrameData && (
        <p className="mt-3 rounded border border-yellow-700 bg-yellow-950/40 p-2 text-xs text-yellow-200">
          No clean frame is in memory yet. Select a folder and run analysis first.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded border border-red-700 bg-red-950/40 p-2 text-xs text-red-200">
          {error}
        </p>
      )}

      {sequence && (
        <div className="mt-4 border-t border-cosmos-800 pt-4">
          <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
            <Metric label="Truth pixels" value={sequence.mask.pixels.length} />
            <Metric label="Detected" value={evalState?.detected.size ?? '-'} />
            <Metric label="Frames" value={sequence.clean.length} />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {(['clean', 'corrupted', 'healed'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPreviewMode(mode)}
                disabled={mode === 'healed' && !evalState}
                className={`rounded px-3 py-1 text-xs ${
                  previewMode === mode
                    ? 'bg-cosmos-500 text-white'
                    : 'bg-cosmos-800 text-gray-300 hover:bg-cosmos-700'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {mode}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-xs text-gray-400">
              Frame
              <input
                type="number"
                min="0"
                max={sequence.clean.length - 1}
                value={previewFrameIndex}
                onChange={(event) =>
                  setPreviewFrameIndex(clamp(Number(event.target.value), 0, sequence.clean.length - 1))
                }
                className="w-16 rounded border border-cosmos-700 bg-cosmos-900 px-2 py-1 text-white"
              />
            </label>
          </div>

          {previewUrl && (
            <img
              src={previewUrl}
              alt={`${previewMode} synthetic frame preview`}
              className="max-h-64 w-full rounded border border-cosmos-700 object-contain"
            />
          )}

          {diff && (
            <p className="mt-2 text-xs text-gray-400">
              Diff vs clean: {diff.changedPixels} pixels changed, mean channel delta{' '}
              {formatMetric(diff.meanChannelDelta)}
            </p>
          )}
        </div>
      )}

      {report && (
        <div className="mt-4 border-t border-cosmos-800 pt-4">
          <h3 className="mb-2 font-medium text-white">Metrics</h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Metric label="Precision" value={formatMetric(report.precision)} />
            <Metric label="Recall" value={formatMetric(report.recall)} />
            <Metric label="F1" value={formatMetric(report.f1)} />
            <Metric label="PSNR" value={formatMetric(report.psnrVsClean)} />
            <Metric label="SSIM" value={formatMetric(report.ssimVsClean)} />
            <Metric label="Runtime" value={`${formatMetric(report.detectionMs + report.healingMs)} ms`} />
          </div>
        </div>
      )}
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-cosmos-800 bg-cosmos-900 p-2">
      <div className="text-gray-500">{label}</div>
      <div className="font-mono text-white">{value}</div>
    </div>
  );
}

function hasDevQueryParam(): boolean {
  return new URLSearchParams(window.location.search).get('dev') === '1';
}

function createSequenceFromFrame(frame: ImageData, count: number, seed: number): ImageData[] {
  return Array.from({ length: count }, (_, frameIndex) => {
    const shifted = cloneImageData(frame);

    // Create slight deterministic motion so temporal consistency tests
    // are not biased by cloning a single static clean frame.
    const dx = ((seed + frameIndex * 3) % 3) - 1;
    const dy = ((seed + frameIndex * 5) % 3) - 1;

    if (dx === 0 && dy === 0) {
      return shifted;
    }

    const output = new Uint8ClampedArray(shifted.data.length);
    const width = shifted.width;
    const height = shifted.height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sourceX = clamp(x - dx, 0, width - 1);
        const sourceY = clamp(y - dy, 0, height - 1);

        const srcIdx = (sourceY * width + sourceX) * 4;
        const dstIdx = (y * width + x) * 4;

        output[dstIdx] = shifted.data[srcIdx]!;
        output[dstIdx + 1] = shifted.data[srcIdx + 1]!;
        output[dstIdx + 2] = shifted.data[srcIdx + 2]!;
        output[dstIdx + 3] = shifted.data[srcIdx + 3]!;
      }
    }

    return new ImageData(output, width, height);
  });
}

function imageDataToObjectUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create canvas context for preview.');
  }
  context.putImageData(imageData, 0, 0);

  const dataUrl = canvas.toDataURL('image/png');
  const [header, base64] = dataUrl.split(',');
  if (!header || !base64) {
    throw new Error('Could not serialize preview image.');
  }

  const mimeMatch = header.match(/^data:(.*);base64$/);
  const mime = mimeMatch?.[1] ?? 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

function calculateDiff(clean: ImageData, current: ImageData): {
  changedPixels: number;
  meanChannelDelta: number;
} {
  let changedPixels = 0;
  let channelDeltaSum = 0;

  for (let i = 0; i < clean.data.length; i += 4) {
    const rDelta = Math.abs(clean.data[i]! - current.data[i]!);
    const gDelta = Math.abs(clean.data[i + 1]! - current.data[i + 1]!);
    const bDelta = Math.abs(clean.data[i + 2]! - current.data[i + 2]!);
    const pixelDelta = rDelta + gDelta + bDelta;
    if (pixelDelta > 0) {
      changedPixels++;
    }
    channelDeltaSum += pixelDelta;
  }

  return {
    changedPixels,
    meanChannelDelta: channelDeltaSum / ((clean.data.length / 4) * 3),
  };
}

function coordinatesToPixelIndices(detected: Set<string>, width: number): number[] {
  return Array.from(detected).map((key) => {
    const [xValue, yValue] = key.split(',');
    return Number(yValue) * width + Number(xValue);
  });
}

function coordinateKey(x: number, y: number): string {
  return `${x},${y}`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatMetric(value: number): string {
  if (value === Infinity) return '∞';
  return Number.isFinite(value) ? value.toFixed(3) : String(value);
}
