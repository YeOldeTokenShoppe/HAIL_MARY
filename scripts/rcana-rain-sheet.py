#!/usr/bin/env python3
"""Bake a static rain-on-glass sheet for an R-cana card.

    python3 scripts/rcana-rain-sheet.py public/TCG/rcana/el-tatuaje [--seed 7] [--density 1.0] [--scale 0.5] [--rivulets 14]

Reads scene/subject/prop.webp from the card folder, flattens them, and writes
rain.webp beside them: a transparent sheet of water drops, each one carrying
the small upside-down view of the art behind it (the refraction that makes
the codrops/"raindrops.js" effect read as water), a dark upper rim, a light
lower rim, a specular dot and a soft shadow. Drops are confined to the glass:
the hole in prop.webp's window frame. Re-run after the art changes, since the
refraction is baked from it. Needs numpy, scipy and Pillow.
"""
import argparse, math, os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("folder")
ap.add_argument("--seed", type=int, default=7)
ap.add_argument("--density", type=float, default=1.0)
ap.add_argument("--scale", type=float, default=0.5,
                help="drop size: 1.0 reads as a small porthole, 0.5 as a shop window")
ap.add_argument("--backdrop", default="#4a1d5a,#5c2466,#2a1430")  # top, 55%, bottom
ap.add_argument("--keep-clear", default="60.8,46.3,7.5",
                help="x%%,y%%,r%% of card width: no large drops here (the tattoo)")
ap.add_argument("--out", default=None)
ap.add_argument("--quality", type=int, default=90, help="WebP quality of the sheet")
ap.add_argument("--alpha-quality", type=int, default=100, help="WebP quality of the sheet's transparency")
ap.add_argument("--rainfall", type=int, default=0,
                help="also write rainfall.webp: this many streaks of falling rain, as a tile that loops (0 = skip)")
ap.add_argument("--rivulets", type=int, default=14, help="how many wet tracks run down the glass")
ap.add_argument("--rivulet-width", type=float, default=3.0,
                help="half-width of a track in sheet px (not affected by --scale)")
ap.add_argument("--rivulet-length", default="160,500", help="shortest,longest track in sheet px")
a = ap.parse_args()
rng = np.random.default_rng(a.seed)
SS = 3  # supersample
S = a.scale
N = a.density / S ** 1.5  # smaller drops, more of them

def load(n):
    return Image.open(os.path.join(a.folder, n + ".webp")).convert("RGBA")

scene, subject, prop = load("scene"), load("subject"), load("prop")
W, H = prop.size

