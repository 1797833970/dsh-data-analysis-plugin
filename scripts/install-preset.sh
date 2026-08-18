#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
SRC="$ROOT/deferred/agent-preset-data-analysis"
DSH_HOME_VALUE="${DSH_HOME:-$HOME/.dsh}"
DEST="$DSH_HOME_VALUE/.agent-presets/data-analysis"

mkdir -p "$DEST"
cp "$SRC/agent.cordis.yml" "$DEST/agent.cordis.yml"
cp "$SRC/preset.yml" "$DEST/preset.yml"

echo "Installed data-analysis preset to $DEST"
