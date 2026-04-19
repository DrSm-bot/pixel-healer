# Pixel Healer — Concept Document

*Browser-based hot pixel removal for astrophotography time-lapses*

## Problem Statement

When shooting long-exposure sequences of the night sky, camera sensors often exhibit "hot pixels" — defective sensor elements that appear as bright spots in every frame. Unlike stars, which move across the frame due to Earth's rotation, hot pixels remain stationary. This makes them particularly annoying in time-lapse videos where they appear as static bright dots against moving stars.

**Current solutions:**
- Desktop software (expensive, requires installation)
- Manual spot removal in post (tedious for 1000+ frames)
- In-camera dark frame subtraction (not always available/practical)

**Our solution:**
A free, browser-based tool that processes image sequences locally, with zero uploads and complete privacy.

## Target Users

- **Night sky photographers** creating star trail or Milky Way time-lapses
- **Content creators** who want quick, easy hot pixel removal
- **Privacy-conscious users** who don't want to upload their work to cloud services

## Core Requirements

### Must Have (MVP)
1. **Local-only processing** — No server uploads, all processing in browser
2. **Folder selection** — User picks input folder, tool processes all images
3. **Automatic detection** — Analyze frames to find hot pixels automatically
4. **Batch processing** — Handle 500+ frames without crashing
5. **Preview** — Show detected hot pixels before applying fix
6. **Export** — Save fixed images to new folder (or overwrite with confirmation)

### Should Have
- Progress indicator with ETA
- Adjustable detection sensitivity
- Manual hot pixel marking (click to add/remove)
- Before/after comparison view
- Processing statistics

### Nice to Have (Future)
- RAW format support (CR2, NEF, ARW, DNG)
- Dark frame subtraction mode
- Preset management
- Undo/redo

## Technical Architecture

### Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser                                  │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │    React    │───▶│  State Manager  │───▶│   UI Components │  │
│  │     App     │    │    (Zustand)    │    │                 │  │
│  └─────────────┘    └─────────────────┘    └─────────────────┘  │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      Web Workers                             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │ │
│  │  │ Analyzer │  │ Analyzer │  │  Fixer   │  │  Fixer   │    │ │
│  │  │ Worker 1 │  │ Worker 2 │  │ Worker 1 │  │ Worker 2 │    │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│         │                                          │             │
│         ▼                                          ▼             │
│  ┌─────────────────┐                    ┌─────────────────────┐ │
│  │ File System     │                    │ Canvas / ImageData  │ │
│  │ Access API      │                    │ Processing          │ │
│  │ (read/write)    │                    │                     │ │
│  └─────────────────┘                    └─────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

#### 1. Streaming Architecture
To handle large image sequences without exhausting browser memory:
- Load one frame at a time
- Process in Web Worker
- Write result to disk immediately
- Release memory before loading next frame

#### 2. File System Access API
Modern browsers allow reading/writing files directly:
```typescript
// Get directory handle
const dirHandle = await window.showDirectoryPicker();

// Read file
const fileHandle = await dirHandle.getFileHandle('image.jpg');
const file = await fileHandle.getFile();

// Write file
const writable = await outputHandle.createWritable();
await writable.write(processedBlob);
await writable.close();
```

#### 3. Web Workers for Parallelism
- Analyzer workers: Process multiple sample frames simultaneously
- Fixer workers: Apply fixes to frames in parallel
- Main thread stays responsive for UI

#### 4. Hot Pixel Detection Algorithm

```typescript
interface HotPixelMap {
  pixels: Set<number>; // Pixel indices (y * width + x)
  threshold: number;   // Brightness threshold used
  confidence: number;  // Detection confidence
}

function detectHotPixels(frames: ImageData[], options: DetectionOptions): HotPixelMap {
  const { threshold = 240, minConsistency = 0.9 } = options;
  
  const width = frames[0].width;
  const height = frames[0].height;
  const pixelCount = width * height;
  
  // Count how many frames each pixel is "hot" in
  const hotCounts = new Uint16Array(pixelCount);
  
  for (const frame of frames) {
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const brightness = Math.max(frame.data[idx], frame.data[idx+1], frame.data[idx+2]);
      if (brightness >= threshold) {
        hotCounts[i]++;
      }
    }
  }
  
  // Pixels that are hot in most/all frames are stuck
  const hotPixels = new Set<number>();
  const minHotFrames = Math.floor(frames.length * minConsistency);
  
  for (let i = 0; i < pixelCount; i++) {
    if (hotCounts[i] >= minHotFrames) {
      hotPixels.add(i);
    }
  }
  
  return { pixels: hotPixels, threshold, confidence: minConsistency };
}
```

#### 5. Pixel Repair Algorithm