# --- flatten the art the drops will refract -------------------------------
hexes = [tuple(int(h.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) for h in a.backdrop.split(",")]
t = np.linspace(0, 1, H)[:, None]
g = np.where(t < .55, np.array(hexes[0]) + (np.array(hexes[1]) - hexes[0]) * (t / .55),
             np.array(hexes[1]) + (np.array(hexes[2]) - hexes[1]) * ((t - .55) / .45))
flat = Image.fromarray(np.repeat(g[:, None, :], W, 1).astype(np.uint8)).convert("RGBA")
for im in (scene, subject, prop):
    flat.alpha_composite(im.resize((W, H)))
BG = np.asarray(flat.convert("RGB").resize((W * SS, H * SS), Image.BICUBIC), np.float32) / 255

# --- the glass: the hole in the window frame ------------------------------
alpha = np.asarray(prop)[..., 3]
lab, _ = ndimage.label(alpha < 40)
hole = lab == lab[H // 2, W // 2]
ys, xs = np.where(hole)
# rows/cols that are mostly hole give the pane's rectangle (ignores the sign and tray)
cols = np.where(hole.sum(0) > 0.5 * hole.sum(0).max())[0]
rows = np.where(hole.sum(1) > 0.5 * hole.sum(1).max())[0]
x0, x1, y0 = cols.min(), cols.max(), rows.min()
y1 = ys.max()
pane = np.zeros((H, W), np.float32)
pane[y0 + 4:y1 - 3, x0 + 4:x1 - 3] = 1
pane = ndimage.gaussian_filter(pane, 1.5)
print(f"pane: x {x0}-{x1}, y {y0}-{y1} of {W}x{H}")

out = np.zeros((H * SS, W * SS, 4), np.float32)  # premultiplied

def over(y, x, rgb, al):
    """composite a patch (straight rgb, alpha) over `out` at y,x (premultiplied store)"""
    h, w = al.shape
    ya, xa = max(0, y), max(0, x)
    yb, xb = min(out.shape[0], y + h), min(out.shape[1], x + w)
    if ya >= yb or xa >= xb: return
    s = (slice(ya - y, yb - y), slice(xa - x, xb - x))
    d = out[ya:yb, xa:xb]
    al_ = al[s][..., None]
    d[..., :3] = rgb[s] * al_ + d[..., :3] * (1 - al_)
    d[..., 3:] = al_ + d[..., 3:] * (1 - al_)

def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

def drop(cx, cy, r, tall=1.0):
    """cx, cy, r in sheet px"""
    cx, cy, r = cx * SS, cy * SS, r * SS
    pad = int(r * 1.7 * tall + 4)
    yy, xx = np.mgrid[-pad:pad + 1, -pad:pad + 1].astype(np.float32)
    # soft shadow, down and a touch right
    sh = np.exp(-(((xx - .12 * r) / (r * 1.02)) ** 2 + ((yy - .22 * r) / (r * tall * 1.02)) ** 2) ** 2.2)
    over(int(cy) - pad, int(cx) - pad, np.zeros((*sh.shape, 3), np.float32), sh * (0.34 if r > 5 * S * SS else 0.2))
    ny = yy / (r * tall)
    nx = xx / (r * (1 - 0.16 * np.clip(-ny, 0, 1) * (tall > 1.02)))  # teardrop: narrower on top
    th = np.arctan2(ny, nx)
    wob = 1 + 0.07 * np.sin(2 * th + rng.uniform(0, 6.3)) + 0.045 * np.sin(3 * th + rng.uniform(0, 6.3))
    rho = np.hypot(nx, ny) / wob
    inside = rho < 1.02
    # refraction: an inverted, minified view of the art around the drop
    view = r * 3.0 + 26 * S * SS
    k = rho ** 1.25
    sx = np.clip(cx - nx / np.maximum(rho, 1e-4) * k * view, 0, BG.shape[1] - 1).astype(int)
    sy = np.clip(cy - ny / np.maximum(rho, 1e-4) * k * view, 0, BG.shape[0] - 1).astype(int)
    rgb = BG[sy, sx] * 1.12 + 0.02
    rim = smooth(0.62, 1.0, rho)
    rgb = rgb * (1 - rim * (0.72 * np.clip(0.55 - ny, 0, 1)))[..., None]            # dark upper rim
    rgb = rgb + (rim * 0.5 * np.clip(ny, 0, 1) ** 1.3)[..., None]                    # light lower rim
    spec = np.exp(-(((nx + .34) / .17) ** 2 + ((ny + .42) / .13) ** 2))
    rgb = rgb + (spec * (0.95 if r > 3 * S * SS else 0.6))[..., None]
    al = (1 - smooth(0.9, 1.0, rho)) * inside * 0.97
    over(int(cy) - pad, int(cx) - pad, np.clip(rgb, 0, 1), al)

# --- placement ------------------------------------------------------------
kx, ky, kr = [float(v) for v in a.keep_clear.split(",")]
kx, ky, kr = kx / 100 * W, ky / 100 * H, kr / 100 * W
placed = []
def free(x, y, r, gap=1.0):
    if not placed: return True
    P = np.asarray(placed[-4000:] if r < 1 else placed)  # specks only check recent neighbours
    return bool(np.all((x - P[:, 0]) ** 2 + (y - P[:, 1]) ** 2 > ((r + P[:, 2]) * gap) ** 2))
def rand_xy(m):
    return rng.uniform(x0 + m, x1 - m), rng.uniform(y0 + m, y1 - m)

lanes = []
# rivulets: continuous wet tracks. Each is a ridge of water, so it bends the
# art sideways across its width (a cylinder lens), darkens at both edges and
# carries a thin highlight; it meanders in short jogs, swells and thins along
# its length, wipes the small drops out of its lane and ends in a fat drop.
def rivulet(xs0, yt, yb, wd):
    n = int(yb - yt) + 1
    ys_ = np.arange(n, dtype=np.float32)
    slope = np.zeros(n, np.float32); i = 0
    while i < n:
        seg = int(rng.uniform(14, 70))
        slope[i:i + seg] = rng.choice([0, 0, rng.uniform(-.45, .45)])
        i += seg
    xpath = xs0 + np.cumsum(ndimage.gaussian_filter1d(slope, 5))
    t = ys_ / max(n - 1, 1)
    wnoise = ndimage.gaussian_filter1d(rng.random(n).astype(np.float32), 9) * 2
    width = wd * (0.5 + 0.6 * wnoise) * smooth(0, 0.14, t) * (0.85 + 0.3 * t)
    # supersampled patch
    m = int(wd * 3 + 4)
    X0, X1 = int(xpath.min()) - m, int(xpath.max()) + m
    hh, ww = n * SS, (X1 - X0) * SS
    row = np.arange(hh) / SS
    cx = np.interp(row, ys_, xpath)[:, None]
    wv = np.maximum(np.interp(row, ys_, width), 1e-3)[:, None]
    xx = (X0 + (np.arange(ww) + .5) / SS)[None, :]
    nx = (xx - cx) / wv
    an = np.abs(nx)
    view = wv * 3.2 + 8
    sx = np.clip((cx - np.sign(nx) * an ** 1.2 * view) * SS, 0, BG.shape[1] - 1).astype(int)
    sy = np.clip(((yt + row)[:, None] + 0 * xx) * SS, 0, BG.shape[0] - 1).astype(int)
    rgb = BG[sy, sx] * 1.1 + 0.02
    rim = smooth(0.5, 1.0, an)
    rgb = rgb * (1 - 0.6 * rim)[..., None] + (np.exp(-((nx + .38) / .2) ** 2) * 0.42)[..., None]
    al = (1 - smooth(0.78, 1.0, an)) * 0.9 * (wv > 0.25)
    over(int(yt * SS), X0 * SS, np.clip(rgb, 0, 1), al.astype(np.float32))
    return (lambda y: float(np.interp(y, yt + ys_, xpath))), xpath[-1]

lo, hi = [float(v) for v in a.rivulet_length.split(",")]
for _ in range(a.rivulets * 6):
    if len(lanes) >= a.rivulets: break
    xs0 = rng.uniform(x0 + 25, x1 - 25)
    yt = y0 + 4 if rng.random() < .45 else rng.uniform(y0 + 10, y0 + (y1 - y0) * .55)
    yb = min(y1 - 14, yt + rng.uniform(lo, hi))
    wd = a.rivulet_width * rng.uniform(0.7, 1.25)
    if yb - yt < lo * .6: continue
    # keep off the tattoo and off other tracks
    if abs(xs0 - kx) < kr + 22 and yt < ky + kr and yb > ky - kr: continue
    if any(abs(xs0 - p(min(max(yt, lt), lb))) < 38 and yt < lb and yb > lt for p, lt, lb, c in lanes): continue
    path, xe = rivulet(xs0, yt, yb, wd)
    lanes.append((path, yt, yb + wd * 3, wd * 2.2 + 3))
    hr = wd * rng.uniform(1.7, 2.3)
    placed.append((xe, yb + hr * .4, hr)); drop(xe, yb + hr * .4, hr, 1.3)

# trails: a drop that ran, leaving a wiped lane and a string of beads above it
for _ in range(int(round(6 * a.density / S))):
    x, yb = rand_xy(30)
    L = rng.uniform(110, 330)
    yt = max(y0 + 12, yb - L)
    r = rng.uniform(11, 16) * S
    if math.hypot(x - kx, yb - ky) < kr + r or not free(x, yb, r, 1.6): continue
    ph, amp = rng.uniform(0, 6.3), rng.uniform(2, 6) * S ** .5
    path = lambda y, x=x, ph=ph, amp=amp, yb=yb: x + amp * math.sin((yb - y) / 37 + ph) * min(1, (yb - y) / 40)
    lanes.append((path, yt, yb, 9 * S))
    y = yb - r * 1.5
    while y > yt:
        br = rng.uniform(1.4, 3.6) * S * (0.6 + 0.4 * (y - yt) / (yb - yt))
        placed.append((path(y), y, br)); drop(path(y), y, br, 1.0 + rng.uniform(0, .5))
        y -= br * rng.uniform(2.2, 5.5)
    placed.append((x, yb, r)); drop(x, yb, r, 1.28)

def in_lane(x, y, r):
    return any(yt - 4 < y < yb and abs(x - p(y)) < c + r for p, yt, yb, c in lanes)

def scatter(n, rlo, rhi, gap, tall, big=False):
    made = tries = 0
    while made < n and tries < n * 40:
        tries += 1
        r = (rlo + (rhi - rlo) * rng.random() ** 1.8) * S
        x, y = rand_xy(r + 3)
        if big and math.hypot(x - kx, y - ky) < kr + r: continue
        if in_lane(x, y, r) or not free(x, y, r, gap): continue
        placed.append((x, y, r)); drop(x, y, r, tall if r > 6 * S else 1.0 + rng.uniform(0, .08)); made += 1

area = (x1 - x0) * (y1 - y0) / 1e6
scatter(int(46 * area * N), 8, 19, 1.5, 1.16, big=True)
scatter(int(150 * area * N), 3.5, 7.5, 1.35, 1.0, big=True)
scatter(int(1150 * area * N), 1.1, 3.4, 1.15, 1.0)

# --- write ----------------------------------------------------------------
al = out[..., 3:]
rgb = np.where(al > 1e-4, out[..., :3] / np.maximum(al, 1e-4), 0)
img = Image.fromarray((np.clip(np.concatenate([rgb, al], -1), 0, 1) * 255).astype(np.uint8), "RGBA")
img = img.resize((W, H), Image.LANCZOS)
arr = np.asarray(img).copy()
arr[..., 3] = (arr[..., 3] * pane).astype(np.uint8)
dst = a.out or os.path.join(a.folder, "rain.webp")
Image.fromarray(arr, "RGBA").save(dst, quality=a.quality, alpha_quality=a.alpha_quality, method=6)
print(f"{len(placed)} drops -> {dst} ({os.path.getsize(dst) // 1024} KB)")

# --- falling rain: a second sheet, for the air in front of the window ------
# Thin streaks in three depths: far (short, faint, sharp), middle, and a few
# near ones (long, wide, soft). Drawn VERTICAL and wrapped top to bottom, so
# the sheet tiles and could be scrolled in a loop. Not used by any card at
# present (The Tattoo went with wet glass only); off unless --rainfall is set.
if a.rainfall:
    R, PAD = 2, 60
    sheet = np.zeros((H * R, W * R), np.uint8)
    for frac, ln, wd, al, blur in ((.62, (14, 40), 1.0, (30, 85), 0.6),
                                   (.30, (35, 85), 1.5, (40, 105), 1.0),
                                   (.08, (80, 150), 2.4, (35, 80), 2.2)):
        lay = Image.new("L", (W * R, (H + 2 * PAD) * R), 0)
        d = ImageDraw.Draw(lay)
        for _ in range(int(a.rainfall * frac)):
            x, y = rng.uniform(4, W - 4) * R, rng.uniform(0, H) * R
            L = rng.uniform(*ln) * R
            f = int(rng.uniform(*al))
            for wrap in (-H * R, 0, H * R):
                d.line([(x, y + wrap + PAD * R), (x, y + wrap + PAD * R + L)], fill=f, width=max(1, round(wd * R / 1.4)))
        lay = lay.filter(ImageFilter.GaussianBlur(blur * R / 2)).crop((0, PAD * R, W * R, (H + PAD) * R))
        sheet = np.maximum(sheet, np.asarray(lay))
    sheet = Image.fromarray(sheet).resize((W, H), Image.LANCZOS)
    rain = Image.merge("RGBA", (*[Image.new("L", (W, H), v) for v in (226, 236, 255)], sheet))
    rdst = os.path.join(os.path.dirname(dst), "rainfall.webp")
    rain.save(rdst, quality=a.quality, alpha_quality=a.alpha_quality, method=6)
    print(f"{a.rainfall} streaks -> {rdst} ({os.path.getsize(rdst) // 1024} KB)")
