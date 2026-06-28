"use client";
import * as THREE from "three";

// Ported from ascii-animation.html — the "ASCII decrypt" reveal of Our Lady of
// Perpetual Profit, rendered to a <canvas> so it can live on a 3D mesh as a
// CanvasTexture (the DOM original can't sit on a 3D surface). GSAP is dropped:
// the 0..1 timeline is driven off the render loop's delta with an easeInOutQuad
// (GSAP power1.inOut equivalent). By default it decrypts ONCE on mount, settles,
// then stops re-rendering (zero ongoing cost). Flip LOOP on to re-decrypt forever.

// ─── CONFIG (mirrors the HTML) ───
const FONT_SIZE = 11;
const LINE_HEIGHT = 1.18;
const FONT = `${FONT_SIZE}px 'Courier New', 'SF Mono', monospace`;
const BG = "#08060f";
const PADDING = 28;
const DURATION = 9;   // seconds for the full decrypt
const LOOP = false;   // set true to re-run the decrypt forever
const HOLD = 4;       // settled seconds before a looped re-run

const COL_SCRAMBLE   = { r: 0,   g: 245, b: 212, a: 0.18 };
const COL_ACTIVE     = { r: 0,   g: 245, b: 212, a: 0.85 };
const COL_FLASH      = { r: 180, g: 255, b: 240, a: 1.0 };
const COL_FINAL      = { r: 210, g: 210, b: 215, a: 0.92 };
const COL_TITLE_GOLD = { r: 212, g: 175, b: 55,  a: 1.0 };

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&!?/\\|{}[]<>~^+-=_.:;*';

