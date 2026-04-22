#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$ROOT_DIR/tests/fixtures/local"
SOURCE_ROOT="${1:-$HOME/stacks}"

mkdir -p "$FIXTURE_ROOT"

for stack in stack1 stack2; do
  src="$SOURCE_ROOT/$stack"
  dst="$FIXTURE_ROOT/$stack"

  if [[ ! -d "$src" ]]; then
    echo "[warn] missing source stack: $src"
    continue
  fi

  ln -sfn "$src" "$dst"
  echo "[ok] $dst -> $src"
done

echo "done. run: pnpm test:local"
