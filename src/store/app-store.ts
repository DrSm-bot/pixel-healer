import { create } from 'zustand';
import { DEFAULT_DETECTION_OPTIONS } from '@/core/presets';
import {
  INITIAL_MANUAL_EDIT_STATE,
  addHotPixel as addHotPixelCore,
  removeHotPixel as removeHotPixelCore,
  toggleManualHotPixel as toggleManualHotPixelCore,
  undoLastManualEdit as undoLastManualEditCore,
  type ManualEditState,
} from '@/core/manual-edit';
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

  // Manual pixel edits (review step)
  manualEditState: ManualEditState;


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
  addManualHotPixel: (x: number, y: number) => boolean;
  removeManualHotPixel: (x: number, y: number) => boolean;
  toggleManualHotPixel: (x: number, y: number) => 'add' | 'remove' | null;
  undoManualEdit: () => boolean;
  resetManualEdits: () => void;
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
  detectionOptions: { ...DEFAULT_DETECTION_OPTIONS },
  hotPixelMap: null,
  sampleFrameData: null,
  previewUrl: null,
  manualEditState: INITIAL_MANUAL_EDIT_STATE,
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

  setHotPixelMap: (map) =>
    set({ hotPixelMap: map, manualEditState: INITIAL_MANUAL_EDIT_STATE }),

  addManualHotPixel: (x, y) => {
    const { hotPixelMap, manualEditState } = useAppStore.getState();
    if (!hotPixelMap) return false;
    const result = addHotPixelCore(hotPixelMap, manualEditState, x, y);
    if (!result.changed) return false;
    set({ hotPixelMap: result.map, manualEditState: result.state });
    return true;
  },

  removeManualHotPixel: (x, y) => {
    const { hotPixelMap, manualEditState } = useAppStore.getState();
    if (!hotPixelMap) return false;
    const result = removeHotPixelCore(hotPixelMap, manualEditState, x, y);
    if (!result.changed) return false;
    set({ hotPixelMap: result.map, manualEditState: result.state });
    return true;
  },

  toggleManualHotPixel: (x, y) => {
    const { hotPixelMap, manualEditState } = useAppStore.getState();
    if (!hotPixelMap) return null;
    const result = toggleManualHotPixelCore(hotPixelMap, manualEditState, x, y);
    if (!result.changed) return null;
    set({ hotPixelMap: result.map, manualEditState: result.state });
    return result.kind;
  },

  undoManualEdit: () => {
    const { hotPixelMap, manualEditState } = useAppStore.getState();
    if (!hotPixelMap) return false;
    const result = undoLastManualEditCore(hotPixelMap, manualEditState);
    if (!result.changed) return false;
    set({ hotPixelMap: result.map, manualEditState: result.state });
    return true;
  },

  resetManualEdits: () => set({ manualEditState: INITIAL_MANUAL_EDIT_STATE }),

  setSampleFrameData: (data) => set({ sampleFrameData: data }),

  setPreviewUrl: (url) => set({ previewUrl: url }),

  setProgress: (progress) => set({ progress }),

  setStats: (stats) => set({ stats }),

  setPaused: (paused) => set({ isPaused: paused }),

  setCancelled: (cancelled) => set({ isCancelled: cancelled }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
