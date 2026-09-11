#!/usr/bin/env bash
# Pumpjack rig: Blender export + optimize. Usage: scripts/export-rig.sh [path/to/HMPC_Rig_Discovery_Pass_chiralL.blend]
# Afterwards bump the ?v= on allProps4.glb in OilVoxelGrid.jsx (FIELD_RIG_GLB) and RigScene.jsx (RIG_GLB) —
# only once this script has finished, or the dev server caches the old bytes under the new URL.
set -euo pipefail
cd "$(dirname "$0")/.."
BLEND="${1:-$HOME/Documents/Codex/2026-09-05/fo-x20/outputs/HMPC_Rig_Discovery_Pass_chiralL.blend}"
BLENDER="${BLENDER_PATH:-/Applications/Blender.app/Contents/MacOS/Blender}"
"$BLENDER" -b "$BLEND" --python scripts/export-rig.py 2>&1 | grep -E "RIG_EXPORT|Traceback|Error" || true
RIG_EXCLUDE=OLD_Pipe_01 node scripts/optimize-rig.mjs models-src/oilJack_allProps4_raw.glb public/models/oilJack_fancy_allProps4.glb 2>&1 | grep -v objc
echo "done: public/models/oilJack_fancy_allProps4.glb (now bump ?v= in both loaders)"
