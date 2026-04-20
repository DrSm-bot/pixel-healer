# Synthetic Hot Pixel Generator — Spec

**Project:** `pixel-healer`  
**Purpose:** Dev-only tool to inject realistic, reproducible hot pixels into clean night-sky time-lapse frames so we can benchmark and optimize detection + healing algorithms against ground truth.

---

## 1. Goals & Non-Goals

### Goals
- Produce corrupted image sequences from clean input with a **known ground-truth hot-pixel map**.
- Model realistic hot-pixel behavior (stuck, warm, intensity-dependent, per-channel).
- Be **deterministic** given a seed (regression-safe).
- Integrate as a **dev-only module** (excluded from production bundle).
- Provide both a **programmatic API** and a **hidden dev UI panel**.
- Expose an **evaluation harness** with precision/recall/F1, PSNR/SSIM, and runtime metrics.

### Non-Goals
- Not a RAW/Bayer simulator (v1 injects into demosaiced JPG/PNG frames).
- Not intended to ship to end users.
- Not a full sensor-noise simulator (amp glow, banding, shot noise out of scope for v1).

---

## 2. Placement in the Project

```text
src/
├── dev/
│   └── hotPixelGen/
│       ├── index.ts
│       ├── generator.ts
│       ├── mask.ts
│       ├── rng.ts
│       ├── profiles.ts
│       ├── eval.ts
│       ├── worker.ts
│       ├── fixtures/
│       │   ├── typical-seed-1337.mask.json
│       │   └── nasty-seed-9001.mask.json
│       └── __tests__/
│           └── generator.test.ts
└── dev/
    └── DevPanel.tsx
```

**Production exclusion rule:** imports from `src/dev/**` must be gated behind `import.meta.env.DEV` and/or dynamic `import()` so Vite can tree-shake dev code out of production builds.

---

## 3. Hot Pixel Model

| Field | Type | Notes |
|---|---|---|
| `x`, `y` | `number` (int) | Fixed coordinates across sequence |
| `channel` | `'r' \| 'g' \| 'b' \| 'rgb'` | Affected channel(s) |
| `type` | `'stuck' \| 'warm' \| 'flicker'` | Pixel behavior class |
| `intensity` | `number` (0–255) | Stuck: absolute value, Warm: additive offset |
| `activationThreshold` | `number` (0–255) | Corrupt only when underlying value is below this threshold |
| `flickerProbability` | `number` (0–1) | Per-frame manifestation probability for flicker |

### Type behavior
- **stuck**: pixel reads at/near fixed high value regardless of scene.
- **warm**: pixel is biased high (`min(255, original + intensity)`) and most visible in dark regions.
- **flicker**: stuck-like behavior but manifests only on subset of frames.

### Default realistic mix (overridable)
- Types: 60% warm, 30% stuck, 10% flicker
- Channels: ~33% R / ~33% G / ~33% B / <2% RGB
- Warm intensity: long-tail distribution (mean ~40, clamped 10–200)
- Stuck intensity: mostly 255, ~20% in 180–254

---

## 4. Public API

```ts
export interface HotPixel {
  x: number;
  y: number;
  channel: 'r' | 'g' | 'b' | 'rgb';
  type: 'stuck' | 'warm' | 'flicker';
  intensity: number;
  activationThreshold: number;
  flickerProbability: number;
}

export interface HotPixelMask {
  schemaVersion: 1;
  width: number;
  height: number;
  pixels: HotPixel[];
  seed: number;
  generatedAt: string; // ISO timestamp
  profileName?: string;
}

export interface GeneratorConfig {
  width: number;
  height: number;
  seed: number;
  density: number; // hot pixels per megapixel (default: 150)
  typeMix?: { stuck: number; warm: number; flicker: number };
  channelMix?: { r: number; g: number; b: number; rgb: number };
  warmIntensityMean?: number; // default: 40
  stuckIntensityMax255Prob?: number; // default: 0.8
  flickerProbabilityRange?: [number, number]; // default: [0.3, 0.9]
}

export function generateMask(config: GeneratorConfig): HotPixelMask;
export function applyMask(frame: ImageData, mask: HotPixelMask, frameIndex: number): ImageData;
export function corruptSequence(
  frames: ImageData[],
  config: GeneratorConfig
): { corrupted: ImageData[]; mask: HotPixelMask };

export function serializeMask(mask: HotPixelMask): string;
export function deserializeMask(json: string): HotPixelMask;

export const profiles: Record<'easy' | 'typical' | 'nasty' | 'pathological', Partial<GeneratorConfig>>;
```

