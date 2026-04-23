# Pixel Healer — Concept Document

*Browser-based hot pixel removal for astrophotography time-lapses*

Last updated: 2026-04-22 (Detection tuning Steps 1–4b complete)

## Problem Statement

Long-exposure night-sky sequences often contain **hot/stuck pixels** (sensor defects) that stay fixed at the same coordinates across all frames.

Unlike stars (which move), hot pixels remain static and become very visible in time-lapse output.

## Goal

Provide a free, privacy-first web app that:

1. scans an image stack locally,
2. detects likely hot pixels automatically,
3. previews detections,
4. repairs all frames in batch.

## Privacy + Product Principles

- 100% local processing in browser
- no mandatory upload path
- deterministic/reproducible behavior
- workflow optimized for large frame stacks

## Current Implementation Status

### ✅ Done (Phase 0 + Phase 1 + Phase 2 + Phase 3a + Detection Tuning)

**Phase 0 — Project Setup:**
- Vite + React 18 + TypeScript scaffold
- Zustand store + Tailwind CSS setup
- File System Access API hook integration
- Cloudflare Pages deployment (pixel-healer.pages.dev)

**Phase 1 — Filesystem + Analysis:**
- Input folder selection
- Supported file scan: **.jpg / .jpeg / .png / .webp**
- Deterministic filename sort (numeric-aware)
- Analysis step UI + progress/error state
- Sampling strategy (`selectSampleFrames`)
- Decode sampled files to `ImageData`
- Detection pipeline + hot-pixel map generation
- Preview overlay rendering (hot pixels highlighted in red)
- Edge-case hardening (empty input guard, preview URL cleanup)

**Phase 2 — Processing + Export:**
- Batch repair across all frames with progress indicator
- Output folder selection (separate from input)
- Same-directory safety check (`isSameEntry`)
- Overwrite confirmation when input = output
- Per-file error handling (continue on error, report failures)
- MIME/extension consistency (format derived from filename)
- Processing statistics (frames processed, pixels fixed, time, avg per frame)
- Pause/Resume/Cancel controls
- Results summary with "Process Another Folder" option

**Phase 3a — Synthetic Benchmark Harness:**
- Dev-only synthetic hot-pixel generator (`src/dev/hotPixelGen/*`)
- Deterministic seeded masks + fixture serialization
- Evaluation harness (precision/recall/F1 + PSNR/SSIM + runtime)
- Baseline benchmark capture + CI regression gate
- Hidden dev panel for qualitative inspection (`?dev=1` / `Ctrl+Shift+D`)
- Local full-resolution test infrastructure (`tests/fixtures/local/`)

**Detection Algorithm Tuning (Steps 1-4b):**
- Step 1: Adaptive thresholding (per-frame percentile-based)
- Step 2: Temporal persistence filter (`temporalMinRunRatio`)
- Step 3: Spatial isolation filter (clustered candidates removed)
- Step 4a: Contrast-based neighborhood detection (biggest improvement!)
- Step 4b: Temporal variance filter (consistent brightness check)

**Benchmark Results (F1 scores after tuning):**

| Stack/Profile  | Baseline | After Tuning |
|----------------|----------|--------------|
| stack1/easy    | 0.736    | **0.902**    |
| stack1/typical | 0.418    | **0.602**    |
| stack2/easy    | 0.241    | **0.848**    |
| stack2/typical | 0.203    | **0.669**    |

**Algorithm is now production-ready!**

### 🚧 In Progress / Next (Phase 3b: Review UX)

1. **Streamlined Sensitivity UI:** ✅
   - Low/Normal/High sensitivity presets
   - Expandable Advanced Settings section for parameter tuning
   - No mode switching required

2. **Manual Pixel Editing:** (Next PR)
   - Click to add/remove hot pixels
   - Before/after comparison view
   - Hot pixel coordinate list

3. **Live Preview:** (Next PR)
   - Real-time detection preview on parameter change

## Detection Parameters

### Optimized Defaults (v1.0)

| Parameter | Value | Description |
|-----------|-------|-------------|
| `threshold` | 240 | Absolute brightness threshold |
| `adaptiveThreshold` | **true** | Per-frame percentile-based threshold |
| `adaptivePercentile` | 0.995 | 99.5th percentile |
| `contrastEnabled` | **true** | Local contrast detection |
| `contrastMinRatio` | **1.3** | 30% brighter than neighbors |
| `minConsistency` | 0.9 | 90% of frames must show hot pixel |
| `temporalMinRunRatio` | 0.875 | Consecutive frame requirement |
| `spatialIsolationEnabled` | **true** | Filter clustered candidates |
| `varianceFilterEnabled` | **true** | Low variance = hot pixel |

