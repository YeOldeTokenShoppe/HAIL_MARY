'use client';

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';

const DEFAULT_HORSES = [
  { name: 'Bungus', color: 'brown', number: 1 },
  { name: 'Chungus', color: 'red', number: 2 },
  { name: 'Amungus', color: 'lime', number: 3 },
  { name: 'Flungus', color: 'purple', number: 4 },
  { name: 'Chippewa', color: 'orange', number: 5 },
  { name: 'Fleen', color: 'yellow', number: 6 },
  { name: 'Awooga', color: 'gray', number: 7 },
  { name: 'Lasty', color: 'beige', number: 8 },
];

function createSeededRandom(seed) {
  let s = seed;
  return function () {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
}

const randIntWithRng = (rng, min, max) => {
  return Math.floor(rng() * (max - min + 1)) + min;
};

// Clockwise stadium oval — horses go RIGHT on the home stretch (bottom)
// Path starts at bottom-right, so the home stretch is the LAST segment
function makeOvalPath(cx, cy, hs, r) {
  return [
    `M ${cx + hs},${cy + r}`,
    `A ${r},${r} 0 0 0 ${cx + hs},${cy - r}`,
    `L ${cx - hs},${cy - r}`,
    `A ${r},${r} 0 0 0 ${cx - hs},${cy + r}`,
    `L ${cx + hs},${cy + r}`,
    'Z',
  ].join(' ');
}

const HORSE_SCALE = 0.45;

const OvalHorseRace = forwardRef(({
  horses = DEFAULT_HORSES,
  maxRaceTime = 25000,
  maxRaceDiff = 4000,
  autoStart = false,
  seed = null,
  showRestartButton = true,
  onRaceStart = null,
  onRaceComplete = null,
  onHorseFinish = null,
  className = '',
  style = {},
}, ref) => {
  const svgRef = useRef(null);
  const [isRacing, setIsRacing] = useState(false);
  const [raceStarted, setRaceStarted] = useState(false);
  const [raceResults, setRaceResults] = useState([]);
  const [animationData, setAnimationData] = useState(null);
  const [raceKey, setRaceKey] = useState(0);
  const finishOrderRef = useRef([]);
  const horsesRef = useRef(horses);
  const motionGroupRefs = useRef([]);
  const flipGroupRefs = useRef([]);
  const prevXPositions = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => { horsesRef.current = horses; }, [horses]);

  useImperativeHandle(ref, () => ({
    startRace: () => startRace(),
    resetRace: () => resetRace(),
    isRacing,
    results: raceResults,
  }));

  // Track geometry
  const cx = 400;
  const cy = 210;
  const hs = 160;
  const laneW = Math.min(9, 72 / horses.length);
  const innerR = 80;
  const outerR = innerR + horses.length * laneW;
  const getLaneR = (i) => innerR + laneW * (i + 0.5);

  const vw = 800;
  const vh = cy + outerR + 55;

  const generateAllAnimations = useCallback(() => {
    const animations = [];
    for (let i = 0; i < horses.length; i++) {
      const horseSeed = seed !== null ? seed + i * 1000 : Date.now() + i * 1000 + Math.random() * 1000;
      const rng = createSeededRandom(horseSeed);

      const steps = randIntWithRng(rng, 7, 14);
      let keyTimes = '0';
      let keyPoints = '0';
      let splines = '';

      for (let j = 1; j < steps; j++) {
        const timeFrac = j / steps;
        keyTimes += `;${timeFrac.toFixed(4)}`;
        const lower = timeFrac - (1 / steps) * 0.5;
        const upper = timeFrac + (1 / steps) * 0.5;
        const posFrac = randIntWithRng(rng, Math.floor(lower * 10000), Math.floor(upper * 10000)) / 10000;
        keyPoints += `;${Math.min(posFrac, 0.9999).toFixed(4)}`;
        splines += `${(randIntWithRng(rng, 10, 100) / 100).toFixed(2)} ${(randIntWithRng(rng, 10, 100) / 100).toFixed(2)} ${(randIntWithRng(rng, 10, 100) / 100).toFixed(2)} ${(randIntWithRng(rng, 10, 100) / 100).toFixed(2)};`;
      }

      keyTimes += ';1';
      keyPoints += ';1';
      splines += '0 0 0 0';

      const dur = randIntWithRng(rng, maxRaceTime - maxRaceDiff, maxRaceTime);
      const gallopOffset = randIntWithRng(rng, -3000, 0);
      const brightness = randIntWithRng(rng, 30, 70);

      animations.push({ keyTimes, keyPoints, splines, dur, gallopOffset, brightness });
    }
    return animations;
  }, [horses.length, maxRaceTime, maxRaceDiff, seed]);

  const resetRace = useCallback(() => {
    setRaceResults([]);
    setRaceStarted(false);
    setAnimationData(null);
    finishOrderRef.current = [];
    setIsRacing(false);
  }, []);

  const startRace = useCallback(() => {
    if (isRacing) return;
    setRaceResults([]);
    finishOrderRef.current = [];
    setRaceKey(k => k + 1);
    const newAnimations = generateAllAnimations();
    setAnimationData(newAnimations);
    setRaceStarted(true);
    setIsRacing(true);
    if (onRaceStart) onRaceStart();
  }, [isRacing, onRaceStart, generateAllAnimations]);

  const handleAnimationEndRef = useRef(null);
  handleAnimationEndRef.current = (laneIndex) => {
    const horseData = horsesRef.current[laneIndex];
    const position = finishOrderRef.current.length + 1;
    const result = { position, horse: horseData, lane: laneIndex };
    finishOrderRef.current.push(result);
    if (onHorseFinish) onHorseFinish(result);
    if (finishOrderRef.current.length === horsesRef.current.length) {
      setIsRacing(false);
      setRaceResults([...finishOrderRef.current]);
      if (onRaceComplete) onRaceComplete([...finishOrderRef.current]);
    }
  };

  useEffect(() => {
    if (!isRacing || !animationData || !svgRef.current) return;
    const timer = setTimeout(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const motions = svg.querySelectorAll('.player-motion');
      motions.forEach((motion, index) => {
        const handler = () => handleAnimationEndRef.current(index);
        motion._endHandler = handler;
        motion.addEventListener('endEvent', handler);
        motion.beginElement();
      });
    }, 50);
    return () => {
      clearTimeout(timer);
      const svg = svgRef.current;
      if (svg) {
        const motions = svg.querySelectorAll('.player-motion');
        motions.forEach((motion) => {
          if (motion._endHandler) motion.removeEventListener('endEvent', motion._endHandler);
        });
      }
    };
  }, [isRacing, animationData]);

  // Track horse direction each frame and flip graphic when moving left
  useEffect(() => {
    if (!isRacing || !animationData) {
      prevXPositions.current = [];
      return;
    }

    const updateFlips = () => {
      motionGroupRefs.current.forEach((el, i) => {
        const flipEl = flipGroupRefs.current[i];
        if (!el || !flipEl) return;

        const ctm = el.getScreenCTM();
        if (!ctm) return;
        const currX = ctm.e;
        const prevX = prevXPositions.current[i];

        if (prevX !== undefined) {
          const dx = currX - prevX;
          if (dx < -0.3) {
            // Moving left — mirror horse horizontally around its center (~x=12)
            flipEl.setAttribute('transform', 'translate(24, 0) scale(-1, 1)');
          } else if (dx > 0.3) {
            // Moving right — normal
            flipEl.setAttribute('transform', '');
          }
        }
        prevXPositions.current[i] = currX;
      });

      rafRef.current = requestAnimationFrame(updateFlips);
    };

    // Delay slightly so animations are running before we start tracking
    const startTimer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(updateFlips);
    }, 120);

    return () => {
      clearTimeout(startTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRacing, animationData]);

  useEffect(() => {
    if (autoStart) {
      const timer = setTimeout(() => startRace(), 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, startRace]);

  const getMedalForLane = (laneIndex) => {
    const result = raceResults.find(r => r.lane === laneIndex);
    if (!result) return null;
    if (result.position === 1) return 'gold';
    if (result.position === 2) return 'silver';
    if (result.position === 3) return '#b96b1e';
    return null;
  };

  const finishX = cx + hs;

  return (
    <div className={`oval-race-container ${className}`} style={style}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${vw} ${vh}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          {/* Dirt texture */}
          <filter id="oval-dirt">
            <feTurbulence baseFrequency="0.65" numOctaves="8" seed="42" />
            <feColorMatrix values="2.4 -0.6 -2.8 -1.7 -0.3 -3.1 -1.8 -1.8 -4.1 2.7 0.8 -3.1 2.9 -0.8 3.7 -2.2 4.2 -0.5 3.1 -1.3" />
            <feDiffuseLighting lightingColor="rgb(139,90,55)" surfaceScale="1.5">
              <feDistantLight azimuth="270" elevation="80" />
            </feDiffuseLighting>
          </filter>
          {/* Shadow blur */}
          <filter id="oval-blur" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
          </filter>
          {/* Horse body */}
          <path
            id="oval-horse"
            d="M 10 0 c 1.7 0.1 4.6 -1 5.5 -1.6 c -0.7 -0.2 -1.1 -0.2 -1 -0.3 c 1.2 -0.1 1.4 -0.1 1.5 -0.1 c 0 0 0.2 0 0.2 -0.1 c 0 0 -0.2 0 -0.2 0 c -0.2 -0.1 -0.5 -0.2 -0.6 -0.2 c 0 0 -0.2 0 -0.2 0 c 0 -0.1 0.2 -0.1 0.2 -0.1 c 0.3 0 0.5 -0.1 0.8 -0.1 c 0.1 0 0.4 0 0.4 0 c 0 -0.1 -0.3 -0.1 -0.5 -0.2 c -0.1 -0.1 0.6 -0.2 0.8 -0.1 c 0 0 0.3 0.1 0.3 0 c 0 -0.1 -0.7 -0.3 -0.7 -0.4 c 0.2 -0.1 0.5 0 0.9 0.1 c 0.2 0 0.7 0.2 0.7 0.1 c 0.1 -0.2 -0.5 -0.3 -0.4 -0.4 c 0 -0.2 0.5 -0.1 0.8 0 c 0.4 0.1 0.6 0 0.5 -0.1 c -0.5 -0.3 0 -0.2 0.1 -0.2 c 0.3 0 0.6 0.1 0.8 0.2 c 0.2 0.1 -0.1 -0.3 0 -0.4 c 0 -0.1 0.5 0.1 0.7 0.2 c 0.1 0 0.2 0 0.3 -0.1 c 0.1 -0.1 0.2 -0.3 0.2 -0.4 c 0 -0.1 0.2 -0.2 0.3 -0.4 c 0.1 -0.1 0.1 -0.4 0.2 -0.4 c 0.1 0 0.4 0.4 0.4 0.5 c 0.1 0.2 0.2 0.5 0.3 0.7 c 0.1 0.1 0 0.4 0 0.5 c 0 0 0 0 0 0 c 0.2 0.2 0.3 0.5 0.5 0.6 c 0.3 0.4 1.1 1.8 1.3 2.1 c 0.2 0.3 0.8 1 0.8 1.1 c 0 0.2 0.1 0.4 0.2 0.5 c 0.2 0.2 0.1 0.5 0 0.7 c -0.1 0.2 -0.4 0.3 -0.5 0.3 c -0.1 0.1 -0.4 0.2 -0.5 0.1 c -0.2 0 -0.2 -0.2 -0.5 -0.5 c -0.4 -0.3 -0.7 -0.8 -1 -1.1 c -0.4 -0.1 -0.8 -0.3 -1.1 -0.3 c -0.2 -0.1 -0.6 -0.2 -0.8 -0.4 c -0.3 0.4 -2.5 2.3 -2.8 2.5 c -0.1 1.1 -0.1 2.1 -0.2 2.4 c -0.2 0.3 -0.3 0.6 -0.1 0.9 c 0.6 1.1 1.5 2.6 1.6 2.8 c 0.2 0.3 0.3 0.2 0.5 0.5 c 0.1 0.3 0.8 1.7 1.4 2.2 c 0.5 0.4 1.1 1.2 1.4 1.4 c 0.2 0.3 0.7 0.5 0.9 0.7 c 0.1 0.3 0.5 0.8 0.5 0.9 c -0.1 0.1 -1.4 0 -1.4 -0.2 c -0.1 -0.3 -0.2 -0.5 -0.1 -0.7 c -0.2 -0.1 -0.5 -0.5 -0.9 -0.5 c -0.3 -0.1 -1.5 -2.1 -1.7 -2.4 c -0.3 -0.3 -0.4 -0.1 -0.7 -0.5 c -0.4 -0.4 -0.5 -0.8 -1 -1.1 c -0.4 -0.2 -1.3 -1.5 -1.9 -2.2 c -0.5 0.1 -0.8 0.2 -1.3 0.2 c 0 0 0 0 0 0 c 0 0 0 0 0 0 c -0.1 0 -0.1 0 -0.1 0 c -0.6 0.1 -1.5 0.8 -1.8 1.2 c -0.4 0.4 -1 0.8 -1.4 1.4 c -0.3 0.4 -0.7 1.1 -1.2 1.7 c -0.3 0.4 -0.6 0.7 -0.6 0.8 c 0.1 0.3 -0.5 0.9 -0.6 1 c -0.1 0.2 0 0.4 0.1 0.6 c 0.2 0.3 0 1 -0.1 1.1 c -0.1 0.2 -1.3 -0.7 -1.1 -1 c 0.1 -0.2 0.5 -0.5 0.5 -0.6 c 0 -0.2 0.2 -0.6 0.3 -0.9 c 0.2 -0.2 1.1 -1.3 1.2 -1.5 c 0.1 -0.3 0.5 -1.4 0.6 -1.6 c 0.1 -0.4 0.6 -0.8 0.9 -1.3 c 0.1 -0.1 0.2 -0.3 0.3 -0.5 c -1.1 -0.2 -2.3 -0.6 -3.1 -0.9 c -1 -0.3 -3.4 -1.4 -4 -1.4 c -0.9 0.1 -1.4 0.4 -2.2 0.6 c -1 0.4 -1.6 1.2 -1.9 1.3 c -0.5 0.1 -1.2 1.5 -1.4 1.8 c -0.4 0.3 -1.4 1.2 -1.5 1.4 c -0.1 0.2 -0.2 0.3 -0.4 0.4 c -0.4 0.2 -1.3 1.3 -1.4 1.7 c -0.1 0.5 -0.3 0.7 -0.5 0.8 c -0.3 0.2 -0.5 0.1 -0.7 0.5 c -0.1 0.3 -0.5 1.2 -1.1 1.4 c -0.5 0.1 -0.4 -0.3 -0.4 -0.6 c 0 -0.4 0.2 -1 0.5 -1 c 0.3 -0.1 0.5 0 0.6 -0.2 c 0.2 -0.2 0.1 -0.4 0.3 -0.6 c 0.2 -0.2 0.8 -0.5 0.9 -0.9 c 0.2 -0.4 0.8 -1.4 0.8 -1.8 c 0.1 -0.4 0.9 -1.2 1.2 -1.6 c -0.7 0.5 -2.4 1.5 -2.7 1.7 c -0.3 0.3 -0.7 1.1 -0.9 1.2 c -0.3 0.2 -0.7 0.4 -1 0.5 c -0.3 0.1 -0.6 0.2 -1 0.4 c -0.5 0.1 -0.7 0.1 -0.8 0.1 c -0.2 -0.1 -0.1 -1.1 0.5 -1.4 c 0.5 0 0.7 0.2 1 0.1 c 0.3 -0.1 0.2 -0.4 0.4 -0.5 c 0.2 -0.1 0.8 -0.2 0.9 -0.4 c 0.2 -0.2 1.4 -1.4 1.6 -1.7 c 0.3 -0.4 0.7 -1.2 0.9 -1.4 c 0.3 -0.2 0.9 -0.3 1.3 -0.5 c 0.4 -0.2 0.9 -0.6 1.2 -1.1 c -0.2 -0.9 0 -2.2 -0.1 -2.8 c 0 -0.5 0.2 -1 0.4 -1.4 c 0 -0.1 0 -0.1 -0.1 -0.1 c -0.4 -0.1 -0.9 0.4 -1.2 0.5 c -1.1 0.3 -0.9 0.2 -0.6 0 c -1.3 0.2 -1.8 0.6 -1.8 0.6 c 0.1 -0.1 0.2 -0.2 0.3 -0.3 c -0.2 0 -0.6 0.4 -0.9 0.5 c -0.6 0.1 -0.8 0.1 -0.9 0.2 c -0.1 0 -0.2 0 -0.2 0 c 0 0 0.2 -0.1 0.2 -0.1 c 0.1 0 0.3 -0.1 0.4 -0.2 c 0.1 -0.1 0.1 -0.1 0.1 -0.1 c -0.1 -0.1 -0.3 0 -0.4 0 c -0.2 0 -0.4 0.2 -0.5 0.2 c -1.1 0.2 -1.6 0.3 -1.6 0.3 c 0.6 -0.3 1 -0.3 1.1 -0.4 c -2 0.1 -2.2 0.2 -2.5 0.3 c 0 -0.1 0.6 -0.4 1.3 -0.5 c -0.2 -0.1 -1.6 -0.1 -1.8 0 c 0.1 -0.1 0.1 -0.1 0.4 -0.2 c 1.6 -0.3 1.8 -0.4 1.9 -0.4 c 0 0 -0.1 0 -0.1 0 l -0.5 0 c -0.4 0 -0.7 -0.2 -1.1 -0.2 c -0.8 0 0.2 -0.1 0.2 -0.1 c 0.1 0 0.1 0 0.3 -0.1 c -0.2 -0.1 -0.7 -0.1 -0.9 0 c -0.2 0.1 -0.3 0.2 -0.4 0.2 c 0.2 -0.3 0.5 -0.4 0.7 -0.4 c 0.5 0 1.3 -0.1 1.7 -0.1 c 0.6 0.1 0.7 0 0.7 0 c 0 0 0.4 -0.1 0.5 -0.1 c 0.5 0 1.2 0.3 1.7 0.2 c 0.3 0 0.5 0 0.7 -0.1 c -0.2 -0.1 -0.3 -0.1 -0.3 -0.2 c 0.1 0 0.5 0.1 0.6 0.1 c 0.8 0 1.1 0 1.4 -0.1 c 2.1 -0.2 2.2 -0.2 2.3 -0.3 c 0.5 -0.3 2.6 -0.7 3.6 -0.8 c 1.1 0 2.7 0.5 3.2 0.5 c 0.5 0 1.9 0.6 3.1 0.4 z"
            fill="tan"
          />
          {/* Jockey */}
          <path
            id="oval-jockey"
            d="M 10 0 c -1.1 -0.4 -1.5 -0.5 -2.3 -1 c -0.9 -0.5 -1.4 -1.3 -1.4 -1.7 c 0 -0.4 0.3 -1 1.3 -1.4 c 3 -1 3.8 -1 4.2 -1 c 2.1 -0.1 1.7 0.1 2.1 -1 c 0.5 -0.6 1.2 -0.7 1.6 -0.5 c 0.5 0.2 1.1 0.8 0.9 1.2 c 0 0.1 -0.1 0.2 -0.1 0.2 c 0 0.1 0.1 0.1 0.1 0.2 c 0.1 0 0.3 0.2 0.1 0.2 c -0.1 0 -0.3 0 -0.4 -0.1 c -0.1 0.1 -0.3 0.3 -0.3 0.5 c -0.1 0.4 -0.4 0.5 -0.5 0.7 c -0.3 0.2 -0.5 0.1 -0.8 -0.1 c -0.3 -0.2 -0.5 -0.1 -0.5 0.5 c 0 0.5 -0.4 0.6 -0.5 1 c -0.1 0.4 -0.2 0.8 0.3 1 c 0.5 0.2 1.7 0.6 1.8 0.3 c 0.1 -0.3 0.9 -0.2 0.8 0.2 c -0.1 0.4 -0.4 0.7 -0.8 0.4 c -0.3 -0.1 -0.8 0.3 -2.3 0.1 c -0.4 -0.1 -0.5 -0.1 -0.7 -0.5 c -0.2 -0.4 -0.1 -0.8 -0.7 -0.8 c -0.2 0 -1.1 0.1 -1.4 0.1 c 0.3 0.4 1.1 0.8 1.2 1.2 c 0.1 0.2 0 0.4 -0.1 0.5 c -0.4 0.4 -1.6 1.5 -1.8 1.8 c 0.4 0.1 0.9 0.1 0.9 0.2 c 0.1 0.2 0.1 0.3 0 0.4 c -0.4 0.4 -2.1 0.1 -2 -0.3 c 0.1 -0.4 0.6 -1.2 1.3 -2.3 z"
          />
          {/* Medal clip */}
          <clipPath id="oval-medalMask">
            <circle cx="50" cy="50" r="35" />
          </clipPath>

          {/* Lane motion paths */}
          {horses.map((_, i) => (
            <path
              key={`lp-${i}`}
              id={`oval-lane-${i}`}
              d={makeOvalPath(cx, cy, hs, getLaneR(i))}
              fill="none"
            />
          ))}
        </defs>

        {/* Background grass */}
        <rect x="0" y="0" width={vw} height={vh} fill="#2a7a2a" />

        {/* Track surface */}
        <path
          d={makeOvalPath(cx, cy, hs, outerR + 4)}
          fill="rgb(139,90,55)"
          filter="url(#oval-dirt)"
        />

        {/* Infield */}
        <path
          d={makeOvalPath(cx, cy, hs, innerR - 4)}
          fill="#2d8c2d"
        />

        {/* Inner rail */}
        <path
          d={makeOvalPath(cx, cy, hs, innerR)}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
        />

        {/* Outer rail */}
        <path
          d={makeOvalPath(cx, cy, hs, outerR)}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
        />

        {/* Lane dividers */}
        {horses.slice(1).map((_, i) => (
          <path
            key={`div-${i}`}
            d={makeOvalPath(cx, cy, hs, innerR + laneW * (i + 1))}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.5"
            strokeDasharray="6 4"
          />
        ))}

        {/* Finish line */}
        <line
          x1={finishX} y1={cy + innerR - 1}
          x2={finishX} y2={cy + outerR + 1}
          stroke="#fff" strokeWidth="3"
        />
        {Array.from({ length: Math.ceil((outerR - innerR + 2) / 3) }).map((_, i) => (
          <rect
            key={`chk-${i}`}
            x={finishX - 1.5 + (i % 2 === 0 ? 0 : 1.5)}
            y={cy + innerR - 1 + i * 3}
            width="1.5" height="3"
            fill={i % 2 === 0 ? '#000' : '#fff'}
          />
        ))}
        <text
          x={finishX} y={cy + outerR + 14}
          textAnchor="middle"
          fill="rgba(255,255,255,0.7)"
          fontSize="8" fontFamily="Arial, sans-serif" fontWeight="bold"
        >
          START / FINISH
        </text>

        {/* Infield text */}
        <text
          x={cx} y={cy - 8}
          textAnchor="middle"
          fill="rgba(255,255,255,0.3)"
          fontSize="16" fontFamily="Arial, sans-serif" fontWeight="bold"
          letterSpacing="6"
        >
          HAIL MARY
        </text>
        <text
          x={cx} y={cy + 10}
          textAnchor="middle"
          fill="rgba(255,255,255,0.2)"
          fontSize="10" fontFamily="Arial, sans-serif"
          letterSpacing="3"
        >
          RACEWAY
        </text>

        {/* Horse + Jockey graphics */}
        <g key={`race-${raceKey}`} className="horse-markers">
          {raceStarted && animationData && horses.map((horse, i) => {
            const anim = animationData[i];
            if (!anim) return null;
            const medal = getMedalForLane(i);
            const numStr = (horse.number || i + 1).toString();

            return (
              <g key={`h-${i}`}>
                <g ref={el => motionGroupRefs.current[i] = el}>
                  {/* Scaled horse + jockey group */}
                  <g transform={`scale(${HORSE_SCALE}) translate(-12, -4)`} stroke="#111" strokeWidth="0.25">
                    {/* Flip group — JS toggles transform to mirror when moving left */}
                    <g ref={el => flipGroupRefs.current[i] = el}>
                      {/* Shadow */}
                      <ellipse
                        filter="url(#oval-blur)"
                        cx="8" cy="15"
                        rx="17" ry="3"
                        fill="rgba(0,0,0,0.4)"
                        stroke="none"
                      />

                      {/* Galloping horse + number plate */}
                      <g className="oval-gallop">
                        <use
                          href="#oval-horse"
                          filter={`brightness(${anim.brightness}%)`}
                        />
                        {/* Number plate */}
                        <path
                          d={`M 10 -0.4 h ${4 + numStr.length} v 5 h -${4 + numStr.length}`}
                          fill="#fff"
                          stroke="none"
                        />
                        <text fontSize="4" x="11.5" y="3.5" stroke="none" fill="#000">
                          {horse.number || i + 1}
                        </text>
                        <animateTransform
                          attributeName="transform"
                          attributeType="XML"
                          type="rotate"
                          values="-10 10 0; 10 10 0; -10 10 0"
                          dur="500ms"
                          begin={`${anim.gallopOffset}ms`}
                          repeatCount="indefinite"
                        />
                      </g>

                      {/* Jockey */}
                      <use
                        href="#oval-jockey"
                        fill={horse.color}
                        transform="translate(0, -0.4)"
                      />
                    </g>
                  </g>

                  {/* Medal indicator */}
                  {medal && (
                    <circle r={laneW * 0.6} fill="none" stroke={medal} strokeWidth="1.5" />
                  )}

                  <animateMotion
                    className="player-motion"
                    keyPoints={anim.keyPoints}
                    keyTimes={anim.keyTimes}
                    keySplines={anim.splines}
                    calcMode="spline"
                    dur={`${anim.dur}ms`}
                    begin="indefinite"
                    fill="freeze"
                  >
                    <mpath href={`#oval-lane-${i}`} />
                  </animateMotion>
                </g>
              </g>
            );
          })}
        </g>

        {/* Legend */}
        {horses.map((horse, i) => {
          const legendY = cy + outerR + 35;
          const colW = (vw - 80) / horses.length;
          const lx = 40 + colW * i;
          return (
            <g key={`leg-${i}`}>
              <circle cx={lx} cy={legendY} r={4} fill={horse.color} stroke="#fff" strokeWidth="0.5" />
              <text x={lx + 7} y={legendY + 3} fill="#fff" fontSize="7" fontFamily="Arial, sans-serif">
                {horse.name}
              </text>
            </g>
          );
        })}
      </svg>

      {showRestartButton && (
        <button
          onClick={startRace}
          disabled={isRacing}
          style={{
            padding: '15px 30px',
            cursor: isRacing ? 'not-allowed' : 'pointer',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 700,
            borderRadius: '100px',
            fontSize: '1.5em',
            border: 'none',
            boxShadow: '0px 4px 4px #000',
            background: isRacing ? '#666' : '#fff',
            marginTop: '10px',
            transition: '200ms',
          }}
          title={isRacing ? 'Race in progress...' : 'Start the Race!'}
        >
          {isRacing ? 'Racing...' : 'Start Race'}
        </button>
      )}

      <style jsx>{`
        .oval-race-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #1a5c1a;
          padding: 20px;
          border-radius: 8px;
        }
        .horse-markers {
          opacity: 0;
          animation: oval-fadein 150ms 80ms forwards;
        }
        @keyframes oval-fadein {
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
});

OvalHorseRace.displayName = 'OvalHorseRace';
export default OvalHorseRace;
