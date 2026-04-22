# Pixel Healer — Concept Document

*Browser-based hot pixel removal for astrophotography time-lapses*

Last updated: 2026-04-22 (Detection tuning Step 1–3 complete; Step 4a/4b planned)

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

### ✅ Done (Phase 0 + Phase 1 + Phase 2)

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

**UX Polish:**
- Step indicator with progress checkmarks (all 5 steps)
- Proper CSS spinner (no emoji wobble)
- Individual Zustand selectors for reliable re-renders
- Preview URL persistence across step transitions

### 🚧 In Progress / Next

- Richer review UI (manual pixel add/remove)
- Before/after comparison view
- Web Worker parallelization for processing step

## Technical Architecture

- **React UI** + Zustand app state
- **Core algorithms** in `src/core/*` (detection, repair, image-utils)
- **Worker entry** in `src/workers/analyzer.worker.ts` (Comlink-ready)
- **File IO** through File System Access API (`src/hooks/useFileSystem.ts`)

### Detection Model (implemented)

1. Sample N frames from sequence (evenly distributed)
2. For each pixel, count frames where brightness > threshold
3. Pixels hot in >= `minConsistency` of frames = stuck pixels
4. Stars move between frames → low consistency → not detected

### Repair Model (implemented)

- Replace hot pixel with average of 8 neighbors (3x3 kernel)
- Skip pixels at image edges gracefully
- Batch repair via `repairAllPixels()`

## User Flow (current)

1. **Select** — Pick input folder containing image sequence
2. **Analyze** — Sample frames, detect hot pixels, show preview
3. **Review** — See detection count, adjust if needed (basic)
4. **Process** — Choose output folder, run batch repair with progress
5. **Done** — View statistics, process another folder

## Development Phases

### Phase 0: Project Setup ✅
- [x] Repo + baseline docs
- [x] Vite + TS + React scaffold
- [x] Basic app structure
- [x] Cloudflare Pages deployment

### Phase 1: Filesystem + Analysis ✅
- [x] File System Access integration
- [x] Folder scan for supported image types
- [x] Image decode into analysis pipeline
- [x] Hot pixel detection + preview integration
- [x] Build/typecheck validation

### Phase 2: Processing Pipeline ✅
- [x] Batch repair execution for full sequence
- [x] Output folder selection + write flow
- [x] Same-directory safety checks
- [x] Per-file progress + cancel/pause
- [x] Processing statistics + results view
- [x] MIME/extension consistency

### Phase 3a: Synthetic Benchmark Harness ✅
- [x] Dev-only synthetic hot-pixel generator (`src/dev/hotPixelGen/*`)
- [x] Deterministic seeded masks + fixture serialization (`schemaVersion: 1`)
- [x] Evaluation harness (precision/recall/F1 + PSNR/SSIM + runtime)
- [x] Baseline benchmark capture + CI regression gate
- [x] Hidden dev panel for qualitative inspection (`?dev=1` / `Ctrl+Shift+D`)
- [x] Spec reference: `docs/SYNTHETIC_HOT_PIXEL_GENERATOR_SPEC.md`

#### Phase 3a Step 3 Dev Panel

The hidden panel is developer tooling only. It is dynamically imported from `src/dev/DevPanel.tsx` behind `import.meta.env.DEV`, so it is not wired into the production runtime.

To use it:
1. Run `pnpm dev`.
2. Open the app with `?dev=1` or press `Ctrl+Shift+D`.
3. Select a folder and run analysis so the app has a clean frame in memory.
4. Choose an `easy`, `typical`, `nasty`, or `pathological` profile plus a seed.
5. Generate a corrupted sequence, run `evaluate()`, and compare clean/corrupted/healed previews with the diff indicator.

The panel reports precision, recall, F1, PSNR, SSIM, and runtime for the current synthetic run.

#### CI Regression Gate

`npm test` includes a deterministic synthetic baseline check using the `typical` profile and fixed seed `1337`. The gate currently fails if baseline F1 drops below `0.45`, which is below the observed current baseline but high enough to catch clear regressions in detection behavior.

