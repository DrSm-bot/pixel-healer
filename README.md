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
2. **Analyze** — The tool samples the first N frames to find pixels that are consistently bright (hot pixels stay put, stars move!)
3. **Preview** — See detected hot pixels highlighted before committing
4. **Fix & Export** — Apply the fix to all frames and save to a new folder

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

The algorithm:
1. Samples multiple frames from your sequence
2. For each pixel position, checks if it's consistently above a brightness threshold
3. Pixels that are "stuck bright" across all sampled frames = hot pixels
4. Repairs by interpolating from neighboring pixels

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

## Dev: Synthetic Benchmark Harness (planned)

To improve detection/healing quality with reproducible ground truth, we are adding a dev-only synthetic corruption + evaluation harness.

- Spec: [`docs/SYNTHETIC_HOT_PIXEL_GENERATOR_SPEC.md`](docs/SYNTHETIC_HOT_PIXEL_GENERATOR_SPEC.md)
- Scope: deterministic hot-pixel injection, mask fixtures, evaluation metrics (precision/recall/F1, PSNR/SSIM), CI regression gate
- Shipping policy: dev-only (`src/dev/**`), excluded from production bundle

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE)

---

*Made with 🦞 by the AxonArcade crew*
