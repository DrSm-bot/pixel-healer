# ✨ Pixel Healer

Browser-based hot pixel remover for astrophotography image sequences.

Pixel Healer detects and repairs stuck/hot pixels in time-lapse frame stacks — fully local in your browser (no uploads, no backend processing).

## Current Status

- ✅ **Phase 0** complete (project scaffold)
- ✅ **Phase 1** complete (folder scan + analysis pipeline)
- 🚧 **Next:** processing/export pipeline, manual review/edit workflow

## Implemented Features (as of now)

- Folder selection via **File System Access API**
- Image discovery for **JPG / JPEG / PNG**
- Deterministic filename sorting (numeric-aware)
- Analysis flow with configurable threshold + sample count
- Sample frame loading to `ImageData`
- Hot-pixel detection from sampled frames
- Preview overlay of detected hot pixels
- Basic edge-case hardening + recoverable UI errors

## Planned (next phases)

- Batch repair/export pipeline
- Manual add/remove hot pixels
- Before/after comparison
- Processing stats and UX polish
- RAW format support (future)

## Quick Start (local)

```bash
git clone https://github.com/DrSm-bot/pixel-healer.git
cd pixel-healer
pnpm install
pnpm dev
```

Build test:

```bash
pnpm run typecheck
pnpm run build
```

## Cloudflare Pages

Use these settings:

- **Build command:** `pnpm run build`
- **Build output directory:** `dist`
- **Install command:** `pnpm install --frozen-lockfile`
- **Node version:** `22` (recommended)

## Browser Support

Best experience on Chromium-based browsers due to File System Access API:

- ✅ Chrome / Edge / Brave
- ⚠️ Firefox/Safari: limited support for this workflow

## Privacy

All processing runs locally in the browser. Images are not uploaded by Pixel Healer.

## Tech Stack

- Vite + React 18 + TypeScript
- Zustand
- Tailwind CSS
- Web Worker (analysis)
- File System Access API

## License

MIT — see [LICENSE](LICENSE)