For realistic local-only validation on full-resolution private stacks, use `pnpm test:local`. That test consumes fixture directories from `tests/fixtures/local/*` (gitignored) and runs all four synthetic profiles on top of real frames.

### Parallel Track: Detection Tuning (real-stack quality pass) 🚧

Goal: improve recall on `typical` without reintroducing major false positives.

Completed tuning slices:
- [x] **Step 1 — Adaptive thresholding** (per-frame percentile threshold + clamps)
- [x] **Step 2 — Temporal persistence** (`temporalMinRunRatio`)
- [x] **Step 3 — Spatial isolation** (`spatialIsolationEnabled`, `spatialMaxHotNeighbors`)

Observed outcome so far:
- `easy` profile improved significantly on both local stacks
- `typical` profile remains materially below target

Next planned slices:
- [ ] **Step 4a — Contrast-based neighborhood feature** (local contrast signal)
- [ ] **Step 4b — Temporal variance feature** (stable-vs-moving pixel discrimination)

Decision gate after 4a/4b:
- If `typical` still stays below ~`0.6`, re-baseline expectations for harder profiles and document constraints explicitly.

### Phase 3b: Review UX
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

## Current File Structure

```text
pixel-healer/
├── docs/
│   └── CONCEPT.md
├── src/
│   ├── components/
│   │   ├── App.tsx           # Main app shell + routing
│   │   ├── FolderSelect.tsx  # Step 1: Input selection
│   │   ├── AnalysisView.tsx  # Steps 2+3: Analyze + Review
│   │   ├── ProcessingView.tsx # Step 4: Batch processing
│   │   └── ResultsView.tsx   # Step 5: Completion stats
│   ├── workers/
│   │   └── analyzer.worker.ts # Comlink worker (analysis)
│   ├── core/
│   │   ├── detection.ts      # Hot pixel detection algorithm
│   │   ├── repair.ts         # Pixel repair (neighbor avg)
│   │   └── image-utils.ts    # Overlay, stats, data URLs
│   ├── hooks/
│   │   └── useFileSystem.ts  # File System Access API wrapper
│   ├── dev/
│   │   ├── DevPanel.tsx      # Hidden dev-only synthetic harness panel
│   │   └── hotPixelGen/      # Synthetic generator, evaluator, baseline tests
│   ├── store/
│   │   └── app-store.ts      # Zustand global state
│   ├── types/
│   │   └── index.ts          # TypeScript definitions
│   ├── index.css             # Tailwind + custom styles
│   └── main.tsx              # Entry point
├── public/
│   └── favicon.svg
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

## Deployment (Cloudflare Pages)

- **URL:** https://pixel-healer.pages.dev
- **Build command:** `pnpm run build`
- **Output directory:** `dist`
- **Install command:** `pnpm install --frozen-lockfile`
- **Node version:** `22`
- **Auto-deploy:** On push to `main`

## Success Criteria (MVP) ✅

Users can:
- [x] Select a folder of frames
- [x] Detect hot pixels reliably
- [x] Preview detections
- [x] Run full-frame-stack repair/export
- [x] Handle sequences without crashing
- [x] See processing statistics

**MVP Status: COMPLETE** 🎉

## PRs Merged

| PR | Title | Status |
|----|-------|--------|
| #1 | Phase 0 Scaffold | ✅ Merged |
| #2 | Phase 1: Filesystem + Analysis | ✅ Merged |
| #3 | Fix: Review flow double-analyze bug | ✅ Merged |
| #4 | Fix: Zustand selectors for re-render | ✅ Merged |
| #5 | Phase 2: Processing + Export | ✅ Merged |
| #6 | Fix: Spinner + Done checkmark cosmetics | ✅ Merged |
| #7 | Docs: add synthetic hot-pixel generator + eval harness spec | ✅ Merged |
| #8 | Phase 3a Step 1: synthetic generator core | ✅ Merged |
| #9 | Phase 3a Step 2: evaluation harness + baseline metrics | ✅ Merged |
| #10 | Phase 3a Step 3: dev panel + regression gate + docs | ✅ Merged |
| #11 | Docs: final sync after Phase 3a merge train | ✅ Merged |
