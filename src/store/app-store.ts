import { create } from 'zustand';
import type {
  AppStep,
  AppError,
  ImageFile,
  HotPixelMap,
  ProcessingProgress,
  ProcessingStats,
  DetectionOptions,
} from '@/types';

interface AppState {
  // Current workflow step
  step: AppStep;

  // Input folder
  inputDir: FileSystemDirectoryHandle | null;
  inputFiles: ImageFile[];

  // Output folder (optional, defaults to input)
  outputDir: FileSystemDirectoryHandle | null;

  // Detection
  detectionOptions: DetectionOptions;
  hotPixelMap: HotPixelMap | null;
  sampleFrameData: ImageData | null;

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
  setOutputDir: (dir: FileSystemDirectoryHandle | null) => void;
  setDetectionOptions: (options: Partial<DetectionOptions>) => void;
  setHotPixelMap: (map: HotPixelMap | null) => void;
  setSampleFrameData: (data: ImageData | null) => void;
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
  outputDir: null,
  detectionOptions: {
    threshold: 240,
    minConsistency: 0.9,
    sampleFrames: 10,
  },
  hotPixelMap: null,
  sampleFrameData: null,
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

  setOutputDir: (dir) => set({ outputDir: dir }),

  setDetectionOptions: (options) =>
    set((state) => ({
      detectionOptions: { ...state.detectionOptions, ...options },
    })),

  setHotPixelMap: (map) => set({ hotPixelMap: map }),

  setSampleFrameData: (data) => set({ sampleFrameData: data }),

  setProgress: (progress) => set({ progress }),

  setStats: (stats) => set({ stats }),

  setPaused: (paused) => set({ isPaused: paused }),

  setCancelled: (cancelled) => set({ isCancelled: cancelled }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
