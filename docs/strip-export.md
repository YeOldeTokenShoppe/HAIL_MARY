# Re-exporting the Commercial Strip (boardwalk) — full recipe

Whenever you change `boardwalk2.blend`, the runtime needs a fresh
`CommercialStrip3_opt2k.glb`. Three steps: **export → optimize → deploy**.

---

## 1. Export the base GLB from Blender

`File ▸ Export ▸ glTF 2.0 (.glb/.gltf)`, save as
`~/HAIL_MARY/public/models/CommercialStrip3.glb` (overwrite the base).

Settings that matter (the rest can stay default):

| Setting | Value | Why |
|---|---|---|
| **Format** | glTF Binary (.glb) | single file |
| **Include ▸ Visible Objects** | ✓ | the `glTF_not_exported` collection is skipped automatically; keep the Icospheres hidden |
| **Include ▸ Cameras** | ✗ | not needed |
| **Include ▸ Punctual Lights** | ✓ | the wagon KHR lights must ship |
| **Transform ▸ +Y Up** | ✓ | default |
| **Data ▸ Mesh ▸ Apply Modifiers** | ✓ | |
| **Data ▸ Material ▸ Materials** | Export | |
| **Data ▸ Mesh ▸ Compression (Draco)** | ✗ **OFF** | the optimize step below does compression — leave it off here |
| **Data ▸ Custom Properties** | ✓ | (harmless, matches prior exports) |

Select nothing first (Alt-A) so "Visible Objects" governs the set, not selection.

The base will be **~11–15 MB uncompressed** — that's expected; step 2 shrinks it.

**Export gotchas (from past pain):**
- If a re-export ever ships a mesh in bind pose / a missing clip: with
  *Selected Objects*, the **armature object itself** must be selected, not just
  its mesh. (Not an issue with *Visible Objects*.)
- The strip is static geometry — no armatures — so animation settings don't
  matter here. (Vendor **characters** are separate GLBs, not this file.)

---

## 2. Optimize (produces the runtime file)

One command. It preserves every named node — critical: the spotlight rig,
walker collision, bull saddle, curtain, and vendor anchors are all found **by
name**, and a plain `optimize` (or instancing) would collapse them.

```bash
cd ~/HAIL_MARY
npx --yes @gltf-transform/cli optimize \
  public/models/CommercialStrip3.glb \
  public/models/CommercialStrip3_opt2k.glb \
  --instance false --simplify false --flatten false --join false \
  --palette false --prune-solid-textures false --prune-attributes false \
  --texture-compress webp --texture-size 2048
```

**Flag notes:** `--instance false` is MANDATORY (instancing wipes the 12
`Spotlight_Bulb` nodes → no beams). `--texture-size 2048` caps textures at 2K.
Never use the bare `optimize` without these flags.

### Verify it didn't break (paste this after):

```bash
node -e '
const fs=require("fs");
const b=fs.readFileSync("public/models/CommercialStrip3_opt2k.glb");
const g=JSON.parse(b.slice(20,20+b.readUInt32LE(12)).toString());
const n=g.nodes.map(x=>x.name);
const crit=["Boardwalk","Steps","Step1","SM_Prop_Mechanical_Bull_01_Saddle_01","Photo_booth_Curtain","FortuneTeller_Wagon_Empty","Bull_Tent"];
console.log("size MB:", (b.length/1048576).toFixed(2));
console.log("bulbs:", n.filter(x=>/Spotlight_Bulb/.test(x||"")).length, "(want 12)");
for (const c of crit) console.log((n.includes(c)?"OK ":"MISSING ")+c);
'
```

All criticals should print `OK` and bulbs should be `12`.

---

## 3. Deploy (bust the cache)

The optimize step already wrote to the runtime file
(`CommercialStrip3_opt2k.glb`). The one manual step: **bump the version tag**
so browsers don't serve a stale cached copy.

In `src/components/CommercialStrip.jsx`, find:

```js
const STRIP_MODEL = "/models/CommercialStrip3_opt2k.glb?v=webp2";
```

Bump the number: `?v=webp3`, then `?v=webp4`, etc. every re-export.

Then hard-reload the page (the version bump also handles this for other users).

---

## Notes

- **This export supersedes the code-side deck-widening** — moving the props
  back in Blender for walking room is the better fix; `STRIP_EXTEND = 1.4` in
  `PlayerWalker.jsx` can stay (it just allows a bit more outer walking range,
  harmless) or drop back to `1.0` if the deck is narrower again.
- **KTX2 (future, for iOS memory):** a KTX2/Basis variant of the strip is
  staged (`CommercialStrip3_opt2k_ktx2.glb`) with the loader wired but not yet
  verified. When ready, the optimize command becomes
  `--texture-compress ktx2 --texture-size 2048` **run on a PNG-textured base**
  (the `ktx` encoder can't read webp). The `ktx` CLI is staged at
  `~/.local/ktx/bin` — prefix the command with
  `PATH="$HOME/.local/ktx/bin:$PATH" DYLD_LIBRARY_PATH="$HOME/.local/ktx/lib"`.
  See `src/lib/ktx2.js`. Ship webp for now.
