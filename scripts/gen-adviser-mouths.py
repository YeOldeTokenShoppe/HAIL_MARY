#!/usr/bin/env python3
"""Generate the /main adviser mouth sprites from the existing figure art.

Each output is a FULL-SIZE transparent canvas matching its body.png, so it
registers automatically at any rendered scale (see MOUTH_ART's art contract in
src/app/main/page.js).

  closed — the original mouth region lifted verbatim from body.png, so the
           resting frame matches the baked art exactly.
  mid/open — the baked mouth erased, then an opening drawn ALONG THE MOUTH'S OWN
           AXIS, measured from the art rather than hand-placed.

Why the axis is measured: hand-entered centre/tilt got both characters wrong in
ways that were obvious on screen. GR80's slot RISES to the right (-4.5px across
its width) and a hand-guessed +5px fall made his mouth read as sideways; Barron's
smirk centres at y=297 with a +20px fall, and a guess of y=287/+6px sat visibly
high on his face. Tracing the baked mouth's own per-column centroid makes both
correct by construction, and re-derives itself if the art is ever redrawn.

Erase method: replace ONLY the baked mouth's pixels (luminance-masked, dilated
1px) with colour interpolated between two FIXED clean rows in the same column.
Fixed rows matter — per-column detection left a streaky comb under Barron's lip.

Re-run after tweaking the tuning block at the bottom.
"""
from PIL import Image, ImageDraw


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def dark_pixels(im, box, thresh):
    px = im.load()
    x0, y0, x1, y1 = box
    return {
        (x, y)
        for x in range(x0, x1)
        for y in range(y0, y1)
        if px[x, y][3] > 0 and lum(px[x, y]) < thresh
    }


def mouth_axis(im, box, thresh, smooth=3):
    """The baked mouth's centre-line: per-column centroid of its dark pixels,
    gap-filled and smoothed. Returns [(x, y), ...] left to right."""
    px = im.load()
    x0, y0, x1, y1 = box
    pts = {}
    for x in range(x0, x1):
        ys = [y for y in range(y0, y1) if px[x, y][3] > 0 and lum(px[x, y]) < thresh]
        if ys:
            pts[x] = sum(ys) / len(ys)
    if not pts:
        raise SystemExit(f"no mouth found in {box}")
    keys = sorted(pts)
    filled = []
    for x in range(keys[0], keys[-1] + 1):
        if x in pts:
            filled.append((x, pts[x]))
        else:
            lo = max(k for k in keys if k < x)
            hi = min(k for k in keys if k > x)
            t = (x - lo) / (hi - lo)
            filled.append((x, pts[lo] * (1 - t) + pts[hi] * t))
    ys = [p[1] for p in filled]
    out = []
    for i, (x, _) in enumerate(filled):
        w = ys[max(0, i - smooth): i + smooth + 1]
        out.append((x, sum(w) / len(w)))
    return out


def erase(im, mask, y_top, y_bot):
    px = im.load()
    grown = set()
    for (x, y) in mask:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                grown.add((x + dx, y + dy))
    for (x, y) in grown:
        ct, cb = px[x, y_top], px[x, y_bot]
        if ct[3] == 0 or cb[3] == 0:
            continue
        t = (y - y_top) / (y_bot - y_top)
        px[x, y] = tuple(int(ct[i] * (1 - t) + cb[i] * t) for i in range(3)) + (255,)
    return im


def build(name, body_path, out_dir, patch, mouth_box, thresh,
          clean_top, clean_bot, h_mid, h_open, dy=0.0, inset=0.04):
    im = Image.open(body_path).convert("RGBA")
    mask = dark_pixels(im, mouth_box, thresh)
    line_col = min((im.load()[p] for p in mask), key=lum)
    inner = tuple(max(0, int(c * 0.45)) for c in line_col[:3]) + (255,)
    axis = mouth_axis(im, mouth_box, thresh)

    closed = Image.new("RGBA", im.size, (0, 0, 0, 0))
    closed.paste(im.crop(patch), (patch[0], patch[1]))
    closed.save(f"{out_dir}/mouth-closed.png")

    cleaned = erase(im.copy(), mask, clean_top, clean_bot)
    n = len(axis)
    lo, hi = int(n * inset), int(n * (1 - inset))
    span = axis[lo:hi] or axis

    for label, h in (("mid", h_mid), ("open", h_open)):
        f = Image.new("RGBA", im.size, (0, 0, 0, 0))
        f.paste(cleaned.crop(patch), (patch[0], patch[1]))
        d = ImageDraw.Draw(f)
        top, bot = [], []
        m = len(span)
        for i, (x, y) in enumerate(span):
            t = i / (m - 1)
            bow = (1 - (2 * t - 1) ** 2) ** 0.72  # flatter ends than an almond
            top.append((x, y + dy - h * 0.40 * bow))
            bot.append((x, y + dy + h * 0.60 * bow))
        d.polygon(top + bot[::-1], fill=inner)
        # Keep the original mouth-line colour on the upper edge so the opening
        # still reads as part of the drawing rather than a hole punched in it.
        d.line(top, fill=line_col, width=2, joint="curve")
        f.save(f"{out_dir}/mouth-{label}.png")

    x0, y0 = span[0]
    x1, y1 = span[-1]
    print(f"{name}: axis x{x0}->{x1}, y{y0:.1f}->{y1:.1f} (tilt {y1 - y0:+.1f}px), "
          f"line={line_col[:3]}")


SRC = "/Users/michellepaulson/HAIL_MARY/public/shoulder-layers"

# ── GR80 ── flat light-grey robot face; baked mouth is a near-horizontal slot
# that rises slightly to the right.
build(
    "GR80", f"{SRC}/angel/body.png", f"{SRC}/angel",
    patch=(272, 246, 356, 298), mouth_box=(288, 258, 342, 280), thresh=100,
    clean_top=256, clean_bot=284,
    h_mid=6, h_open=13,
)

# ── Barron ── 3/4-turned face; baked mouth is a smirk curve falling ~20px to
# the right. mouth_box reaches y=308 because the smirk TAILS DOWN to y≈304;
# stopping at 302 left that hook floating under the new opening.
build(
    "Barron", f"{SRC}/demon/body.png", f"{SRC}/demon",
    patch=(292, 264, 388, 320), mouth_box=(300, 274, 380, 308), thresh=120,
    clean_top=272, clean_bot=316,
    h_mid=7, h_open=15,
)
