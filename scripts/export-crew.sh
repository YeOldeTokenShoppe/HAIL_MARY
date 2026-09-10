#!/usr/bin/env bash
# Crew character: Blender export + optimize. Usage: scripts/export-crew.sh [path/to/HMPC_Crew_Goblin.blend]
set -euo pipefail
cd "$(dirname "$0")/.."
BLEND="${1:-$HOME/Documents/Codex/2026-09-05/fo-x20/outputs/HMPC_Crew_Goblin.blend}"
BLENDER="${BLENDER_PATH:-/Applications/Blender.app/Contents/MacOS/Blender}"
"$BLENDER" -b "$BLEND" --python scripts/export-crew.py 2>&1 | grep -E "CREW_EXPORT|Traceback|Error" || true
RIG_TEX_SIZE="${RIG_TEX_SIZE:-512}" RIG_RESAMPLE="${RIG_RESAMPLE:-1}" node scripts/optimize-rig.mjs models-src/crew_goblin_raw.glb public/models/crew_goblin.glb 2>&1 | grep -v objc
echo "done: public/models/crew_goblin.glb (bump ?v= on the loader when it exists)"
