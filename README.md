# ✨ Pixel Healer

**Browser-based hot pixel remover for night sky time-lapse photography.**

Remove those annoying stuck pixels from your astrophotography sequences — entirely in your browser, with zero uploads. Your images never leave your computer.

## Features

- 🌙 **Made for Night Sky** — Optimized for time-lapse sequences where stars move but hot pixels don't
- 🔒 **100% Local** — All processing happens in your browser. No uploads, no servers, no tracking
- ⚡ **Fast** — Web Workers for parallel processing, streams images without loading everything into RAM
- 🎯 **Smart Detection** — Automatically identifies stuck pixels by analyzing multiple frames
- 📁 **Batch Processing** — Process hundreds or thousands of frames at once

## How It Works

1. **Select your image folder** — Pick a directory containing your time-lapse frames
2. **Choose sensitivity** — Pick Low/Normal/High detection sensitivity presets
3. **Analyze** — The tool samples frames to find pixels that are consistently bright (hot pixels stay put, stars move!)
4. **Preview** — See detected hot pixels highlighted before committing
5. **Fix & Export** — Apply the fix to all frames and save to a new folder

## Quick Start

Visit **[pixel-healer.pages.dev](https://pixel-healer.pages.dev)**

Or run locally:

```bash
git clone https://github.com/DrSm-bot/pixel-healer.git
cd pixel-healer
pnpm install
pnpm dev
```

## Supported Formats

| Format | Status |
|--------|--------|
| JPEG/JPG | ✅ Supported |
| PNG | ✅ Supported |
| RAW (CR2, NEF, ARW, etc.) | 🗓️ Planned |

## How Detection Works

Hot pixels are sensor defects that appear as bright dots in the same position across all frames. Unlike stars (which move due to Earth's rotation), hot pixels stay stationary.

### Detection Algorithm
1. Samples multiple frames from your sequence
2. For each pixel position, checks if it's consistently above a brightness threshold
3. Applies contrast detection (compares pixel to its neighbors)
4. Filters for temporal consistency (must be hot across most frames)
5. Pixels that pass all checks = hot pixels
6. Repairs by interpolating from neighboring pixels

### Sensitivity Presets

- **Low**: Conservative detection, fewest false positives (good for clean sensors)
- **Normal**: Balanced detection, recommended for most scenarios
- **High**: Aggressive detection, catches subtle hot pixels (may include some false positives)

Advanced users can expand the **Advanced Settings** section to fine-tune all detection parameters manually.

## Privacy

**Your images never leave your device.** 

This tool uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to read and write files directly on your computer. There are no servers, no uploads, no analytics, no tracking.

The entire application runs in your browser as static files.

## Browser Support

Requires a modern browser with File System Access API support:

- ✅ Chrome 86+
- ✅ Edge 86+
- ✅ Opera 72+
- ⚠️ Firefox (limited — can read but not write back to disk)
- ⚠️ Safari (limited)

## Tech Stack

- TypeScript + Vite + React
- Web Workers for background processing
- File System Access API for streaming
- Deployed on Cloudflare Pages

## Dev: Synthetic Benchmark Harness

Pixel Healer includes a dev-only synthetic corruption + evaluation harness for reproducible detection/healing experiments.

- Spec: [`docs/SYNTHETIC_HOT_PIXEL_GENERATOR_SPEC.md`](docs/SYNTHETIC_HOT_PIXEL_GENERATOR_SPEC.md)
- Scope: deterministic hot-pixel injection, mask fixtures, evaluation metrics (precision/recall/F1, PSNR/SSIM), hidden dev panel, CI regression gate
- Open the panel during `pnpm dev` with `?dev=1` or `Ctrl+Shift+D`
- Use it after running analysis so a clean frame is in memory; choose a profile/seed, generate a corrupted sequence, then run evaluation
- CI/test flow includes a fixed typical-profile baseline gate and fails if F1 drops below the documented floor (`0.45`)
- Shipping policy: dev-only (`src/dev/**`), dynamically imported behind `import.meta.env.DEV`

### Local Full-Resolution Harness Tests

For realistic, non-downscaled evaluation on private stacks:

1. Put full-res frames under `~/stacks/stack1` and `~/stacks/stack2` (or another custom root)
2. Link them into local fixtures:
   - `./scripts/setup-local-fixtures.sh`
3. Run local evaluation:
   - `pnpm test:local`

The local test reads `tests/fixtures/local/*` (gitignored), injects synthetic hot pixels on top of those real frames, and reports precision/recall/F1, PSNR/SSIM, and runtime for all four profiles.

If your machine reports a `canvas` module error, install/build canvas native dependencies first.

### Detection Tuning Status (Current)

Recent detection tuning focused on reducing false positives on real full-resolution stacks:

- ✅ **Step 1:** Adaptive per-frame thresholding (percentile + clamps)
- ✅ **Step 2:** Temporal persistence filter (`temporalMinRunRatio`)
- ✅ **Step 3:** Spatial isolation filter (`spatialIsolationEnabled`, `spatialMaxHotNeighbors`)
- 🚧 **Step 4a (next):** Contrast-based neighborhood feature (local context signal)
- 🚧 **Step 4b (next):** Temporal variance feature (separate stable hot pixels from moving stars)

Current snapshot: `easy` profile improved strongly, while `typical` remains below target and needs the planned 4a/4b feature pass.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE)

---

*Made with 🦞 by the AxonArcade crew*
