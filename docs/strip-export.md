# Re-exporting the Commercial Strip (boardwalk) — full recipe

Whenever you change `boardwalk2.blend`, the runtime needs TWO fresh runtime
files — the KTX2 build is what the site actually loads, the webp build is the
`?strip=webp` fallback. Four steps:
**export → optimize (webp) → encode (KTX2) → bump the tag**.

> **Skipping step 3 is the classic failure.** The site loads
> `CommercialStrip3_opt2k_ktx2.glb`. Rebuild only the webp file and the strip
> silently stays on the previous export — and it will look CORRECT locally
> (the dev server revalidates every request) while production serves the stale
> CDN copy. That is exactly what happened on 2026-09-02.

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

## 3. Encode the KTX2 build (THE FILE THE SITE LOADS)

The webp command in step 2 does **not** touch this file. Every texture becomes
Basis/ETC1S: ≈21 MB of GPU texture memory for the strip against ≈198 MB for
webp, and no decode on load.

Staged passes are needed because the `ktx` encoder cannot read webp and
`optimize` cannot write PNG. `$S` is any scratch dir.

```bash
cd ~/HAIL_MARY; S=/tmp/strip; mkdir -p $S
npx --yes @gltf-transform/cli optimize public/models/CommercialStrip3.glb $S/a.glb \
  --instance false --simplify false --flatten false --join false \
  --palette false --prune-solid-textures false --prune-attributes false \
  --compress false --texture-compress false --texture-size 2048
npx --yes @gltf-transform/cli png    $S/a.glb $S/b.glb --formats "*"
npx --yes @gltf-transform/cli resize $S/b.glb $S/c.glb --pattern "BOARDWALK_ATLAS*" --width 2048 --height 2048
PATH="$HOME/.local/ktx/bin:$PATH" DYLD_LIBRARY_PATH="$HOME/.local/ktx/lib" \
  npx --yes @gltf-transform/cli etc1s $S/c.glb $S/d.glb
npx --yes @gltf-transform/cli webp    $S/d.glb $S/e.glb      # anything ktx skipped
npx --yes @gltf-transform/cli meshopt $S/e.glb public/models/CommercialStrip3_opt2k_ktx2.glb
```

The `ktx` encoder (v4.4.2) lives in `~/.local/ktx/bin` and is NOT on `PATH` —
that is what the `PATH=`/`DYLD_LIBRARY_PATH=` prefix is for. Do not put the
command in a shell variable under zsh; it will not word-split and every stage
fails silently.

### Verify the two builds agree

```bash
node -e '
const fs=require("fs");
const rd=p=>{const b=fs.readFileSync(p);return JSON.parse(b.slice(20,20+b.readUInt32LE(12)).toString());};
const a=rd("public/models/CommercialStrip3_opt2k.glb");
const k=rd("public/models/CommercialStrip3_opt2k_ktx2.glb");
const nm=g=>g.nodes.map(x=>x.name||"").sort().join("|");
console.log("nodes  webp/ktx2:", a.nodes.length, k.nodes.length);
console.log("meshes webp/ktx2:", a.meshes.length, k.meshes.length);
console.log("node names identical:", nm(a)===nm(k));
console.log("ktx2 textures basisu:", k.textures.filter(t=>t.extensions&&t.extensions.KHR_texture_basisu).length, "/", k.textures.length, "(want all)");
'
```

Node counts and names must match the webp build, and every KTX2 texture must be
Basis. Then check `/ktx2-test.html` in Safari or Chrome.

---

## 4. Bump the cache tag (bust the CDN)

Steps 2 and 3 already wrote both runtime files. The one manual step: **bump the
version tag** so browsers and the CDN don't serve a stale cached copy.

ONE tag now covers BOTH builds — they are two encodings of the same export, so a
rebuild invalidates both. In `src/components/CommercialStrip.jsx`:

```js
const STRIP_MODEL_V = "9";
```

Bump the number: `"10"`, `"11"`, … on every re-export. Both URLs interpolate it,
so they can never drift apart.

> **Historical note:** these were once two independent literals
> (`?v=webp8` / `?v=ktx2`). Bumping only the webp one changed nothing, because
> the site fetches the KTX2 URL — its key never moved and the CDN kept serving
> the old file. Do not split them back apart.

Then hard-reload the page (the version bump also handles this for other users).

---

## Notes

- **This export supersedes the code-side deck-widening** — moving the props
  back in Blender for walking room is the better fix; `STRIP_EXTEND = 1.4` in
  `PlayerWalker.jsx` can stay (it just allows a bit more outer walking range,
  harmless) or drop back to `1.0` if the deck is narrower again.
- **KTX2 ships (since 2026-09-02):** `CommercialStrip3_opt2k_ktx2.glb` is the
  default `STRIP_MODEL`; the webp build stays on disk as the `?strip=webp`
  fallback. Building it is **step 3** — it used to live down here as a note,
  which is precisely how it got skipped on a re-export. There is deliberately
  no second copy of the commands here: one recipe, one place.
