#!/usr/bin/env bash
# Lowrider (/old_landing) model: Blender export + WebP optimize + install. ~5 min, mostly the Blender export.
# Usage: scripts/export-lowrider.sh [path/to/lowRider_scene.blend]
# Works from the SAVED .blend, not a File > Export GLB (that drops the per-action clips the page plays).
# Rebuilds the girl's slow wrist tap, exports at 24 fps with Draco, WebP-encodes color textures, checks the
# page's looping clips, keeps the previous model in models-src/, installs, then bumps ?v= in palmTreeDriveCar.mjs.
set -euo pipefail
cd "$(dirname "$0")/.."
BLEND="${1:-$HOME/Documents/Blender/lowRider_scene.blend}"
BLENDER="${BLENDER_PATH:-/Applications/Blender.app/Contents/MacOS/Blender}"
# Install over whatever model the page currently loads, so pointing the page at a new file needs no edit here.
MODEL=$(sed -nE "s#.*LOW_RIDER_MODEL_URL = '/models/([^?']+).*#\1#p" src/lib/palmTreeDriveCar.mjs)
[ -n "$MODEL" ] || { echo "could not read LOW_RIDER_MODEL_URL from src/lib/palmTreeDriveCar.mjs"; exit 1; }
BASE="${MODEL%.glb}"
RAW="models-src/${BASE}_raw.glb"
NEXT="models-src/${BASE}.next.glb"
PREV="models-src/${BASE}.prev.glb"
OUT="public/models/${MODEL}"
mkdir -p models-src
rm -f "$RAW"
"$BLENDER" -b "$BLEND" --python-exit-code 1 --python scripts/export-lowrider.py -- "$RAW" 2>&1 | grep -E "LOWRIDER_EXPORT|Traceback|Error" || true
[ -f "$RAW" ] || { echo "export failed: $RAW was not written"; exit 1; }
python3 scripts/optimize-lowrider.py "$RAW" "$NEXT" "$OUT"
[ -f "$OUT" ] && cp "$OUT" "$PREV"
mv "$NEXT" "$OUT"
# Bump only after the new bytes are in place, or the dev server caches the old file under the new URL.
sed -i '' -E "s|(${MODEL//./\\.}\?v=)[^']*|\1lowrider-$(date +%Y%m%d-%H%M)|" src/lib/palmTreeDriveCar.mjs
echo "done: $OUT (?v= bumped in src/lib/palmTreeDriveCar.mjs; previous model kept at $PREV)"
