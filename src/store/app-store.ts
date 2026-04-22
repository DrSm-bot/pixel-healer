import { create } from 'zustand';
import type {
  AppStep,
  AppError,
  ImageFile,
  HotPixelMap,
  ProcessingProgress,
  ProcessingStats,
  DetectionOptions,
  OutputSettings,
} from '@/types';

interface AppState {
  // Current workflow step
  step: AppStep;

  // Input folder
  inputDir: FileSystemDirectoryHandle | null;
  inputFiles: ImageFile[];

  // Output settings
  outputSettings: OutputSettings;

  // Detection
  detectionOptions: DetectionOptions;
  hotPixelMap: HotPixelMap | null;
  sampleFrameData: ImageData | null;
  previewUrl: string | null;

  // Processing
  progress: ProcessingProgress | null;
  stats: ProcessingStats | null;
  isPaused: boolean;
  isCancelled: boolean;

  // Error state
  error: AppError | null;

  // Actions
  setStep: (step: AppStep) => void;
  setInputDir: (dir: FileSystemDirectoryHandle | null) => void;
  setInputFiles: (files: ImageFile[]) => void;
  setOutputSettings: (settings: Partial<OutputSettings>) => void;
  setDetectionOptions: (options: Partial<DetectionOptions>) => void;
  setHotPixelMap: (map: HotPixelMap | null) => void;
  setSampleFrameData: (data: ImageData | null) => void;
  setPreviewUrl: (url: string | null) => void;
  setProgress: (progress: ProcessingProgress | null) => void;
  setStats: (stats: ProcessingStats | null) => void;
  setPaused: (paused: boolean) => void;
  setCancelled: (cancelled: boolean) => void;
  setError: (error: AppError | null) => void;
  reset: () => void;
}

const initialState = {
  step: 'select' as AppStep,
  inputDir: null,
  inputFiles: [],
  outputSettings: {
    outputDir: null,
    allowOverwrite: false,
  },
  detectionOptions: {
    threshold: 240,
    contrastEnabled: true,
    contrastMinRatio: 1.5,
    minConsistency: 0.9,
    sampleFrames: 10,
    adaptiveThreshold: false,
    adaptivePercentile: 0.999,
    adaptiveMinThreshold: 220,
    adaptiveMaxThreshold: 255,
    temporalMinRunRatio: 0.875,
    spatialIsolationEnabled: true,
    spatialMaxHotNeighbors: 0,
  },
  hotPixelMap: null,
  sampleFrameData: null,
  previewUrl: null,
  progress: null,
  stats: null,
  isPaused: false,
  isCancelled: false,
  error: null,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setStep: (step) => set({ step }),

  setInputDir: (dir) => set({ inputDir: dir }),

  setInputFiles: (files) => set({ inputFiles: files }),

  setOutputSettings: (settings) =>
    set((state) => ({
      outputSettings: { ...state.outputSettings, ...settings },
    })),

  setDetectionOptions: (options) =>
    set((state) => ({
      detectionOptions: { ...state.detectionOptions, ...options },
    })),

  setHotPixelMap: (map) => set({ hotPixelMap: map }),

  setSampleFrameData: (data) => set({ sampleFrameData: data }),

  setPreviewUrl: (url) => set({ previewUrl: url }),

  setProgress: (progress) => set({ progress }),

  setStats: (stats) => set({ stats }),

  setPaused: (paused) => set({ isPaused: paused }),

  setCancelled: (cancelled) => set({ isCancelled: cancelled }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
