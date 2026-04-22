import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeFrame, detectHotPixels, extractBrightnessMap } from '../../src/core/detection';
import { cloneImageData, repairAllPixels } from '../../src/core/repair';
import type { DetectionOptions, GeneratorConfig } from '../../src/types';
import type { EvalReport } from '../../src/dev/hotPixelGen/eval';
import { evaluate } from '../../src/dev/hotPixelGen/eval';
import { profiles } from '../../src/dev/hotPixelGen/generator';
import { generateMask } from '../../src/dev/hotPixelGen/mask';

const LOCAL_FIXTURE_ROOT = resolve(
  process.cwd(),
  process.env.PIXEL_HEALER_LOCAL_FIXTURES ?? 'tests/fixtures/local'
);

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const PROFILE_NAMES = ['easy', 'typical', 'nasty', 'pathological'] as const;
const DEFAULT_SEED = Number(process.env.PIXEL_HEALER_LOCAL_SEED ?? 1337);
const LOCAL_DETECTION_OPTIONS: DetectionOptions = {
  threshold: Number(process.env.PIXEL_HEALER_LOCAL_THRESHOLD ?? 240),
  contrastEnabled: process.env.PIXEL_HEALER_LOCAL_CONTRAST !== '0',
  contrastMinRatio: Number(process.env.PIXEL_HEALER_LOCAL_CONTRAST_MIN_RATIO ?? 1.5),
  minConsistency: Number(process.env.PIXEL_HEALER_LOCAL_MIN_CONSISTENCY ?? 0.9),
  adaptiveThreshold: process.env.PIXEL_HEALER_LOCAL_ADAPTIVE !== '0',
  adaptivePercentile: Number(process.env.PIXEL_HEALER_LOCAL_ADAPTIVE_PERCENTILE ?? 0.999),
  adaptiveMinThreshold: Number(process.env.PIXEL_HEALER_LOCAL_ADAPTIVE_MIN ?? 220),
  adaptiveMaxThreshold: Number(process.env.PIXEL_HEALER_LOCAL_ADAPTIVE_MAX ?? 255),
  temporalMinRunRatio: Number(process.env.PIXEL_HEALER_LOCAL_TEMPORAL_MIN_RUN ?? 0.875),
  spatialIsolationEnabled: process.env.PIXEL_HEALER_LOCAL_SPATIAL !== '0',
  spatialMaxHotNeighbors: Number(process.env.PIXEL_HEALER_LOCAL_SPATIAL_MAX_NEIGHBORS ?? 0),
  varianceFilterEnabled: process.env.PIXEL_HEALER_LOCAL_VARIANCE !== '0',
  varianceMaxThreshold: Number(process.env.PIXEL_HEALER_LOCAL_VARIANCE_MAX ?? 100),
};

const canvasModule = await tryImportCanvas();
const stackDirs = discoverStacks(LOCAL_FIXTURE_ROOT);

