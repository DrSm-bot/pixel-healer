# Pixel Healer

**Browser-based hot pixel remover for night sky time-lapse photography.**

Remove stuck/hot pixels from your astrophotography sequences entirely in your browser. No uploads, no servers — your images never leave your computer.

## Why Pixel Healer?

Hot pixels are sensor defects that appear as bright dots in the same position across all frames. Unlike stars (which move due to Earth's rotation), hot pixels stay stationary — making them easy to detect by comparing frames, but tedious to fix manually across hundreds of images.

Pixel Healer automates this: it analyzes your sequence, finds the stuck pixels, and repairs them across all frames in batch.

## Features

- **Made for Night Sky** — Optimized for time-lapse sequences where stars move but hot pixels don't
- **100% Local** — All processing happens in your browser. No uploads, no servers, no tracking
- **Smart Detection** — Automatically identifies stuck pixels using adaptive thresholds and temporal analysis
- **Before/After Comparison** — Slider, toggle, or side-by-side view to verify repairs
- **Manual Editing** — Click to add missed pixels or remove false positives, with full undo support
- **Batch Processing** — Process hundreds or thousands of frames at once
- **Safe by Default** — Writes to a separate output folder; overwriting originals requires explicit opt-in

## How It Works

### 1. Analyze

Select your image folder and choose a sensitivity preset (Low / Normal / High). The tool samples frames across your sequence and identifies pixels that are consistently bright in the same position — hot pixels stay put while stars move.

Expand **Advanced Settings** if you need fine-grained control over detection parameters.

### 2. Review

See detected hot pixels highlighted on a sample frame. Use the comparison tools to verify:

- **Slider**: Drag to reveal the repaired image underneath
- **Toggle**: Click to flip between before/after
- **Side-by-side**: View both images at once

If the detection missed a pixel or flagged a false positive, enable **Edit Mode** to click and add/remove pixels manually. Use **Undo** to reverse mistakes or **Clear edit history** to start fresh.

### 3. Process

Choose an output folder and process all frames. The tool repairs each image and saves it to your chosen location.

**Output folder safety:**
- By default, you must select a *different* folder than your input to prevent accidental overwrites
- If you select the same folder, you'll see a warning and must explicitly check "Allow overwriting input files"
- Always keep backups of your original files before processing

Processing can be paused, resumed, or cancelled at any time.

## Quick Start

**Try it now:** [pixel-healer.pages.dev](https://pixel-healer.pages.dev)

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
| JPEG/JPG | Supported |
| PNG | Supported |
| WebP | Supported |
| RAW (CR2, NEF, ARW, etc.) | Planned |

## Detection Algorithm

1. **Sampling** — Selects frames distributed across your sequence
2. **Adaptive thresholding** — Per-frame brightness threshold based on percentile
3. **Contrast check** — Compares each pixel to its 8 neighbors
4. **Temporal consistency** — Must be hot across most sampled frames
5. **Variance filter** — Stable brightness = hot pixel (stars flicker)
6. **Spatial isolation** — Hot pixels are isolated, not clustered

**Repair:** Hot pixels are replaced with the average of their 8 neighbors.

### Sensitivity Presets

| Preset | Use Case |
|--------|----------|
| **Low** | Conservative — fewest false positives, good for clean sensors |
| **Normal** | Balanced — recommended for most scenarios |
| **High** | Aggressive — catches subtle hot pixels, may include some false positives |

Expand **Advanced Settings** to fine-tune detection parameters manually.

## Privacy

**Your images never leave your device.**

This tool uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to read and write files directly on your computer. No servers, no uploads, no analytics, no tracking. The entire application runs in your browser as static files.

## Browser Support

Requires a modern browser with File System Access API support:

| Browser | Status |
|---------|--------|
| Chrome 86+ | Full support |
| Edge 86+ | Full support |
| Opera 72+ | Full support |
| Firefox | Limited — can read but not write back to disk |
| Safari | Limited — partial File System Access support |

## Troubleshooting

**"Permission denied" or file access errors:**
- Grant file system permissions when prompted
- Some browsers require re-granting permissions per session

**Processing seems slow:**
- Large images (6000+ pixels wide) take longer
- Processing happens in sequence to manage memory

**Detection missed obvious hot pixels:**
- Try the "High" sensitivity preset
- Use manual editing to add missed pixels

**Too many false positives:**
- Try the "Low" sensitivity preset
- Use manual editing to remove false detections

**Browser not supported:**
- Use Chrome, Edge, or Opera for full functionality
- Firefox users: you can analyze but cannot save to disk directly

## Known Limitations

- **RAW files not yet supported** — Convert to JPEG/PNG first
- **Very large sequences (1000+ frames)** — May be slow; consider processing in batches
- **Mobile browsers** — Not supported due to File System Access API requirements

## Tech Stack

- TypeScript + Vite + React
- Web Workers for background processing
- File System Access API for file I/O
- Deployed on Cloudflare Pages

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Development

<details>
<summary>Synthetic benchmark harness (for contributors)</summary>

Pixel Healer includes a dev-only synthetic corruption + evaluation harness for reproducible detection/healing experiments.

- Spec: [`docs/SYNTHETIC_HOT_PIXEL_GENERATOR_SPEC.md`](docs/SYNTHETIC_HOT_PIXEL_GENERATOR_SPEC.md)
- Open the dev panel during `pnpm dev` with `?dev=1` or `Ctrl+Shift+D`
- CI regression gate fails if F1 drops below `0.45`

**Local full-resolution tests:**

```bash
# Link your stacks into fixtures
./scripts/setup-local-fixtures.sh

# Run evaluation
pnpm test:local
```

See [`tests/fixtures/README.md`](tests/fixtures/README.md) for details.

</details>

## License

MIT — see [LICENSE](LICENSE)

---

*Made with care by the AxonArcade crew*
