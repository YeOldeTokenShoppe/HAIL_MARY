"use client";

// Shared votive-candle cosmetic presets + device-local preference storage.
// Extracted from src/app/page.js so both the landing page and the /main
// vigil panel can drive the SAME customization picker without duplicating
// the presets, storage keys, or the upload-compression pipeline. The
// Firestore side of prefs lives in lib/candleRitual.js (read/writeCandlePrefs);
// this module is the localStorage half plus the pure presets/helpers.

export const VOTIVE_IMAGE_STORAGE_PREFIX = "rl80:votiveImage:";
export const VOTIVE_TINT_STORAGE_PREFIX = "rl80:votiveTint:";

// Preset list for the votive image picker. `src: null` means "restore the
// baked-in texture that ships with the GLB". Anything else is a URL that
// the TextureLoader can resolve, including data: URLs from uploads.
export const VOTIVE_IMAGE_PRESETS = [
  // `src: null` restores the GLB's baked-in decal; `thumbnail` is used
  // only for the picker tile so we can show a preview that matches the
  // baked texture without having to load the full-resolution version
  // as the actual decal.
  {
    key: "default",
    src: null,
    thumbnail: "/goldGuadalupe.svg  ",
    label: "Guadalupe",
  },
  { key: "queenOfHearts", src: "/queenOfHearts1.jpg", label: "Queen of Hearts" },
  { key: "heart", src: "/images/sacreCoeur.webp", thumbnail: "/images/sacreCoeur.webp", label: "Heart" },
  { key: "MotherOfMemes", src: "/images/face.png", thumbnail: "/images/face.png", label: "Mother of Memes" },
  { key: "RL80Power", src: "/images/RL80_KNUCKLES.webp", thumbnail: "/images/RL80_KNUCKLES.webp", label: "RL80 Power" },
  { key: "Insight", src: "/images/ILLUMIN80_TATTOO.webp", thumbnail: "/images/ILLUMIN80_TATTOO.webp", label: "Insight" },
  { key: "GoingPlaces", src: "/images/I-80.webp", thumbnail: "/images/I-80.webp", label: "Going places" },
];

// A small curated palette for the wax tint, plus a "default" entry that
// restores the baked color. Users can also enter any hex via the color
// input. Values are multiplied, not replaced, so the wax keeps its
// authored shading; picking white = no visible tint.
export const VOTIVE_TINT_PRESETS = [
  { key: "default", hex: null, label: "Natural" },
  { key: "crimson", hex: "#b83b3b", label: "Crimson" },
  { key: "amber", hex: "#d49f3a", label: "Amber" },
  { key: "rose", hex: "#e57aa7", label: "Rose" },
  { key: "violet", hex: "#8b5fbf", label: "Violet" },
  { key: "jade", hex: "#0ef178", label: "Jade" },
  { key: "cyan", hex: "#14f7ff", label: "Cyan" },
];

export function readVotiveImage(userId) {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(VOTIVE_IMAGE_STORAGE_PREFIX + userId);
  } catch {
    return null;
  }
}
export function writeVotiveImage(userId, src) {
  if (!userId || typeof window === "undefined") return;
  try {
    // setItem throws QuotaExceeded when a large data: URL overflows the
    // 5MB bucket; swallow and let the picker UI surface the failure.
    // Null clears the preference (restores the baked-in texture).
    if (src == null) {
      window.localStorage.removeItem(VOTIVE_IMAGE_STORAGE_PREFIX + userId);
    } else {
      window.localStorage.setItem(VOTIVE_IMAGE_STORAGE_PREFIX + userId, src);
    }
  } catch {}
}

export function readVotiveTint(userId) {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(VOTIVE_TINT_STORAGE_PREFIX + userId);
  } catch {
    return null;
  }
}
export function writeVotiveTint(userId, hex) {
  if (!userId || typeof window === "undefined") return;
  try {
    if (hex == null) {
      window.localStorage.removeItem(VOTIVE_TINT_STORAGE_PREFIX + userId);
    } else {
      window.localStorage.setItem(VOTIVE_TINT_STORAGE_PREFIX + userId, hex);
    }
  } catch {}
}

// Compress a user-supplied image file into a portrait data: URL suitable
// for the votive decal. Three transforms:
//   1. Center-crop to the senora decal's ~2:3 portrait aspect so a square
//      selfie doesn't get UV-squished onto the candle.
//   2. Downscale to max 1024px on the long edge — enough to read cleanly on
//      the curved glass. A 1024px JPEG @0.88 is ~200-500KB, safely under
//      the Firestore doc cap (900KB).
//   3. Re-encode as JPEG @0.88 with high-quality smoothing so the downsample
//      doesn't introduce soft blur.
// Returns the compressed data: URL string. Throws on read/decode failure so
// the caller can surface an error. Caller owns persistence (localStorage +
// writeCandlePrefs) so it can handle QuotaExceeded / oversize-sync warnings.
export async function compressVotiveImage(file) {
  if (!file) throw new Error("no file");
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image decode failed"));
    el.src = dataUrl;
  });
  // Center-crop source rect to target aspect. If the image is wider than the
  // target ratio we trim width; if taller, we trim height.
  const TARGET_ASPECT = 2 / 3; // width / height — portrait
  const imgAspect = img.width / img.height;
  let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
  if (imgAspect > TARGET_ASPECT) {
    srcW = Math.round(img.height * TARGET_ASPECT);
    srcX = Math.round((img.width - srcW) / 2);
  } else if (imgAspect < TARGET_ASPECT) {
    srcH = Math.round(img.width / TARGET_ASPECT);
    srcY = Math.round((img.height - srcH) / 2);
  }
  const MAX = 1024;
  const scale = Math.min(1, MAX / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // Without these, Chrome/Safari use a cheap box filter that softens edges
  // noticeably on portrait crops. High-quality smoothing is a single-pass
  // lanczos-ish resample — worth the minor CPU cost for a one-shot upload.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.88);
}