// Injected verbatim from ascii-animation.html (do not hand-edit).
const ASCII_ART = String.raw`
                                                                        fYLOOz
                                                                    Y0mwqppddbbbpm
                                                                  nCLJzYC0CJCLLQwdpw
                                                                 1czjnUQmqqwqpdpZLwqq
                                                                 \/(xt({|Y0LUzcvUZUZw0
                                                                1{[}}]|uU0ZmqqqZUU0zZw#
                                                                1{+~+)nzXJQOZmqpmzzrJOm
                                                                [[~--1((1/uzuuYOmnvYvOp
                                                               ]{-}]?]]1}-/u((xXLurJnOZ$
                                                               11]}?]{{{{)vOXrnCmctn\JZQ
                                                               {)-}{?}1()\XwZ0OZ0r\f{zmw
                                                              1))+-{{?[{{1fCOQQQvxcX1uwq
                                                              }({_+_?]-][]1rXUJXrxvn}xmwn
                                                              )(}-11?_-+?1rCQYu/trzY)jOwq
                                                              |1]{t\{[}]?]}|jXYrnXOwrfLpq
                                                             |\}-)//()][}}(xzCLvcLwZj\Xqmn
                                                             f\{|trnr\){)\jvJZZzuUCOztn0pZ
                                                           nuffjnzYJXj))/jnUOqwUCmqpdwJQdm
                                                          nCv/UrU0O0LcttrvUOqdd0JLQZqddmOdJ
                                                          XUvcQXJmmwQUzYCOwpdbdwCOmJUZpqzCQ
                                                         (u0CXQY0pZpmZmwppdddbddZmpmZ0mppQm0
                                                        nUQ0CO0YJmpqOmppbddpddddmqdqwwdbdkbbm
                                                       nzJLCCZZQOmpmCvcxcXJCJQOmQmdbbbbbbbbbdC
                                                       uXJCXLZO0Owqppqqqqqqppddd0mdbbbbbbdbbbp1
                                                      jczJJcLZO0Owdppqqqqppdpppp0mdbbbbbbdbdbd0
                                                      vYXCUuLZOQOwpqpqqqqqqpqdpq0mdbbbbbbdbbdbpQ
                                                     jXCXLXuQO0QZwpmqwqwqwqqqpqqQOpbbbbdbbbdbddm
                                                    nuJ0zCvuQO0QZqqOwmmmwwwqqqqqC0pdbbdbdbbddddp0
                                                    XcCZYJxc0Z0QZqq0mZmmwmwwwwwmYQqdddddddbddbddm
                                                   nLcJZQUnc0ZQQmpqZLQQOOmZZZwwZXLqddddddddddbddb0
                                                   uLcUZOXncOZQ0wqLLQJY0L00OZmmQuUqdbdddddddbddbbdQ
                                                  tX0JX0ZzxcOZQ0wwurUQuvYJLLLZZCjXqddddpddbdbbpbbbq1
                                                 uXJ0QcQZYnXOOQOwO}{1tcuj//xx\1[?vwdddddpddbbddbbbpmZ
                                                n/tvLOvLZXnXZO0ZwL+(fnXUXccunxn|{umdddddpddbbpbbdqqqZ
                                               cLLztz0UJOzvXZOOZwU|fcYcXUUYzcYzf{rZpddpdpddbdpbdpdbbbp0
                                             UL0ZmZJrYLYZcvzZZOmwL0ZqmOwqdmZ00OzrnOppdpdpdbdbdddpddbpqwmQ
                                             cXULOZmUnCcOvzzOZmwwJQwm00OpdwZw00JrjLqddppqddddddqdpqwqbdqO
                                           nXC0wqmQ0ZXvzQuXzOmmqOX0wOL0OqdZOwLCCx\Jwdpdpwdbdddpqpwqpddbkdq$
                                          -rXZqmZmm0LLnvCvYcOmwqUYOwLJQOqpZ0wOJJv)vZqdpdqpbdddwpqqqpppddbdw
                                         tC0mqpddpZZOQXxYvJvOwwwnUOmLYC0wpO0wZYYctfLqpdpwpbdpqqqqqqwwqwwqqqmn
                                        XLOwpddbdbqmZOJrzXCummq0nUOZCYJQwqOQwmCzcr/YmpppqqdppppwwmmwmOwqpdddpQ
                                       JQZqqppqqpbdqmmLncUJvmwmvuJZ0JXY0wp0LmwOcvn\xQwppwwdddppwmqwZOmqwwqqddpZ
                                     uLOmwwwmwpdppdpwwQYYQYzmwQ/vCZQJYY0wq0LmwOUur//XOwpwwppddpwqwZZmwZmwmOQZwpmn
                                    zCQQJurXOqqwwpppqqZ000U0ZZU\vCmLYYY0wq0LmmZ0urf(fYZqwwmdpddpwmmmmOZZJvUOwwqpqZ
                                   vXLZpdqQt](XZqwwwqwmZOLC0Qcz(uJmQYzz0wq0LZwZOYrj\{fUmp0qqddpqqqwmOmLjfC0QQmppppZ
                                  nuJmqwmZwQt+_[fJZwZ00Qm0LJ/tX)xJmLzccQwq0LZmZOLjft)}|YwpQZmpppqwZmmz}+)zYr\nJ0qpwm
                                  vUQUXczJCJf?]][?-}\ruvur/]?\X)jYmLzncQww0LmmZO0cjf){}{YOwpqZOmqqq0x-_?]{//1[]]\Lqq
                                 nJOUXXQ0QJn)[]?][[-_+~~+_~+-1Y)tXZLzxcLwq0LZwZZOCjj\1{]?(xXC0OO0Cn{_+-?]}/xjt/|{)L0U
                                \XCYLZmwwmQr1}}[[11}}}[]-+++?{Y1/zZQzxvLwqQLZqwmm0zrj(1[~+-?__]]?--___?}{})xcvf\1)YLC
                                11rOC0CLCLYr\(||\t|{{11[--+_]1U|/XZQzrcLwwQLmqqqqwQvu/|{_-?[~~--_+-___]1){}jcXUvcfCwO
                                1zOmmwmZmZ0Czurjrr/))()[----{(LffXZQzxcLmqQLZqwqppp0Jcxj]?[}_+??--]]]-[)\)1\XYQC0COqmn
                                qLqwdqppqmqZLXunnuj|(|(}-???)\LrfzOQzrcCwwQLmqwwppppOQYc(]}1-_[[??(1{}1/t\t\xJCOOmOqwb
                                nXOwpwwmwqqwZCcuucxt\\\{[]?[|tLnfXZQcjvCmwLLZqwwqdddpwLUj[1(?-}}[[|)1{|nufxn((|zzCzOZQ
                                ]}[/zU0mppqqqOUczXnf/tf\{}[}\tQufzOQcfuJmwQCZwmwqppbdpwLv)(|]]1)}}||))/vzfxuft\()rUmww
                                1)/zOwqpqpqqqwLzzYcrfjnr))}{/tCctc0Qn(xJZwQCZmZmwppdbddOX)(/[[(\({\t/(fzzfxXujrcJOwpwZ
                                1)xJOmqpppqwqqZUUJYnxncc\|)(/fCctnQQcjxJZqQCOmOmwqpdddppU\|f1[/j((nuf|jXXruCXuvUQZwpqw
                                ))nUOwqdpppqqpmLUCUvncYUt/((tjCcfxLQzrxYZqOU0mOZmqpddddqC/tj))nc/\vcj\rYXrnCJYYJQmwppw
                                }(uJ0wwqpqwwppw0CQLzcYLJr/|\ffCztxLQzxrXOqOUQZ0OmwpddpdpOtjr\|cztfvcf\rXYnfxvvczULmppmQ
                                )(fjrrrf\\vmppqmZZZCJLQCxt\\fjCXfjLQzrfv0pOYL0Q0ZwppbddpwjxcxtzYxjvvf/rXUv/({?-_++-1xJ0
                                }}{)||({[(zZqqqwmwqOQ0QCxf/tjjJYfrCQzjfvQqZUL0CLOmwpddddwuXJvrXUnrzuf\rXJzxt(}]_++-_?||
                                ?{|/\\|{[/YZqpqwmwqOQ00Cxf//nfUYfjCQzjtnQqZUJLJLQZwpdddpwYLLunYUxxcvf/fzL0Lzj(}]?]?-}1
                                 -1|/f/)1fYZqppwmwqZQ00Lxj/\rfYUjjYQXf/nLqmCULJCQOwqpddpwCQLzuYXrxzuf\rXQZZLXuf|){}}
                                   1\f//txUOwpqqwwqm0O0Cxj//xfXJrfzQYr/rCqwLUJUJQOmqpddpwCQLcuYXjnzuf/xXQmwOJXvrt\-
                                    [|tnvzJOqppwwwqZ000Lnft\rtzQutnQYj/jJqpQYYXYC0mwpddqwLLQznXzfuzvf\rXQmwZLYXct
                                     1\fxXQZqqpqwwqw000Cnj//x/zOctrQUf/jUwpQcYXzJ0ZwppdpwCLQcuXcjuzuf/xzCZwZJXCLn
                                      <][|uOwppqqqqw000Cxft\x/v0XtjJYt\tzwd0cXcvYQZwpdppwLQQnuXcjuzuftrvXvrfrYQ0n
                                       }[]?1n0qqwwqw000Cxj/\rtx0YtfYY/||vmpOzXznvJOmqpqqwLLQnnXurucuj\frrrjncJOmX
                                       11{}[?[j0qwqq0Q0Cxft\j\jLJtfXYt||xOpmXnurtxY0mwwwmCLLuxcnjuvnf\xcvvcU0mqwQ
                                       {1(|(1[-\CwqqOQ0Qxjt\f|fCLjfcX/\|x0pqYxXn/\/nJOZmwCCQvnznruvnf|fzYL0Zmmqw0
                                       1(tnnr\{[uZqqOQQLrf\|t|/UQutrYf\|r0qpLnunt\\rUQOZmCCCnxujruvnf|fzYL0Zmmqw0
                                       {(jvzcn\]fQwqO0QLrt/(/f\z0XtrXf\|rLppOvxXx//jU0OZmCCLrxnjrvzYJCc|{}]]]1cLQ
                                       1|f\{]__]tCmqZQ0Lxf/|/ftu0Utfcf|(jLqpqXrzXrtjX0OZmCCCjxrrrvXLOwLr){}[]]}1-
                                       }|f|1}]?[tUmqZQ0Lnf/|/j(r0Cf/rj|(jJqppUrxCXjfvOZZmCCCfxrfxvUQmw0cxft|)}?
                                       }trf(){][/UZwmQ0Lut/|/f(fLLx\tj\(tUqdp0urYLvrnCZmmJJJfxrjrcU0mwOYcnrt(
                                        )\//|)}[)cOqm00Lvttf|r(\CQv\/f\(/XmppwzjxLCcnXmmZUUUfxrjxvUQZwZJzn|
                                         ])/t\1}{nQww0QQvj/(1j||cOY/\/\)|vZppdCxjzOJcvQmOzJXtxrjnvUQZm0Uj
                                           1|(1[}rLww0QQc\|()f\1fOCr/|\(|nOppdwcrxYmJcYZ0XUX\xxjuvYLOZQ
                                             -]]}fJmw0LLzt/(1//)\LQn||\|(jQqpdpQvrxCqLYJmJYz\nxjuvXLOL
                                               ?}/YmqOL0Yf\\1\/))n0z/(||)tJqdpppQuxu0p0LUCXv/xxxuvXL0z
                                               ?[)u0wO0QUf\(1(f))\CXj((|)\XwdpdqqOcucQpqJYXvtxnnuvzUU
                                                ]{jLmO0QCj\){1j))|vUx\)||)nZpddpmqZUczLwpZzvtnunnncUn
                                                _[|X000QCr|)}{j(}/\zcf)(\(j0pdddwOwq0UzYJYnn/xnunuzX
                                                 ?}jJQQ0Cr()}[f/{/|/ur\1\(/JpdddpZ0ZpdwwmmJn\fxnuuzU
                                                 _](nUQQLn)1[]ff{}t|\xj((|(vwddddp0CQZpdbdCj/frnnuc
                                                  -])nYLLv)}?-/x(})f((rt)|(rOpdddbpZLCQQQQv|\|frnzz
                                                  ~-[)xUCc)[--|v\]-)f(1f/)\tJpddbdbbdqmwwpdQ/[)jrc
                                                   i?}(xUz1[--(Xt_~+}|/{(\(|vmddbbbkkbpdbbkcO|}(rx
                                                    i]})fx{?--1Yj[)1)))//)))jQdbbbbbbdbkkbpdpO{(x
                                                      _?[[]_~}(zx|(tff/ft\\)(zqdbbbkbkbkkpwpdZr}t
                                                       i__+<+tnCXxtjnnrtf\(//rQpbbkkkbbkqdmqdb0
                                                          ->tQOJu/rYJJUcnxf)1|vmbbbkkkdpQ0pdqwX
                                                            fUz   xz0LQJvcnf?[/UpbbkkkbmQ cUc
                                                                  nuX0Q0CX|   1xQdbbkbpw
                                                                     ?1{>      \nOdbbwZ
                                                                               XuzZpqZ
                                                                               v(txzn
                                                                                (-`;

