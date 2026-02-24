"use client";

import { useEffect, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * FireworksSky — R3F component that renders fireworks onto a sky sphere INSIDE
 * the 3D scene. The terrain naturally occludes them via depth testing, so they
 * appear behind the world geometry, in the sky.
 *
 * Props:
 *  - quality     : 1 | 2 | 3  (low/normal/high, default 2)
 *  - shellSize   : 0–5 (default 2)
 *  - enabled     : boolean (default true)
 *  - radius      : sphere radius (default 75, should be < sky dome 80)
 */
export default function FireworksSky({
  quality: qualityProp = 2,
  shellSize: shellSizeProp = 2,
  enabled = true,
  radius = 75,
}) {
  const meshRef = useRef();
  const engineRef = useRef(null);
  const textureRef = useRef(null);

  // Offscreen canvases — high-res panoramic for sphere wrapping
  const TEX_W = 4096;
  const TEX_H = 2048;

  const { outputCanvas, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return { outputCanvas: c, texture: tex };
  }, []);

  useEffect(() => {
    const trailsCanvas = document.createElement("canvas");
    trailsCanvas.width = TEX_W;
    trailsCanvas.height = TEX_H;
    const mainCanvas = document.createElement("canvas");
    mainCanvas.width = TEX_W;
    mainCanvas.height = TEX_H;
    const outputCtx = outputCanvas.getContext("2d");

    // ─── Engine state ────────────────────────────────────────────────
    const PI_2 = Math.PI * 2;
    const PI_HALF = Math.PI * 0.5;
    const GRAVITY = 0.9;
    let simSpeed = 1;
    let quality = qualityProp;
    let isLowQuality = quality === 1;
    let isHighQuality = quality === 3;
    let shellSizeConfig = shellSizeProp;
    let running = enabled;
    let destroyed = false;

    const stageW = TEX_W;
    const stageH = TEX_H;
    let currentFrame = 0;
    let autoLaunchTime = 0;

    const INVISIBLE = "_INVISIBLE_";
    const COLOR = {
      Red: "#ff0043",
      Green: "#14fc56",
      Blue: "#1e7fff",
      Purple: "#e60aff",
      Gold: "#ffbf36",
      White: "#ffffff",
    };
    const COLOR_NAMES = Object.keys(COLOR);
    const COLOR_CODES = COLOR_NAMES.map((n) => COLOR[n]);
    const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE];

    const MyMath = {
      random: (min, max) => Math.random() * (max - min) + min,
      clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
      pointDist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
      pointAngle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
    };

    const trailsCtx = trailsCanvas.getContext("2d");
    const mainCtx = mainCanvas.getContext("2d");

    // ─── Particle collections ────────────────────────────────────────
    function createParticleCollection() {
      const c = {};
      COLOR_CODES_W_INVIS.forEach((k) => (c[k] = []));
      return c;
    }

    const Star = {
      drawWidth: 3,
      airDrag: 0.98,
      airDragHeavy: 0.992,
      active: createParticleCollection(),
      _pool: [],
      _new() { return {}; },
      add(x, y, color, angle, speed, life, speedOffX, speedOffY) {
        const inst = this._pool.pop() || this._new();
        inst.visible = true;
        inst.heavy = false;
        inst.x = x; inst.y = y; inst.prevX = x; inst.prevY = y;
        inst.color = color;
        inst.speedX = Math.sin(angle) * speed + (speedOffX || 0);
        inst.speedY = Math.cos(angle) * speed + (speedOffY || 0);
        inst.life = life; inst.fullLife = life;
        inst.spinAngle = Math.random() * PI_2;
        inst.spinSpeed = 0.8; inst.spinRadius = 0;
        inst.sparkFreq = 0; inst.sparkSpeed = 1; inst.sparkTimer = 0;
        inst.sparkColor = color; inst.sparkLife = 750; inst.sparkLifeVariation = 0.25;
        inst.strobe = false;
        this.active[color].push(inst);
        return inst;
      },
      returnInstance(inst) {
        inst.onDeath && inst.onDeath(inst);
        inst.onDeath = null; inst.secondColor = null;
        inst.transitionTime = 0; inst.colorChanged = false;
        this._pool.push(inst);
      },
    };

    const Spark = {
      drawWidth: quality === 3 ? 0.75 : 1,
      airDrag: 0.9,
      active: createParticleCollection(),
      _pool: [],
      _new() { return {}; },
      add(x, y, color, angle, speed, life) {
        const inst = this._pool.pop() || this._new();
        inst.x = x; inst.y = y; inst.prevX = x; inst.prevY = y;
        inst.color = color;
        inst.speedX = Math.sin(angle) * speed;
        inst.speedY = Math.cos(angle) * speed;
        inst.life = life;
        this.active[color].push(inst);
        return inst;
      },
      returnInstance(inst) { this._pool.push(inst); },
    };

    const BurstFlash = {
      active: [], _pool: [],
      _new() { return {}; },
      add(x, y, r) {
        const inst = this._pool.pop() || this._new();
        inst.x = x; inst.y = y; inst.radius = r;
        this.active.push(inst);
      },
      returnInstance(inst) { this._pool.push(inst); },
    };

    // ─── Color helpers ───────────────────────────────────────────────
    function randomColorSimple() { return COLOR_CODES[(Math.random() * COLOR_CODES.length) | 0]; }
    let lastColor;
    function randomColor(opts) {
      const notSame = opts && opts.notSame;
      const notColor = opts && opts.notColor;
      const limitWhite = opts && opts.limitWhite;
      let color = randomColorSimple();
      if (limitWhite && color === COLOR.White && Math.random() < 0.6) color = randomColorSimple();
      if (notSame) { while (color === lastColor) color = randomColorSimple(); }
      else if (notColor) { while (color === notColor) color = randomColorSimple(); }
      lastColor = color;
      return color;
    }
    function whiteOrGold() { return Math.random() < 0.5 ? COLOR.Gold : COLOR.White; }
    function makePistilColor(c) {
      return c === COLOR.White || c === COLOR.Gold ? randomColor({ notColor: c }) : whiteOrGold();
    }

    // ─── Particle burst helpers ──────────────────────────────────────
    function createParticleArc(start, arcLength, count, randomness, factory) {
      const delta = arcLength / count;
      const end = start + arcLength - delta * 0.5;
      if (end > start) { for (let a = start; a < end; a = a + delta) factory(a + Math.random() * delta * randomness); }
      else { for (let a = start; a > end; a = a + delta) factory(a + Math.random() * delta * randomness); }
    }
    function createBurst(count, factory, startAngle = 0, arcLength = PI_2) {
      const R = 0.5 * Math.sqrt(count / Math.PI);
      const C = 2 * R * Math.PI;
      const C_HALF = C / 2;
      for (let i = 0; i <= C_HALF; i++) {
        const ringAngle = (i / C_HALF) * PI_HALF;
        const ringSize = Math.cos(ringAngle);
        const partsPerFullRing = C * ringSize;
        const partsPerArc = partsPerFullRing * (arcLength / PI_2);
        const angleInc = PI_2 / partsPerFullRing;
        const angleOffset = Math.random() * angleInc + startAngle;
        const maxRandOff = angleInc * 0.33;
        for (let j = 0; j < partsPerArc; j++) {
          factory(angleInc * j + angleOffset + Math.random() * maxRandOff, ringSize);
        }
      }
    }

    // ─── Star death effects ──────────────────────────────────────────
    function crossetteEffect(star) {
      createParticleArc(Math.random() * PI_HALF, PI_2, 4, 0.5, (a) => {
        Star.add(star.x, star.y, star.color, a, Math.random() * 0.6 + 0.75, 600);
      });
    }
    function floralEffect(star) {
      createBurst(12 + 6 * quality, (a, sm) => {
        Star.add(star.x, star.y, star.color, a, sm * 2.4, 1000 + Math.random() * 300, star.speedX, star.speedY);
      });
      BurstFlash.add(star.x, star.y, 46);
    }
    function fallingLeavesEffect(star) {
      createBurst(7, (a, sm) => {
        const ns = Star.add(star.x, star.y, INVISIBLE, a, sm * 2.4, 2400 + Math.random() * 600, star.speedX, star.speedY);
        ns.sparkColor = COLOR.Gold; ns.sparkFreq = 144 / quality; ns.sparkSpeed = 0.28;
        ns.sparkLife = 750; ns.sparkLifeVariation = 3.2;
      });
      BurstFlash.add(star.x, star.y, 46);
    }
    function crackleEffect(star) {
      createParticleArc(0, PI_2, isHighQuality ? 32 : 16, 1.8, (a) => {
        Spark.add(star.x, star.y, COLOR.Gold, a, Math.pow(Math.random(), 0.45) * 2.4, 300 + Math.random() * 200);
      });
    }

    // ─── Shell types ─────────────────────────────────────────────────
    const crysanthemumShell = (size = 1) => {
      const glitter = Math.random() < 0.25;
      const singleColor = Math.random() < 0.72;
      const color = singleColor ? randomColor({ limitWhite: true }) : [randomColor(), randomColor({ notSame: true })];
      const pistil = singleColor && Math.random() < 0.42;
      const pistilColor = pistil && makePistilColor(color);
      const secondColor = singleColor && (Math.random() < 0.2 || color === COLOR.White) ? pistilColor || randomColor({ notColor: color, limitWhite: true }) : null;
      const streamers = !pistil && color !== COLOR.White && Math.random() < 0.42;
      let starDensity = glitter ? 1.1 : 1.25;
      if (isLowQuality) starDensity *= 0.8;
      if (isHighQuality) starDensity = 1.2;
      return { shellSize: size, spreadSize: 300 + size * 100, starLife: 900 + size * 200, starDensity, color, secondColor, glitter: glitter ? "light" : "", glitterColor: whiteOrGold(), pistil, pistilColor, streamers };
    };
    const ghostShell = (size = 1) => {
      const shell = crysanthemumShell(size);
      shell.starLife *= 1.5; shell.streamers = true;
      shell.color = INVISIBLE; shell.secondColor = randomColor({ notColor: COLOR.White }); shell.glitter = "";
      return shell;
    };
    const strobeShell = (size = 1) => {
      const color = randomColor({ limitWhite: true });
      return { shellSize: size, spreadSize: 280 + size * 92, starLife: 1100 + size * 200, starLifeVariation: 0.4, starDensity: 1.1, color, glitter: "light", glitterColor: COLOR.White, strobe: true, strobeColor: Math.random() < 0.5 ? COLOR.White : null, pistil: Math.random() < 0.5, pistilColor: makePistilColor(color) };
    };
    const palmShell = (size = 1) => {
      const color = randomColor(); const thick = Math.random() < 0.5;
      return { shellSize: size, color, spreadSize: 250 + size * 75, starDensity: thick ? 0.15 : 0.4, starLife: 1800 + size * 200, glitter: thick ? "thick" : "heavy" };
    };
    const ringShell = (size = 1) => {
      const color = randomColor(); const pistil = Math.random() < 0.75;
      return { shellSize: size, ring: true, color, spreadSize: 300 + size * 100, starLife: 900 + size * 200, starCount: 2.2 * PI_2 * (size + 1), pistil, pistilColor: makePistilColor(color), glitter: !pistil ? "light" : "", glitterColor: color === COLOR.Gold ? COLOR.Gold : COLOR.White, streamers: Math.random() < 0.3 };
    };
    const crossetteShell = (size = 1) => {
      const color = randomColor({ limitWhite: true });
      return { shellSize: size, spreadSize: 300 + size * 100, starLife: 750 + size * 160, starLifeVariation: 0.4, starDensity: 0.85, color, crossette: true, pistil: Math.random() < 0.5, pistilColor: makePistilColor(color) };
    };
    const floralShell = (size = 1) => ({
      shellSize: size, spreadSize: 300 + size * 120, starDensity: 0.12, starLife: 500 + size * 50, starLifeVariation: 0.5,
      color: Math.random() < 0.65 ? "random" : Math.random() < 0.15 ? randomColor() : [randomColor(), randomColor({ notSame: true })], floral: true,
    });
    const fallingLeavesShell = (size = 1) => ({
      shellSize: size, color: INVISIBLE, spreadSize: 300 + size * 120, starDensity: 0.12, starLife: 500 + size * 50, starLifeVariation: 0.5, glitter: "medium", glitterColor: COLOR.Gold, fallingLeaves: true,
    });
    const willowShell = (size = 1) => ({
      shellSize: size, spreadSize: 300 + size * 100, starDensity: 0.6, starLife: 3000 + size * 300, glitter: "willow", glitterColor: COLOR.Gold, color: INVISIBLE,
    });
    const crackleShell = (size = 1) => {
      const color = Math.random() < 0.75 ? COLOR.Gold : randomColor();
      return { shellSize: size, spreadSize: 380 + size * 75, starDensity: isLowQuality ? 0.65 : 1, starLife: 600 + size * 100, starLifeVariation: 0.32, glitter: "light", glitterColor: COLOR.Gold, color, crackle: true, pistil: Math.random() < 0.65, pistilColor: makePistilColor(color) };
    };
    const horsetailShell = (size = 1) => {
      const color = randomColor();
      return { shellSize: size, horsetail: true, color, spreadSize: 250 + size * 38, starDensity: 0.9, starLife: 2500 + size * 300, glitter: "medium", glitterColor: Math.random() < 0.5 ? whiteOrGold() : color, strobe: color === COLOR.White };
    };

    const shellTypes = {
      Crackle: crackleShell, Crossette: crossetteShell, Crysanthemum: crysanthemumShell,
      "Falling Leaves": fallingLeavesShell, Floral: floralShell, Ghost: ghostShell,
      "Horse Tail": horsetailShell, Palm: palmShell, Ring: ringShell, Strobe: strobeShell, Willow: willowShell,
    };
    const shellNames = Object.keys(shellTypes);
    const fastBlacklist = ["Falling Leaves", "Floral", "Willow"];

    function randomShellName() { return Math.random() < 0.5 ? "Crysanthemum" : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0]; }
    function randomShell(size) { return shellTypes[randomShellName()](size); }
    function randomFastShell() {
      let name = randomShellName();
      while (fastBlacklist.includes(name)) name = randomShellName();
      return shellTypes[name];
    }

    // ─── Shell class ─────────────────────────────────────────────────
    // Fireworks launch from the bottom of the texture (horizon) and
    // burst in the upper portion (sky). On the sphere, the texture's
    // top = the zenith and bottom = the equator/horizon.
    class Shell {
      constructor(options) {
        Object.assign(this, options);
        this.starLifeVariation = options.starLifeVariation || 0.125;
        this.color = options.color || randomColor();
        this.glitterColor = options.glitterColor || this.color;
        if (!this.starCount) {
          const density = options.starDensity || 1;
          const s = this.spreadSize / 54;
          this.starCount = Math.max(6, s * s * density);
        }
      }
      launch(position, launchHeight) {
        const width = stageW;
        const height = stageH;
        const hpad = 60, vpad = 50;
        // Bursts happen in top ~70% of texture, launch from bottom
        const minHeight = height * 0.35;
        const launchX = position * (width - hpad * 2) + hpad;
        const launchY = height;
        const burstY = vpad + (1 - launchHeight) * (minHeight - vpad);
        const launchDistance = launchY - burstY;
        const launchVelocity = Math.pow(launchDistance * 0.04, 0.64);
        const comet = (this.comet = Star.add(
          launchX, launchY,
          typeof this.color === "string" && this.color !== "random" ? this.color : COLOR.White,
          Math.PI,
          launchVelocity * (this.horsetail ? 1.2 : 1),
          launchVelocity * (this.horsetail ? 100 : 400)
        ));
        comet.heavy = true;
        comet.spinRadius = MyMath.random(0.32, 0.85);
        comet.sparkFreq = 32 / quality;
        if (isHighQuality) comet.sparkFreq = 8;
        comet.sparkLife = 320; comet.sparkLifeVariation = 3;
        if (this.glitter === "willow" || this.fallingLeaves) {
          comet.sparkFreq = 20 / quality; comet.sparkSpeed = 0.5; comet.sparkLife = 500;
        }
        if (this.color === INVISIBLE) comet.sparkColor = COLOR.Gold;
        if (Math.random() > 0.4 && !this.horsetail) {
          comet.secondColor = INVISIBLE;
          comet.transitionTime = Math.pow(Math.random(), 1.5) * 700 + 500;
        }
        comet.onDeath = (c) => this.burst(c.x, c.y);
      }
      burst(x, y) {
        const speed = this.spreadSize / 96;
        let color, onDeath, sparkFreq, sparkSpeed, sparkLife;
        let sparkLifeVariation = 0.25;
        if (this.crossette) onDeath = (star) => crossetteEffect(star);
        if (this.crackle) onDeath = (star) => crackleEffect(star);
        if (this.floral) onDeath = floralEffect;
        if (this.fallingLeaves) onDeath = fallingLeavesEffect;
        if (this.glitter === "light") { sparkFreq = 400; sparkSpeed = 0.3; sparkLife = 300; sparkLifeVariation = 2; }
        else if (this.glitter === "medium") { sparkFreq = 200; sparkSpeed = 0.44; sparkLife = 700; sparkLifeVariation = 2; }
        else if (this.glitter === "heavy") { sparkFreq = 80; sparkSpeed = 0.8; sparkLife = 1400; sparkLifeVariation = 2; }
        else if (this.glitter === "thick") { sparkFreq = 16; sparkSpeed = isHighQuality ? 1.65 : 1.5; sparkLife = 1400; sparkLifeVariation = 3; }
        else if (this.glitter === "streamer") { sparkFreq = 32; sparkSpeed = 1.05; sparkLife = 620; sparkLifeVariation = 2; }
        else if (this.glitter === "willow") { sparkFreq = 120; sparkSpeed = 0.34; sparkLife = 1400; sparkLifeVariation = 3.8; }
        sparkFreq = sparkFreq / quality;

        const starFactory = (angle, speedMult) => {
          const standardInitialSpeed = this.spreadSize / 1800;
          const star = Star.add(
            x, y, color || randomColor(), angle, speedMult * speed,
            this.starLife + Math.random() * this.starLife * this.starLifeVariation,
            this.horsetail ? this.comet && this.comet.speedX : 0,
            this.horsetail ? this.comet && this.comet.speedY : -standardInitialSpeed
          );
          if (this.secondColor) { star.transitionTime = this.starLife * (Math.random() * 0.05 + 0.32); star.secondColor = this.secondColor; }
          if (this.strobe) { star.transitionTime = this.starLife * (Math.random() * 0.08 + 0.46); star.strobe = true; star.strobeFreq = Math.random() * 20 + 40; if (this.strobeColor) star.secondColor = this.strobeColor; }
          star.onDeath = onDeath;
          if (this.glitter) { star.sparkFreq = sparkFreq; star.sparkSpeed = sparkSpeed; star.sparkLife = sparkLife; star.sparkLifeVariation = sparkLifeVariation; star.sparkColor = this.glitterColor; star.sparkTimer = Math.random() * star.sparkFreq; }
        };

        if (typeof this.color === "string") {
          color = this.color === "random" ? null : this.color;
          if (this.ring) {
            const rsa = Math.random() * Math.PI;
            const rsq = Math.pow(Math.random(), 2) * 0.85 + 0.15;
            createParticleArc(0, PI_2, this.starCount, 0, (a) => {
              const ix = Math.sin(a) * speed * rsq, iy = Math.cos(a) * speed;
              const ns = MyMath.pointDist(0, 0, ix, iy);
              const na = MyMath.pointAngle(0, 0, ix, iy) + rsa;
              const star = Star.add(x, y, color, na, ns, this.starLife + Math.random() * this.starLife * this.starLifeVariation);
              if (this.glitter) { star.sparkFreq = sparkFreq; star.sparkSpeed = sparkSpeed; star.sparkLife = sparkLife; star.sparkLifeVariation = sparkLifeVariation; star.sparkColor = this.glitterColor; star.sparkTimer = Math.random() * star.sparkFreq; }
            });
          } else { createBurst(this.starCount, starFactory); }
        } else if (Array.isArray(this.color)) {
          if (Math.random() < 0.5) {
            const s = Math.random() * Math.PI;
            color = this.color[0]; createBurst(this.starCount, starFactory, s, Math.PI);
            color = this.color[1]; createBurst(this.starCount, starFactory, s + Math.PI, Math.PI);
          } else {
            color = this.color[0]; createBurst(this.starCount / 2, starFactory);
            color = this.color[1]; createBurst(this.starCount / 2, starFactory);
          }
        }
        if (this.pistil) new Shell({ spreadSize: this.spreadSize * 0.5, starLife: this.starLife * 0.6, starLifeVariation: this.starLifeVariation, starDensity: 1.4, color: this.pistilColor, glitter: "light", glitterColor: this.pistilColor === COLOR.Gold ? COLOR.Gold : COLOR.White }).burst(x, y);
        if (this.streamers) new Shell({ spreadSize: this.spreadSize * 0.9, starLife: this.starLife * 0.8, starLifeVariation: this.starLifeVariation, starCount: Math.floor(Math.max(6, this.spreadSize / 45)), color: COLOR.White, glitter: "streamer" }).burst(x, y);
        BurstFlash.add(x, y, this.spreadSize / 4);
      }
    }

    // ─── Sequence launchers ──────────────────────────────────────────
    function fitH(p) { return (1 - 0.36) * p + 0.18; }
    function fitV(p) { return p * 0.75; }
    function getRandomShellSize() {
      const baseSize = shellSizeConfig;
      const maxVariance = Math.min(2.5, baseSize);
      const variance = Math.random() * maxVariance;
      const size = baseSize - variance;
      const h = maxVariance === 0 ? Math.random() : 1 - variance / maxVariance;
      const co = Math.random() * (1 - h * 0.65) * 0.5;
      const x = Math.random() < 0.5 ? 0.5 - co : 0.5 + co;
      return { size, x: fitH(x), height: fitV(h) };
    }
    function seqRandomShell() {
      const s = getRandomShellSize();
      const shell = new Shell(randomShell(s.size));
      shell.launch(s.x, s.height);
      return 900 + Math.random() * 600 + (shell.fallingLeaves ? 4600 : shell.starLife);
    }
    function seqTwoRandom() {
      const s1 = getRandomShellSize(), s2 = getRandomShellSize();
      const sh1 = new Shell(randomShell(s1.size)), sh2 = new Shell(randomShell(s2.size));
      sh1.launch(0.3 + Math.random() * 0.2 - 0.1, s1.height);
      setTimeout(() => { if (!destroyed) sh2.launch(0.7 + Math.random() * 0.2 - 0.1, s2.height); }, 100);
      return 900 + Math.random() * 600 + Math.max(sh1.starLife, sh2.starLife);
    }
    function seqTriple() {
      const st = randomFastShell();
      const bs = shellSizeConfig, ss = Math.max(0, bs - 1.25);
      new Shell(st(bs)).launch(0.5 + Math.random() * 0.08 - 0.04, 0.7);
      setTimeout(() => { if (!destroyed) new Shell(st(ss)).launch(0.2 + Math.random() * 0.08 - 0.04, 0.1); }, 1000 + Math.random() * 400);
      setTimeout(() => { if (!destroyed) new Shell(st(ss)).launch(0.8 + Math.random() * 0.08 - 0.04, 0.1); }, 1000 + Math.random() * 400);
      return 4000;
    }

    let isFirstSeq = true;
    function startSequence() {
      if (isFirstSeq) { isFirstSeq = false; new Shell(crysanthemumShell(shellSizeConfig)).launch(0.5, 0.5); return 2400; }
      const r = Math.random();
      if (r < 0.6) return seqRandomShell();
      if (r < 0.8) return seqTwoRandom();
      return seqTriple();
    }

    // ─── Simulation step (called from useFrame) ──────────────────────
    let lastTime = 0;
    function step(timestamp) {
      if (!running) { lastTime = timestamp; return; }
      let frameTime = timestamp - lastTime;
      lastTime = timestamp;
      if (frameTime < 0 || frameTime > 68) frameTime = 16.667;
      const lag = frameTime / 16.667;
      const timeStep = frameTime * simSpeed;
      const speed = simSpeed * lag;

      currentFrame++;
      autoLaunchTime -= timeStep;
      if (autoLaunchTime <= 0) autoLaunchTime = startSequence() * 1.25;

      const starDrag = 1 - (1 - Star.airDrag) * speed;
      const starDragHeavy = 1 - (1 - Star.airDragHeavy) * speed;
      const sparkDrag = 1 - (1 - Spark.airDrag) * speed;
      const gAcc = (timeStep / 1000) * GRAVITY;

      COLOR_CODES_W_INVIS.forEach((color) => {
        const stars = Star.active[color];
        for (let i = stars.length - 1; i >= 0; i--) {
          const star = stars[i];
          if (star.updateFrame === currentFrame) continue;
          star.updateFrame = currentFrame;
          star.life -= timeStep;
          if (star.life <= 0) { stars.splice(i, 1); Star.returnInstance(star); }
          else {
            const burnRate = Math.pow(star.life / star.fullLife, 0.5);
            const burnRateInverse = 1 - burnRate;
            star.prevX = star.x; star.prevY = star.y;
            star.x += star.speedX * speed; star.y += star.speedY * speed;
            if (!star.heavy) { star.speedX *= starDrag; star.speedY *= starDrag; }
            else { star.speedX *= starDragHeavy; star.speedY *= starDragHeavy; }
            star.speedY += gAcc;
            if (star.spinRadius) { star.spinAngle += star.spinSpeed * speed; star.x += Math.sin(star.spinAngle) * star.spinRadius * speed; star.y += Math.cos(star.spinAngle) * star.spinRadius * speed; }
            if (star.sparkFreq) {
              star.sparkTimer -= timeStep;
              while (star.sparkTimer < 0) {
                star.sparkTimer += star.sparkFreq * 0.75 + star.sparkFreq * burnRateInverse * 4;
                Spark.add(star.x, star.y, star.sparkColor, Math.random() * PI_2, Math.random() * star.sparkSpeed * burnRate, star.sparkLife * 0.8 + Math.random() * star.sparkLifeVariation * star.sparkLife);
              }
            }
            if (star.life < star.transitionTime) {
              if (star.secondColor && !star.colorChanged) {
                star.colorChanged = true; star.color = star.secondColor;
                stars.splice(i, 1); Star.active[star.secondColor].push(star);
                if (star.secondColor === INVISIBLE) star.sparkFreq = 0;
              }
              if (star.strobe) star.visible = Math.floor(star.life / star.strobeFreq) % 3 === 0;
            }
          }
        }
        const sparks = Spark.active[color];
        for (let i = sparks.length - 1; i >= 0; i--) {
          const spark = sparks[i];
          spark.life -= timeStep;
          if (spark.life <= 0) { sparks.splice(i, 1); Spark.returnInstance(spark); }
          else {
            spark.prevX = spark.x; spark.prevY = spark.y;
            spark.x += spark.speedX * speed; spark.y += spark.speedY * speed;
            spark.speedX *= sparkDrag; spark.speedY *= sparkDrag; spark.speedY += gAcc;
          }
        }
      });

      // ── Render to offscreen canvases ──
      // Trails: fade via destination-out
      trailsCtx.globalCompositeOperation = "destination-out";
      trailsCtx.fillStyle = `rgba(0, 0, 0, ${0.175 * speed})`;
      trailsCtx.fillRect(0, 0, stageW, stageH);
      trailsCtx.globalCompositeOperation = "source-over";

      mainCtx.clearRect(0, 0, stageW, stageH);

      // Burst flashes
      while (BurstFlash.active.length) {
        const bf = BurstFlash.active.pop();
        const g = trailsCtx.createRadialGradient(bf.x, bf.y, 0, bf.x, bf.y, bf.radius);
        g.addColorStop(0.024, "rgba(255, 255, 255, 1)");
        g.addColorStop(0.125, "rgba(255, 160, 20, 0.2)");
        g.addColorStop(0.32, "rgba(255, 140, 20, 0.11)");
        g.addColorStop(1, "rgba(255, 120, 20, 0)");
        trailsCtx.fillStyle = g;
        trailsCtx.fillRect(bf.x - bf.radius, bf.y - bf.radius, bf.radius * 2, bf.radius * 2);
        BurstFlash.returnInstance(bf);
      }

      trailsCtx.globalCompositeOperation = "lighter";

      // Stars
      trailsCtx.lineWidth = Star.drawWidth;
      trailsCtx.lineCap = isLowQuality ? "square" : "round";
      mainCtx.strokeStyle = "#fff"; mainCtx.lineWidth = 1; mainCtx.beginPath();
      COLOR_CODES.forEach((color) => {
        const stars = Star.active[color];
        trailsCtx.strokeStyle = color; trailsCtx.beginPath();
        stars.forEach((star) => {
          if (star.visible) {
            trailsCtx.moveTo(star.x, star.y); trailsCtx.lineTo(star.prevX, star.prevY);
            mainCtx.moveTo(star.x, star.y); mainCtx.lineTo(star.x - star.speedX * 1.6, star.y - star.speedY * 1.6);
          }
        });
        trailsCtx.stroke();
      });
      mainCtx.stroke();

      // Sparks
      trailsCtx.lineWidth = Spark.drawWidth; trailsCtx.lineCap = "butt";
      COLOR_CODES.forEach((color) => {
        const sparks = Spark.active[color];
        trailsCtx.strokeStyle = color; trailsCtx.beginPath();
        sparks.forEach((spark) => { trailsCtx.moveTo(spark.x, spark.y); trailsCtx.lineTo(spark.prevX, spark.prevY); });
        trailsCtx.stroke();
      });

      trailsCtx.setTransform(1, 0, 0, 1, 0, 0);
      mainCtx.setTransform(1, 0, 0, 1, 0, 0);

      // Composite trails + main onto output canvas
      outputCtx.clearRect(0, 0, TEX_W, TEX_H);
      outputCtx.drawImage(trailsCanvas, 0, 0);
      outputCtx.drawImage(mainCanvas, 0, 0);
    }

    engineRef.current = {
      step,
      setRunning(v) { running = v; },
      setQuality(q) { quality = q; isLowQuality = q === 1; isHighQuality = q === 3; Spark.drawWidth = q === 3 ? 0.75 : 1; },
      setShellSize(s) { shellSizeConfig = s; },
      destroy() { destroyed = true; },
    };

    return () => { engineRef.current?.destroy(); engineRef.current = null; };
  }, [outputCanvas]);

  // Sync props
  useEffect(() => { engineRef.current?.setRunning(enabled); }, [enabled]);
  useEffect(() => { engineRef.current?.setQuality(qualityProp); }, [qualityProp]);
  useEffect(() => { engineRef.current?.setShellSize(shellSizeProp); }, [shellSizeProp]);

  // Drive simulation from R3F render loop
  useFrame((state) => {
    if (!engineRef.current) return;
    engineRef.current.step(state.clock.getElapsedTime() * 1000);
    texture.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} renderOrder={-1}>
      <sphereGeometry args={[radius, 32, 16]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}