if (!canvasModule) {
  describe.skip('real-stack local synthetic harness', () => {
    it('skips when optional dependency canvas is unavailable', () => {
      expect(true).toBe(true);
    });
  });
} else if (stackDirs.length === 0) {
  describe.skip('real-stack local synthetic harness', () => {
    it('skips when no local fixture stacks are configured', () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe('real-stack local synthetic harness', () => {
    for (const stackDir of stackDirs) {
      it(
        `runs evaluation on ${stackDir.name} across all profiles`,
        async () => {
          const frames = await loadStackFrames(stackDir.path, canvasModule);
          expect(frames.length).toBeGreaterThan(0);

          const { width, height } = frames[0]!;
          const frameCount = frames.length;

          for (const profileName of PROFILE_NAMES) {
            const config: GeneratorConfig = {
              width,
              height,
              seed: DEFAULT_SEED,
              density: profiles[profileName].density ?? 150,
              ...profiles[profileName],
            };
            const mask = generateMask(config);

            const report = await evaluate({
              cleanFrames: frames,
              mask,
              detect: async (corruptedFrames) => {
                const analyzedFrames = corruptedFrames.map((frame) =>
                  analyzeFrame(frame, LOCAL_DETECTION_OPTIONS)
                );
                const frameBrightnessMaps = corruptedFrames.map((frame) =>
                  extractBrightnessMap(frame)
                );
                const detected = detectHotPixels(
                  analyzedFrames,
                  width,
                  height,
                  {
                    ...LOCAL_DETECTION_OPTIONS,
                    sampleFrames: corruptedFrames.length,
                  },
                  frameBrightnessMaps
                );

                return new Set(
                  Array.from(detected.pixels).map((pixelIndex) =>
                    coordinateKey(pixelIndex % width, Math.floor(pixelIndex / width))
                  )
                );
              },
              heal: async (corruptedFrames, detected) =>
                corruptedFrames.map((frame) => {
                  const healed = cloneImageData(frame);
                  repairAllPixels(healed, detectedCoordinatesToIndices(detected, width));
                  return healed;
                }),
            });

            assertValidReport(report, frameCount);
            logReport(stackDir.name, profileName, report);
          }
        },
        {
          timeout: 180_000,
        }
      );
    }
  });
}

function discoverStacks(rootDir: string): Array<{ name: string; path: string }> {
  try {
    return readdirSync(rootDir)
      .map((name) => ({
        name,
        path: resolve(rootDir, name),
      }))
      .filter((candidate) => {
        try {
          const files = readdirSync(candidate.path);
          return files.some((file) => IMAGE_EXTENSIONS.has(extensionOf(file)));
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

async function loadStackFrames(
  stackDir: string,
  canvasModule: CanvasModule
): Promise<ImageData[]> {
  const { createCanvas, loadImage } = canvasModule;

  const imagePaths = readdirSync(stackDir)
    .filter((filename) => IMAGE_EXTENSIONS.has(extensionOf(filename)))
    .sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    )
    .map((filename) => resolve(stackDir, filename));

  if (imagePaths.length === 0) {
    throw new Error(`No supported images found in ${stackDir}`);
  }

  const frames: ImageData[] = [];

  for (const imagePath of imagePaths) {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);

    const rgba = context.getImageData(0, 0, image.width, image.height);
    frames.push(new ImageData(new Uint8ClampedArray(rgba.data), rgba.width, rgba.height));
  }

  const first = frames[0]!;
  for (const [index, frame] of frames.entries()) {
    if (frame.width !== first.width || frame.height !== first.height) {
      throw new Error(
        `Frame ${index} in ${stackDir} has mismatched dimensions (${frame.width}x${frame.height}); expected ${first.width}x${first.height}`
      );
    }
  }

  return frames;
}

function extensionOf(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) {
    return '';
  }
  return filename.slice(dotIndex).toLowerCase();
}

function detectedCoordinatesToIndices(detected: Set<string>, width: number): number[] {
  return Array.from(detected).map((key) => {
    const [xValue, yValue] = key.split(',');
    const x = Number(xValue);
    const y = Number(yValue);

    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error(`Invalid detected coordinate key "${key}"; expected "x,y"`);
    }

    return y * width + x;
  });
}

function coordinateKey(x: number, y: number): string {
  return `${x},${y}`;
}

function assertValidReport(report: EvalReport, expectedFrames: number): void {
  expect(report.precision).toBeGreaterThanOrEqual(0);
  expect(report.precision).toBeLessThanOrEqual(1);
  expect(report.recall).toBeGreaterThanOrEqual(0);
  expect(report.recall).toBeLessThanOrEqual(1);
  expect(report.f1).toBeGreaterThanOrEqual(0);
  expect(report.f1).toBeLessThanOrEqual(1);
  expect(report.ssimVsClean).toBeGreaterThanOrEqual(0);
  expect(report.ssimVsClean).toBeLessThanOrEqual(1);
  expect(report.detectionMs).toBeGreaterThanOrEqual(0);
  expect(report.healingMs).toBeGreaterThanOrEqual(0);
  expect(report.framesProcessed).toBe(expectedFrames);
}

function logReport(stackName: string, profileName: string, report: EvalReport): void {
  const runtimeMs = report.detectionMs + report.healingMs;
  const psnr = Number.isFinite(report.psnrVsClean) ? report.psnrVsClean.toFixed(3) : '∞';

  console.info(
    `[local-fixture] stack=${stackName} profile=${profileName} seed=${DEFAULT_SEED} contrast=${LOCAL_DETECTION_OPTIONS.contrastEnabled ? 'on' : 'off'} cMin=${LOCAL_DETECTION_OPTIONS.contrastMinRatio ?? '-'} adaptive=${LOCAL_DETECTION_OPTIONS.adaptiveThreshold ? 'on' : 'off'} p=${LOCAL_DETECTION_OPTIONS.adaptivePercentile ?? '-'} minRun=${LOCAL_DETECTION_OPTIONS.temporalMinRunRatio ?? 0} spatial=${LOCAL_DETECTION_OPTIONS.spatialIsolationEnabled ? 'on' : 'off'} maxN=${LOCAL_DETECTION_OPTIONS.spatialMaxHotNeighbors ?? '-'} variance=${LOCAL_DETECTION_OPTIONS.varianceFilterEnabled ? 'on' : 'off'} vMax=${LOCAL_DETECTION_OPTIONS.varianceMaxThreshold ?? '-'} precision=${report.precision.toFixed(3)} recall=${report.recall.toFixed(3)} f1=${report.f1.toFixed(3)} psnr=${psnr} ssim=${report.ssimVsClean.toFixed(3)} runtimeMs=${runtimeMs.toFixed(1)}`
  );
}

type CanvasModule = {
  createCanvas: (width: number, height: number) => {
    getContext: (contextId: '2d') => {
      drawImage: (image: unknown, x: number, y: number) => void;
      getImageData: (
        sx: number,
        sy: number,
        sw: number,
        sh: number
      ) => { data: Uint8ClampedArray; width: number; height: number };
    };
  };
  loadImage: (path: string) => Promise<{ width: number; height: number }>;
};

async function tryImportCanvas(): Promise<CanvasModule | null> {
  try {
    return (await import('canvas')) as CanvasModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[local-fixture] skipping: optional dependency "canvas" is unavailable (${message}). Install/build canvas support before running pnpm test:local.`
    );
    return null;
  }
}