// ─── PARSE ART (verbatim port) ───
function parseArt(raw) {
  const lines = raw.split("\n");
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === "") continue;
    const indent = line.search(/\S/);
    if (indent >= 0 && indent < minIndent) minIndent = indent;
  }
  if (minIndent === Infinity) minIndent = 0;

  const trimmed = lines.map((l) => l.slice(minIndent));
  let maxWidth = 0;
  for (const l of trimmed) if (l.length > maxWidth) maxWidth = l.length;

  const grid = [];
  const chars = [];
  for (let r = 0; r < trimmed.length; r++) {
    grid[r] = [];
    for (let c = 0; c < maxWidth; c++) {
      const ch = c < trimmed[r].length ? trimmed[r][c] : " ";
      grid[r][c] = ch;
      if (ch !== " ") chars.push({ row: r, col: c, char: ch });
    }
  }
  return { grid, chars, rows: trimmed.length, cols: maxWidth };
}

// GSAP power1.inOut equivalent (quadratic ease in/out).
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// mode: 'once' (decrypt then settle + stop), 'loop' (re-decrypt forever with a
// settled HOLD between), 'pingpong' (decrypt in → hold → dissolve back out →
// repeat — a "breathing" materialization). duration/hold override the consts.
export function createAsciiDecryptScreen(
  mesh,
  { flipY = false, mode = LOOP ? 'loop' : 'once', duration = DURATION, hold = HOLD } = {}
) {
  const art = parseArt(ASCII_ART);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = FONT;
  const charWidth = ctx.measureText("M").width;
  const lineH = Math.floor(FONT_SIZE * LINE_HEIGHT);
  const canvasW = Math.ceil(art.cols * charWidth) + PADDING * 2;
  const canvasH = Math.ceil(art.rows * lineH) + PADDING * 2 + 60; // +60 for title
  canvas.width = canvasW;
  canvas.height = canvasH; // NOTE: resets ctx state — render() re-sets font/baseline

  // Per-character reveal times: top-down wave (70%) + radial (30%) + jitter.
  const centerRow = art.rows / 2;
  const centerCol = art.cols / 2;
  for (const ch of art.chars) {
    const rowNorm = ch.row / art.rows;
    const dx = (ch.col - centerCol) / art.cols;
    const dy = (ch.row - centerRow) / art.rows;
    const radialNorm = Math.sqrt(dx * dx + dy * dy) / 0.7;
    const jitter = Math.random() * 0.08;
    ch.revealTime = Math.min(0.12 + (rowNorm * 0.65 + radialNorm * 0.1 + jitter), 0.88);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // glTF UVs assume a top-left origin (loader uses flipY:false) — the default
  // here. A plain R3F PlaneGeometry uses bottom-left UVs and needs flipY:true,
  // so callers on a raw plane pass { flipY: true } to keep the figure upright.
  tex.flipY = flipY;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  // Unlit, self-lit panel — no env map needed. NO additive blending /
  // depthTest:false (that combo renders CanvasTextures as blocky rects on iOS).
  mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });

  // ─── scramble + color helpers (verbatim port) ───
  const scrambleCache = {};
  let scrambleFrame = 0;
  function randChar() { return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]; }
  function getScrambleChar(row, col) {
    const key = row * 10000 + col;
    if (!scrambleCache[key] || scrambleFrame % 3 === 0) scrambleCache[key] = randChar();
    return scrambleCache[key];
  }
  function rgba(c, alphaOverride) {
    return `rgba(${c.r},${c.g},${c.b},${alphaOverride !== undefined ? alphaOverride : c.a})`;
  }
  function lerpColor(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t),
      a: a.a + (b.a - a.a) * t,
    };
  }

  let progress = 0;

  // ─── RENDER (verbatim port of the HTML's render()) ───
  function render() {
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Subtle background glow at center of figure.
    if (progress > 0.3) {
      const glowAlpha = Math.min((progress - 0.3) * 0.15, 0.06);
      const grd = ctx.createRadialGradient(canvasW / 2, canvasH / 2 - 30, 20, canvasW / 2, canvasH / 2 - 30, canvasH * 0.5);
      grd.addColorStop(0, `rgba(0,245,212,${glowAlpha})`);
      grd.addColorStop(1, "rgba(0,245,212,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    ctx.font = FONT;
    ctx.textBaseline = "top";

    // Rare horizontal glitch shift.
    let glitchOffset = 0;
    if (progress > 0.05 && progress < 0.85 && Math.random() < 0.015) {
      glitchOffset = (Math.random() - 0.5) * 4;
    }

    for (const ch of art.chars) {
      const x = PADDING + ch.col * charWidth + glitchOffset;
      const y = PADDING + ch.row * lineH;
      const rt = ch.revealTime;
      const transitionWindow = 0.04;

      if (progress < 0.06) {
        // Phase 1: characters appearing as noise.
        const appearProgress = progress / 0.06;
        const rowAppear = ch.row / art.rows;
        if (appearProgress > rowAppear * 0.8 + Math.random() * 0.2) {
          ctx.fillStyle = rgba(COL_SCRAMBLE);
          ctx.fillText(getScrambleChar(ch.row, ch.col), x, y);
        }
      } else if (progress < rt - transitionWindow) {
        // Scrambled.
        ctx.fillStyle = rgba(COL_SCRAMBLE, 0.18 + Math.random() * 0.08);
        ctx.fillText(getScrambleChar(ch.row, ch.col), x, y);
      } else if (progress < rt) {
        // Transitioning — rapid cycling, brightening.
        const t = (progress - (rt - transitionWindow)) / transitionWindow;
        const col = lerpColor(COL_ACTIVE, COL_FLASH, t);
        ctx.fillStyle = rgba(col);
        ctx.fillText(Math.random() < t * t ? ch.char : randChar(), x, y);
        ctx.shadowColor = rgba(COL_ACTIVE, 0.5);
        ctx.shadowBlur = 6 * t;
      } else if (progress < rt + 0.03) {
        // Just revealed — flash.
        const flashT = (progress - rt) / 0.03;
        const col = lerpColor(COL_FLASH, COL_FINAL, flashT);
        ctx.fillStyle = rgba(col);
        ctx.shadowColor = rgba(COL_ACTIVE, 0.4 * (1 - flashT));
        ctx.shadowBlur = 8 * (1 - flashT);
        ctx.fillText(ch.char, x, y);
      } else {
        // Settled.
        ctx.fillStyle = rgba(COL_FINAL);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.fillText(ch.char, x, y);
      }

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    // ─── Title text at bottom ───
    if (progress > 0.88) {
      const titleAlpha = Math.min((progress - 0.88) / 0.1, 1.0);
      const titleY = PADDING + art.rows * lineH + 20;

      ctx.textAlign = "center";
      ctx.font = `bold ${FONT_SIZE + 2}px 'Courier New', monospace`;
      ctx.fillStyle = rgba(COL_TITLE_GOLD, titleAlpha);
      ctx.shadowColor = rgba(COL_TITLE_GOLD, titleAlpha * 0.4);
      ctx.shadowBlur = 12;
      ctx.fillText("✦  Our Lady of Perpetual Profit  ✦", canvasW / 2, titleY);

      ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
      ctx.fillStyle = rgba(COL_ACTIVE, titleAlpha * 0.8);
      ctx.shadowColor = rgba(COL_ACTIVE, titleAlpha * 0.3);
      ctx.shadowBlur = 8;
      ctx.fillText("$RL80 on Base", canvasW / 2, titleY + lineH + 8);

      ctx.textAlign = "left";
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }
  }

  render();
  tex.needsUpdate = true;

  let time = 0;
  let done = false;
  function update(dt) {
    if (done) return;
    time += dt;
    let raw;
    if (mode === 'loop') {
      const cycle = duration + hold;
      raw = Math.min((time % cycle) / duration, 1);
    } else if (mode === 'pingpong') {
      // Breathing reveal: decrypt in, hold settled, then reverse back to full
      // scramble, then repeat — perpetual materialize / dematerialize.
      const cycle = duration * 2 + hold;
      const tt = time % cycle;
      if (tt < duration) raw = tt / duration;            // materialize 0→1
      else if (tt < duration + hold) raw = 1;            // hold settled
      else raw = 1 - (tt - duration - hold) / duration;  // dematerialize 1→0
    } else {
      raw = Math.min(time / duration, 1);                // 'once'
    }
    progress = easeInOutQuad(raw);

    scrambleFrame++;
    if (scrambleFrame % 3 === 0) {
      for (const key in scrambleCache) {
        if (Math.random() < 0.4) scrambleCache[key] = randChar();
      }
    }

    render();
    tex.needsUpdate = true;
    if (mode === 'once' && raw >= 1) done = true; // settled — stop repainting
  }

  // aspect (w/h) lets callers fit-contain the portrait canvas without stretching.
  return { update, dispose: () => tex.dispose(), aspect: canvasW / canvasH };
}