### Determinism requirements
- Same `(config, frameIndex)` ⇒ byte-identical output.
- Seeded PRNG only (`mulberry32` or equivalent).
- No `Math.random()` in generation/apply paths.
- Flicker decision from deterministic hash `(seed, pixelIndex, frameIndex)`.

---

## 5. Difficulty Profiles

| Profile | Density (px/MP) | Notes |
|---|---|---|
| `easy` | 50 | Mostly stuck-at-high pixels |
| `typical` | 150 | Baseline realistic profile |
| `nasty` | 400 | High-density warm-dominant stress |
| `pathological` | 800 | Extreme stress (dense + flicker-heavy) |

---

## 6. Dev UI Panel (dev-only)

Access via `Ctrl+Shift+D` or `?dev=1`, mounted only in `import.meta.env.DEV`.

Features:
1. Load clean frames via folder picker.
2. Choose profile/seed/custom config.
3. Generate corrupted sequence.
4. Side-by-side preview: clean ↔ corrupted ↔ detected overlay ↔ healed ↔ diff.
5. Run evaluation and show metrics.
6. Export corrupted frames + mask JSON.

---

## 7. Evaluation Harness

```ts
export interface EvalReport {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;

  psnrVsClean: number;
  ssimVsClean: number;
  maxAbsErrorVsClean: number;

  detectionMs: number;
  healingMs: number;
  framesProcessed: number;

  perType: Record<'stuck' | 'warm' | 'flicker', { precision: number; recall: number; f1: number }>;
  perChannel: Record<'r' | 'g' | 'b' | 'rgb', { precision: number; recall: number; f1: number }>;
}

export function evaluate(opts: {
  cleanFrames: ImageData[];
  mask: HotPixelMask;
  detect: (frames: ImageData[]) => Promise<Set<string>>; // "x,y"
  heal: (frames: ImageData[], detected: Set<string>) => Promise<ImageData[]>;
}): Promise<EvalReport>;
```

The harness remains decoupled from implementation so detection/healing variants can be A/B tested.

---

## 8. Implementation Notes

- O(mask-size) injection loops where possible; run heavy sequence ops in worker.
- Avoid border pixels (`x/y` at edge) in v1 masks so interpolation tests stay stable.
- Use integer-safe pixel math to avoid contaminating clean/corrupted diffs.
- Keep a few canonical fixture masks in repo for reproducible CI.

---

## 9. Testing Plan

Unit tests:
- deterministic mask generation per seed
- different seeds produce different masks
- deterministic apply per `(mask, frameIndex)`
- non-mask pixels unchanged
- warm clamp behavior
- flicker manifests within statistical expectation
- serialization round-trip fidelity
- perfect-oracle detector yields precision=1, recall=1 in harness

Integration test:
- fixed clean fixture + `typical` profile + fixed seed
- run current detection pipeline
- assert F1 above baseline threshold

---

## 10. CI Regression Gate (recommended)

Add a baseline guard in CI, for example:
- `typical` profile F1 must remain >= configured floor
- runtime for N-frame benchmark must stay under budget

This catches silent algorithm regressions early.

---

## 11. Suggested Rollout

1. Implement `rng.ts` + `mask.ts` + `generator.ts` + unit tests.
2. Implement `evaluate()` and capture baseline metrics.
3. Build dev panel last for visual inspection.

---

## 12. Open Questions

- Do we want hot columns in v1 or defer?
- Keep fixtures in this repo or split into dedicated fixtures repo?
- Should v1 include optional light clustering (simple Gaussian-convolved sampling), or keep uniform placement first?