### Sensitivity Presets (Implemented)

```typescript
const PRESETS = {
  low: {
    contrastMinRatio: 2.0,           // More conservative
    minConsistency: 0.95,            // Must appear in 95% of frames
    temporalMinRunRatio: 0.9,        // Longer consecutive run
    varianceMaxThreshold: 80,        // Lower variance tolerance
  },
  normal: {
    contrastMinRatio: 1.3,           // Balanced (default)
    minConsistency: 0.9,             // Must appear in 90% of frames
    temporalMinRunRatio: 0.875,
    varianceMaxThreshold: 100,
  },
  high: {
    contrastMinRatio: 1.1,           // More sensitive
    minConsistency: 0.8,             // Must appear in 80% of frames
    temporalMinRunRatio: 0.75,       // Shorter run required
    varianceMaxThreshold: 120,       // Higher variance tolerance
  },
};
```

**UI Flow:**
- Default preset: **Normal** sensitivity
- Presets shown as primary interface (Low/Normal/High)
- Expandable "Advanced Settings" section for full parameter control
- Manual parameter edits are detected and shown as "Custom" preset

## Technical Architecture

- **React UI** + Zustand app state
- **Core algorithms** in `src/core/*` (detection, repair, image-utils)
- **Worker entry** in `src/workers/analyzer.worker.ts` (Comlink-ready)
- **File IO** through File System Access API (`src/hooks/useFileSystem.ts`)

### Detection Pipeline

1. **Sampling:** Select N frames evenly distributed across sequence
2. **Per-frame analysis:**
   - Adaptive threshold calculation (percentile-based)
   - Contrast check against 8-neighborhood average
3. **Cross-frame aggregation:**
   - Consistency check (hot in X% of frames)
   - Temporal run filter (consecutive frames)
   - Variance filter (low variance = stable = hot pixel)
4. **Spatial filtering:**
   - Isolated pixels only (no clusters)

### Repair Model

- Replace hot pixel with average of 8 neighbors (3x3 kernel)
- Skip pixels at image edges gracefully
- Batch repair via `repairAllPixels()`

## Development Phases

### Phase 0: Project Setup ✅
### Phase 1: Filesystem + Analysis ✅
### Phase 2: Processing Pipeline ✅
### Phase 3a: Synthetic Benchmark Harness ✅
### Detection Tuning (Steps 1-4b) ✅

### Phase 3b: Review UX 🚧
- [x] Sensitivity presets UI with expandable Advanced Settings (PR #15, #16)
- [ ] Manual add/remove hot pixels (click to toggle)
- [ ] Before/after comparison slider
- [ ] Detection sensitivity tuning with live preview
- [ ] Hot pixel list with coordinates

### Phase 4: Performance + Polish
- [ ] Expand worker usage for processing step
- [ ] Large-sequence throughput tuning (1000+ frames)
- [ ] Memory pressure monitoring
- [ ] Browser fallback/error clarity

### Future
- [ ] RAW format support (CR2/NEF/ARW/DNG via WASM decoder)
- [ ] Dark frame subtraction mode
- [ ] Preset save/load

## Deployment (Cloudflare Pages)

- **URL:** https://pixel-healer.pages.dev
- **Build command:** `pnpm run build`
- **Output directory:** `dist`
- **Node version:** `22`
- **Auto-deploy:** On push to `main`

## Success Criteria

### MVP ✅ COMPLETE

Users can:
- [x] Select a folder of frames
- [x] Detect hot pixels reliably (F1 > 0.6 on typical scenarios)
- [x] Preview detections
- [x] Run full-frame-stack repair/export
- [x] Handle sequences without crashing
- [x] See processing statistics

### Phase 3b Goals

- [ ] User-friendly sensitivity controls (Low/Normal/High)
- [ ] Manual pixel editing capability
- [ ] Before/after visual comparison

## PRs Merged

| PR | Title | Status |
|----|-------|--------|
| #1 | Phase 0 Scaffold | ✅ Merged |
| #2 | Phase 1: Filesystem + Analysis | ✅ Merged |
| #3 | Fix: Review flow double-analyze bug | ✅ Merged |
| #4 | Fix: Zustand selectors for re-render | ✅ Merged |
| #5 | Phase 2: Processing + Export | ✅ Merged |
| #6 | Fix: Spinner + Done checkmark cosmetics | ✅ Merged |
| #7-11 | Phase 3a: Synthetic Harness + Dev Panel | ✅ Merged |
| #12 | Docs: Detection tuning status | ✅ Merged |
| #13 | Detection Tuning Steps 1-3 | ✅ Merged |
| #14 | Detection Tuning Steps 4a+4b (Contrast + Variance) | ✅ Merged |
