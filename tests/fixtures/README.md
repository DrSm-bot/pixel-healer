# Local Full-Resolution Fixture Stacks

This project supports **local-only** full-resolution fixture stacks for realistic synthetic-harness evaluation.

## Why local-only?

Real astrophotography frames can be large. Keeping those fixtures out of git avoids repository bloat while still enabling realistic local benchmark runs.

## Directory layout

```text
tests/fixtures/
├── local/                 # gitignored fixture root
│   ├── stack1/            # your full-res frames (jpg/png/webp)
│   └── stack2/
└── README.md
```

`tests/fixtures/local/` is ignored by git (except `.gitkeep`).

## Quick setup

If you already have stacks in `~/stacks/stack1` and `~/stacks/stack2`:

```bash
./scripts/setup-local-fixtures.sh
```

This creates symlinks into `tests/fixtures/local/`.

## Run local harness evaluation

```bash
pnpm test:local
```

> If you see an error about `canvas`, build/install native canvas support first (the local test decodes real image files through that dependency).

The local test evaluates each detected stack directory across profiles:
- `easy`
- `typical`
- `nasty`
- `pathological`

For each profile it logs precision/recall/F1, PSNR, SSIM, and runtime.

## Optional environment variables

- `PIXEL_HEALER_LOCAL_FIXTURES` — override fixture root (default: `tests/fixtures/local`)
- `PIXEL_HEALER_LOCAL_SEED` — seed (default: `1337`)
- `PIXEL_HEALER_LOCAL_THRESHOLD` — detection threshold (default: `240`)
- `PIXEL_HEALER_LOCAL_MIN_CONSISTENCY` — min consistency (default: `0.9`)
