# Pixel Healer — Concept Document

*Browser-based hot pixel removal for astrophotography time-lapses*

Last updated: 2026-04-20

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

### ✅ Done (Phase 0 + Phase 1)

- Vite + React 18 + TypeScript scaffold
- Zustand store + Tailwind setup
- File System Access API hook integration
- Input folder selection
- Supported file scan: **.jpg / .jpeg / .png**
- Deterministic filename sort (numeric-aware)
- Analysis step UI + progress/error state
- Sampling strategy (`selectSampleFrames`)
- Decode sampled files to `ImageData`
- Detection pipeline + hot-pixel map generation
- Preview overlay rendering
- Edge-case hardening:
  - guard for empty analysis input
  - robust detection behavior for empty frame/pixel sets
  - preview URL cleanup on repeated runs

### 🚧 In progress / next

- batch repair application across all frames
- export/write pipeline for repaired images
- richer review UI (manual pixel add/remove)
- processing stats + before/after UX polish

## Technical Architecture (current + intended)

- React UI + Zustand app state
- Core algorithms in `src/core/*`
- Worker entry in `src/workers/analyzer.worker.ts`
- File IO through File System Access API (`src/hooks/useFileSystem.ts`)

### Detection model (implemented)

- sample N frames from sequence
- mark bright pixels per frame over threshold
- aggregate consistency across sampled frames
- classify as hot pixel when consistency >= `minConsistency`

### Repair model (present as core util, full batch pipeline pending)

- repair by neighborhood interpolation around detected pixel coordinates

## User Flow (target)

1. Select input folder
2. Analyze sample frames
3. Review/adjust detections
4. Process all images
5. Export and summary

## Development Phases

### Phase 0: Project Setup ✅
- [x] Repo + baseline docs
- [x] Vite + TS + React scaffold
- [x] Basic app structure
- [x] Cloudflare Pages deployment baseline

### Phase 1: Filesystem + Analysis ✅
- [x] File System Access integration
- [x] Folder scan for supported image types
- [x] Image decode into analysis pipeline
- [x] Hot pixel detection + preview integration
- [x] Build/typecheck validation

### Phase 2: Processing Pipeline (next)
- [ ] Batch repair execution for full sequence
- [ ] Output folder/write flow
- [ ] Per-file progress + cancel safety

### Phase 3: Review UX
- [ ] Manual add/remove hot pixels
- [ ] Before/after compare
- [ ] Detection tuning UX improvements

### Phase 4: Performance + Polish
- [ ] Expand worker usage for processing step
- [ ] Large-sequence throughput tuning
- [ ] Browser fallback/error clarity

### Future
- [ ] RAW format support (CR2/NEF/ARW/DNG)

## Current File Structure (actual)

```text
pixel-healer/
├── docs/
│   └── CONCEPT.md
├── src/
│   ├── components/
│   │   ├── App.tsx
│   │   ├── FolderSelect.tsx
│   │   ├── AnalysisView.tsx
│   │   ├── ProcessingView.tsx
│   │   └── ResultsView.tsx
│   ├── workers/
│   │   └── analyzer.worker.ts
│   ├── core/
│   │   ├── detection.ts
│   │   ├── repair.ts
│   │   └── image-utils.ts
│   ├── hooks/
│   │   └── useFileSystem.ts
│   ├── store/
│   │   └── app-store.ts
│   ├── types/
│   │   └── index.ts
│   ├── index.css
│   └── main.tsx
├── README.md
├── package.json
└── vite.config.ts
```

## Deployment Notes (Cloudflare Pages)

- Build command: `pnpm run build`
- Output directory: `dist`
- Install command: `pnpm install --frozen-lockfile`
- Recommended Node: `22`

## Success Criteria (MVP)

MVP is considered done when users can:

- select a folder of frames,
- detect hot pixels reliably,
- preview detections,
- run full-frame-stack repair/export,
- handle large sequences without crashing.