```typescript
function repairPixel(imageData: ImageData, pixelIndex: number): void {
  const width = imageData.width;
  const x = pixelIndex % width;
  const y = Math.floor(pixelIndex / width);
  
  // Get neighboring pixels (3x3 excluding center)
  const neighbors: number[][] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < imageData.height) {
        const idx = (ny * width + nx) * 4;
        neighbors.push([
          imageData.data[idx],
          imageData.data[idx + 1],
          imageData.data[idx + 2],
        ]);
      }
    }
  }
  
  // Average the neighbors
  const avg = [0, 0, 0];
  for (const n of neighbors) {
    avg[0] += n[0];
    avg[1] += n[1];
    avg[2] += n[2];
  }
  
  const idx = pixelIndex * 4;
  imageData.data[idx] = Math.round(avg[0] / neighbors.length);
  imageData.data[idx + 1] = Math.round(avg[1] / neighbors.length);
  imageData.data[idx + 2] = Math.round(avg[2] / neighbors.length);
  // Alpha stays the same
}
```

## User Flow

### 1. Welcome Screen
- Brief explanation of what the tool does
- "Select Folder" button
- Sample images showing before/after

### 2. Folder Selection
- User clicks "Select Input Folder"
- Browser file picker opens
- Tool scans for image files (JPG, PNG)
- Shows count: "Found 847 images"

### 3. Analysis
- "Analyze" button
- Progress: "Analyzing frames... 15/20"
- Sampling strategy: first N frames, evenly distributed
- Shows preview of detected hot pixels overlaid on sample frame

### 4. Review & Adjust
- Display sample frame with hot pixels highlighted (red circles)
- Sensitivity slider to adjust threshold
- Manual click to add/remove hot pixels
- Statistics: "Detected 47 hot pixels"

### 5. Processing
- User clicks "Fix All Images"
- Optional: Select output folder
- Progress bar with frame count: "Processing 234/847 (28%)"
- ETA display
- Pause/Cancel buttons

### 6. Complete
- Success message
- Processing stats (time, frames processed, pixels fixed)
- "Open Output Folder" button
- "Process Another Folder" button

## Development Phases

### Phase 0: Project Setup ✅
- [x] Create GitHub repository
- [x] Write concept document
- [ ] Vite + TypeScript + React scaffold
- [ ] Basic project structure
- [ ] CI/CD for Cloudflare Pages

### Phase 1: Core Functionality
- [ ] File System Access API integration
- [ ] Image loading into Canvas
- [ ] Hot pixel detection algorithm
- [ ] Pixel repair algorithm
- [ ] Basic UI (folder select, process button, progress)

### Phase 2: User Experience
- [ ] Preview mode with hot pixel overlay
- [ ] Before/after comparison
- [ ] Adjustable sensitivity
- [ ] Manual hot pixel marking
- [ ] Processing statistics

### Phase 3: Performance
- [ ] Web Worker implementation
- [ ] Parallel processing
- [ ] Memory optimization
- [ ] Large sequence handling (1000+ frames)

### Phase 4: Polish
- [ ] Responsive design
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] Error handling & recovery
- [ ] Browser compatibility fallbacks

### Future: RAW Support
- [ ] Research WASM-based RAW decoders
- [ ] LibRaw or dcraw compilation
- [ ] RAW format handling

## File Structure

```
pixel-healer/
├── docs/
│   ├── CONCEPT.md           # This document
│   └── ALGORITHM.md         # Detailed algorithm docs
├── src/
│   ├── components/          # React components
│   │   ├── App.tsx
│   │   ├── FolderSelect.tsx
│   │   ├── AnalysisView.tsx
│   │   ├── PreviewView.tsx
│   │   ├── ProcessingView.tsx
│   │   └── ResultsView.tsx
│   ├── workers/             # Web Workers
│   │   ├── analyzer.worker.ts
│   │   └── fixer.worker.ts
│   ├── core/                # Core algorithms
│   │   ├── detection.ts
│   │   ├── repair.ts
│   │   └── image-utils.ts
│   ├── hooks/               # React hooks
│   │   └── useFileSystem.ts
│   ├── store/               # State management
│   │   └── app-store.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   └── main.tsx
├── public/
│   └── sample-images/       # Demo images
├── README.md
├── LICENSE
├── package.json
└── vite.config.ts
```

## Deployment

**Target:** Cloudflare Pages

```yaml
# Automatic deployment on push to main
Build command: pnpm build
Output directory: dist
```

Custom domain: `pixel-healer.pages.dev` (or custom domain later)

## Success Criteria

**MVP Complete When:**
- User can select a folder of JPGs
- Tool detects hot pixels automatically
- User can preview detection results
- Tool fixes and exports all images
- Works with 500+ frame sequences without crashing

**Project Successful When:**
- Astrophotographers use it for real projects
- Positive feedback on ease of use
- Zero server/privacy concerns from users

---

*Last updated: 2026-04-19*
