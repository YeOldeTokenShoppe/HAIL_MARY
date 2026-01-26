'use client';

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';

// Default horses if none provided
const DEFAULT_HORSES = [
  { name: 'Bungus', color: 'brown', number: 1 },
  { name: 'Chungus', color: 'red', number: 2 },
  { name: 'Amungus', color: 'lime', number: 3 },
  { name: 'Flungus', color: 'purple', number: 4 },
  { name: 'Chippewa', color: 'orange', number: 5 },
  { name: 'Fleen', color: 'yellow', number: 6 },
  { name: 'Awooga', color: 'gray', number: 7 },
  { name: 'Lasty', color: 'beige', number: 8 },
  { name: 'Carumba', color: 'goldenrod', number: 9 },
  { name: 'Horse', color: 'lightblue', number: 10 },
  { name: 'Horse 2', color: 'lightgreen', number: 11 },
  { name: 'Mr. Ed', color: 'steelblue', number: 12 },
];

// Seeded random number generator for synchronized races
function createSeededRandom(seed) {
  let s = seed;
  return function() {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
}

const randIntWithRng = (rng, min, max) => {
  return Math.floor(rng() * (max - min + 1)) + min;
};

const HorseRace = forwardRef(({
  horses = DEFAULT_HORSES,
  raceLength = 500,
  maxRaceTime = 7000,
  maxRaceDiff = 2000,
  autoStart = false,
  seed = null, // For synchronized/simulcast races
  showMedals = true,
  showRestartButton = true,
  onRaceStart = null,
  onRaceComplete = null,
  onHorseFinish = null,
  className = '',
  style = {},
}, ref) => {
  const svgRef = useRef(null);
  const [isRacing, setIsRacing] = useState(false);
  const [raceStarted, setRaceStarted] = useState(false); // Track if race has ever started
  const [raceResults, setRaceResults] = useState([]);
  const [animationData, setAnimationData] = useState(null); // Store generated animations
  const [raceKey, setRaceKey] = useState(0); // Force remount of horse elements on new race
  const finishOrderRef = useRef([]);
  const horsesRef = useRef(horses); // Track horses for event handlers

  // Keep horsesRef in sync
  useEffect(() => {
    horsesRef.current = horses;
  }, [horses]);

  // Expose startRace method via ref
  useImperativeHandle(ref, () => ({
    startRace: () => startRace(),
    resetRace: () => resetRace(),
    isRacing: isRacing,
    results: raceResults,
  }));

  const finishLinePos = raceLength - 100;
  const buildingH = (horses.length * 20) + 4;
  const viewBoxHeight = (horses.length * 20) + 20;

  // Generate animation data for all horses (called once per race)
  const generateAllAnimations = useCallback(() => {
    const animations = [];
    const finishLine = raceLength - 100;

    for (let i = 0; i < horses.length; i++) {
      // Create a unique RNG for each horse
      const horseSeed = seed !== null ? seed + i * 1000 : Date.now() + i * 1000 + Math.random() * 1000;
      const rng = createSeededRandom(horseSeed);

      const steps = randIntWithRng(rng, 7, 14);
      let keyTimes = '0';
      let splines = '';
      let vals = '10'; // Starting position

      for (let j = 1; j < steps; j++) {
        keyTimes += `;${j / steps}`;
        const lowerLimit = j / steps - (1 / steps) * 0.5;
        const upperLimit = j / steps + (1 / steps) * 0.5;
        vals += `;${randIntWithRng(rng, Math.floor((finishLine - 30) * lowerLimit), Math.floor((finishLine - 30) * upperLimit))}`;
        splines += `${randIntWithRng(rng, 10, 100) / 100} ${randIntWithRng(rng, 10, 100) / 100} ${randIntWithRng(rng, 10, 100) / 100} ${randIntWithRng(rng, 10, 100) / 100};`;
      }

      keyTimes += ';1';
      splines += '0 0 0 0';
      vals += `;${finishLine - 30}`; // End position

      const dur = randIntWithRng(rng, maxRaceTime - maxRaceDiff, maxRaceTime);
      const gallopOffset = randIntWithRng(rng, -3000, 0);
      const brightness = randIntWithRng(rng, 30, 70);

      animations.push({ keyTimes, splines, vals, dur, gallopOffset, brightness });
    }

    return animations;
  }, [horses.length, raceLength, maxRaceTime, maxRaceDiff, seed]);

  const resetRace = useCallback(() => {
    setRaceResults([]);
    setRaceStarted(false);
    setAnimationData(null);
    finishOrderRef.current = [];
    setIsRacing(false);
  }, []);

  const startRace = useCallback(() => {
    if (isRacing) return;

    // Reset state
    setRaceResults([]);
    finishOrderRef.current = [];

    // Increment race key to force remount of horse elements (clears frozen animations)
    setRaceKey(k => k + 1);

    // Generate new animation data for this race
    const newAnimations = generateAllAnimations();
    setAnimationData(newAnimations);
    setRaceStarted(true);
    setIsRacing(true);

    if (onRaceStart) {
      onRaceStart();
    }
  }, [isRacing, onRaceStart, generateAllAnimations]);

  // Handle animation end - using ref to avoid stale closures
  const handleAnimationEndRef = useRef(null);
  handleAnimationEndRef.current = (laneIndex) => {
    const horseData = horsesRef.current[laneIndex];
    const position = finishOrderRef.current.length + 1;
    const result = {
      position,
      horse: horseData,
      lane: laneIndex,
    };

    finishOrderRef.current.push(result);

    // Update results after each finish (enables incremental medal throw animations)
    setRaceResults([...finishOrderRef.current]);

    if (onHorseFinish) {
      onHorseFinish(result);
    }

    // Check if race is complete
    if (finishOrderRef.current.length === horsesRef.current.length) {
      setIsRacing(false);
      if (onRaceComplete) {
        onRaceComplete([...finishOrderRef.current]);
      }
    }
  };

  // Start SVG animations and attach event listeners after animation data is set
  useEffect(() => {
    if (!isRacing || !animationData || !svgRef.current) return;

    // Small delay to ensure DOM has updated with new animation elements
    const timer = setTimeout(() => {
      const svg = svgRef.current;
      if (!svg) return;

      // Start gate animations
      const gates = svg.querySelectorAll('.gate-anim');
      gates.forEach(gate => {
        gate.beginElement();
      });

      // Attach event listeners and start player animations
      const players = svg.querySelectorAll('.player-anim');
      players.forEach((player, index) => {
        // Remove any existing listener first
        const handler = () => {
          handleAnimationEndRef.current(index);
        };
        // Store handler on element for potential cleanup
        player._endHandler = handler;
        player.addEventListener('endEvent', handler);
        player.beginElement();
      });
    }, 50);

    return () => {
      clearTimeout(timer);
      // Cleanup listeners
      const svg = svgRef.current;
      if (svg) {
        const players = svg.querySelectorAll('.player-anim');
        players.forEach((player) => {
          if (player._endHandler) {
            player.removeEventListener('endEvent', player._endHandler);
          }
        });
      }
    };
  }, [isRacing, animationData]);

  useEffect(() => {
    if (autoStart) {
      const timer = setTimeout(() => startRace(), 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, startRace]);

  // Get medal position for a lane
  const getMedalForLane = (laneIndex) => {
    const result = raceResults.find(r => r.lane === laneIndex);
    if (!result) return null;
    if (result.position === 1) return 'gold';
    if (result.position === 2) return 'silver';
    if (result.position === 3) return 'bronze';
    return null;
  };

  const getFinishPosition = (laneIndex) => {
    const result = raceResults.find(r => r.lane === laneIndex);
    if (!result || result.position <= 3) return null;
    return result.position;
  };

  return (
    <div className={`horse-race-container ${className}`} style={style}>
      <svg
        ref={svgRef}
        viewBox={`-10 -10 ${raceLength} ${viewBoxHeight}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <filter id="hr-mud">
            <feTurbulence baseFrequency="0.85" numOctaves="10" seed="113" />
            <feColorMatrix values="2.4 -0.6 -2.8 -1.7 -0.3 -3.1 -1.8 -1.8 -4.1 2.7 0.8 -3.1 2.9 -0.8 3.7 -2.2 4.2 -0.5 3.1 -1.3" />
            <feDiffuseLighting lightingColor="rgb(102,74,52)" surfaceScale="1">
              <feDistantLight azimuth="270" elevation="90" />
            </feDiffuseLighting>
          </filter>
          <filter id="hr-blur" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
          <radialGradient id="hr-grad">
            <stop offset="50%" stopColor="forestgreen" />
            <stop offset="100%" stopColor="green" />
          </radialGradient>
          <path
            id="hr-horse"
            d="M 10 0 c 1.7 0.1 4.6 -1 5.5 -1.6 c -0.7 -0.2 -1.1 -0.2 -1 -0.3 c 1.2 -0.1 1.4 -0.1 1.5 -0.1 c 0 0 0.2 0 0.2 -0.1 c 0 0 -0.2 0 -0.2 0 c -0.2 -0.1 -0.5 -0.2 -0.6 -0.2 c 0 0 -0.2 0 -0.2 0 c 0 -0.1 0.2 -0.1 0.2 -0.1 c 0.3 0 0.5 -0.1 0.8 -0.1 c 0.1 0 0.4 0 0.4 0 c 0 -0.1 -0.3 -0.1 -0.5 -0.2 c -0.1 -0.1 0.6 -0.2 0.8 -0.1 c 0 0 0.3 0.1 0.3 0 c 0 -0.1 -0.7 -0.3 -0.7 -0.4 c 0.2 -0.1 0.5 0 0.9 0.1 c 0.2 0 0.7 0.2 0.7 0.1 c 0.1 -0.2 -0.5 -0.3 -0.4 -0.4 c 0 -0.2 0.5 -0.1 0.8 0 c 0.4 0.1 0.6 0 0.5 -0.1 c -0.5 -0.3 0 -0.2 0.1 -0.2 c 0.3 0 0.6 0.1 0.8 0.2 c 0.2 0.1 -0.1 -0.3 0 -0.4 c 0 -0.1 0.5 0.1 0.7 0.2 c 0.1 0 0.2 0 0.3 -0.1 c 0.1 -0.1 0.2 -0.3 0.2 -0.4 c 0 -0.1 0.2 -0.2 0.3 -0.4 c 0.1 -0.1 0.1 -0.4 0.2 -0.4 c 0.1 0 0.4 0.4 0.4 0.5 c 0.1 0.2 0.2 0.5 0.3 0.7 c 0.1 0.1 0 0.4 0 0.5 c 0 0 0 0 0 0 c 0.2 0.2 0.3 0.5 0.5 0.6 c 0.3 0.4 1.1 1.8 1.3 2.1 c 0.2 0.3 0.8 1 0.8 1.1 c 0 0.2 0.1 0.4 0.2 0.5 c 0.2 0.2 0.1 0.5 0 0.7 c -0.1 0.2 -0.4 0.3 -0.5 0.3 c -0.1 0.1 -0.4 0.2 -0.5 0.1 c -0.2 0 -0.2 -0.2 -0.5 -0.5 c -0.4 -0.3 -0.7 -0.8 -1 -1.1 c -0.4 -0.1 -0.8 -0.3 -1.1 -0.3 c -0.2 -0.1 -0.6 -0.2 -0.8 -0.4 c -0.3 0.4 -2.5 2.3 -2.8 2.5 c -0.1 1.1 -0.1 2.1 -0.2 2.4 c -0.2 0.3 -0.3 0.6 -0.1 0.9 c 0.6 1.1 1.5 2.6 1.6 2.8 c 0.2 0.3 0.3 0.2 0.5 0.5 c 0.1 0.3 0.8 1.7 1.4 2.2 c 0.5 0.4 1.1 1.2 1.4 1.4 c 0.2 0.3 0.7 0.5 0.9 0.7 c 0.1 0.3 0.5 0.8 0.5 0.9 c -0.1 0.1 -1.4 0 -1.4 -0.2 c -0.1 -0.3 -0.2 -0.5 -0.1 -0.7 c -0.2 -0.1 -0.5 -0.5 -0.9 -0.5 c -0.3 -0.1 -1.5 -2.1 -1.7 -2.4 c -0.3 -0.3 -0.4 -0.1 -0.7 -0.5 c -0.4 -0.4 -0.5 -0.8 -1 -1.1 c -0.4 -0.2 -1.3 -1.5 -1.9 -2.2 c -0.5 0.1 -0.8 0.2 -1.3 0.2 c 0 0 0 0 0 0 c 0 0 0 0 0 0 c -0.1 0 -0.1 0 -0.1 0 c -0.6 0.1 -1.5 0.8 -1.8 1.2 c -0.4 0.4 -1 0.8 -1.4 1.4 c -0.3 0.4 -0.7 1.1 -1.2 1.7 c -0.3 0.4 -0.6 0.7 -0.6 0.8 c 0.1 0.3 -0.5 0.9 -0.6 1 c -0.1 0.2 0 0.4 0.1 0.6 c 0.2 0.3 0 1 -0.1 1.1 c -0.1 0.2 -1.3 -0.7 -1.1 -1 c 0.1 -0.2 0.5 -0.5 0.5 -0.6 c 0 -0.2 0.2 -0.6 0.3 -0.9 c 0.2 -0.2 1.1 -1.3 1.2 -1.5 c 0.1 -0.3 0.5 -1.4 0.6 -1.6 c 0.1 -0.4 0.6 -0.8 0.9 -1.3 c 0.1 -0.1 0.2 -0.3 0.3 -0.5 c -1.1 -0.2 -2.3 -0.6 -3.1 -0.9 c -1 -0.3 -3.4 -1.4 -4 -1.4 c -0.9 0.1 -1.4 0.4 -2.2 0.6 c -1 0.4 -1.6 1.2 -1.9 1.3 c -0.5 0.1 -1.2 1.5 -1.4 1.8 c -0.4 0.3 -1.4 1.2 -1.5 1.4 c -0.1 0.2 -0.2 0.3 -0.4 0.4 c -0.4 0.2 -1.3 1.3 -1.4 1.7 c -0.1 0.5 -0.3 0.7 -0.5 0.8 c -0.3 0.2 -0.5 0.1 -0.7 0.5 c -0.1 0.3 -0.5 1.2 -1.1 1.4 c -0.5 0.1 -0.4 -0.3 -0.4 -0.6 c 0 -0.4 0.2 -1 0.5 -1 c 0.3 -0.1 0.5 0 0.6 -0.2 c 0.2 -0.2 0.1 -0.4 0.3 -0.6 c 0.2 -0.2 0.8 -0.5 0.9 -0.9 c 0.2 -0.4 0.8 -1.4 0.8 -1.8 c 0.1 -0.4 0.9 -1.2 1.2 -1.6 c -0.7 0.5 -2.4 1.5 -2.7 1.7 c -0.3 0.3 -0.7 1.1 -0.9 1.2 c -0.3 0.2 -0.7 0.4 -1 0.5 c -0.3 0.1 -0.6 0.2 -1 0.4 c -0.5 0.1 -0.7 0.1 -0.8 0.1 c -0.2 -0.1 -0.1 -1.1 0.5 -1.4 c 0.5 0 0.7 0.2 1 0.1 c 0.3 -0.1 0.2 -0.4 0.4 -0.5 c 0.2 -0.1 0.8 -0.2 0.9 -0.4 c 0.2 -0.2 1.4 -1.4 1.6 -1.7 c 0.3 -0.4 0.7 -1.2 0.9 -1.4 c 0.3 -0.2 0.9 -0.3 1.3 -0.5 c 0.4 -0.2 0.9 -0.6 1.2 -1.1 c -0.2 -0.9 0 -2.2 -0.1 -2.8 c 0 -0.5 0.2 -1 0.4 -1.4 c 0 -0.1 0 -0.1 -0.1 -0.1 c -0.4 -0.1 -0.9 0.4 -1.2 0.5 c -1.1 0.3 -0.9 0.2 -0.6 0 c -1.3 0.2 -1.8 0.6 -1.8 0.6 c 0.1 -0.1 0.2 -0.2 0.3 -0.3 c -0.2 0 -0.6 0.4 -0.9 0.5 c -0.6 0.1 -0.8 0.1 -0.9 0.2 c -0.1 0 -0.2 0 -0.2 0 c 0 0 0.2 -0.1 0.2 -0.1 c 0.1 0 0.3 -0.1 0.4 -0.2 c 0.1 -0.1 0.1 -0.1 0.1 -0.1 c -0.1 -0.1 -0.3 0 -0.4 0 c -0.2 0 -0.4 0.2 -0.5 0.2 c -1.1 0.2 -1.6 0.3 -1.6 0.3 c 0.6 -0.3 1 -0.3 1.1 -0.4 c -2 0.1 -2.2 0.2 -2.5 0.3 c 0 -0.1 0.6 -0.4 1.3 -0.5 c -0.2 -0.1 -1.6 -0.1 -1.8 0 c 0.1 -0.1 0.1 -0.1 0.4 -0.2 c 1.6 -0.3 1.8 -0.4 1.9 -0.4 c 0 0 -0.1 0 -0.1 0 l -0.5 0 c -0.4 0 -0.7 -0.2 -1.1 -0.2 c -0.8 0 0.2 -0.1 0.2 -0.1 c 0.1 0 0.1 0 0.3 -0.1 c -0.2 -0.1 -0.7 -0.1 -0.9 0 c -0.2 0.1 -0.3 0.2 -0.4 0.2 c 0.2 -0.3 0.5 -0.4 0.7 -0.4 c 0.5 0 1.3 -0.1 1.7 -0.1 c 0.6 0.1 0.7 0 0.7 0 c 0 0 0.4 -0.1 0.5 -0.1 c 0.5 0 1.2 0.3 1.7 0.2 c 0.3 0 0.5 0 0.7 -0.1 c -0.2 -0.1 -0.3 -0.1 -0.3 -0.2 c 0.1 0 0.5 0.1 0.6 0.1 c 0.8 0 1.1 0 1.4 -0.1 c 2.1 -0.2 2.2 -0.2 2.3 -0.3 c 0.5 -0.3 2.6 -0.7 3.6 -0.8 c 1.1 0 2.7 0.5 3.2 0.5 c 0.5 0 1.9 0.6 3.1 0.4 z"
            fill="tan"
          />
          <path
            id="hr-jockey"
            d="M 10 0 c -1.1 -0.4 -1.5 -0.5 -2.3 -1 c -0.9 -0.5 -1.4 -1.3 -1.4 -1.7 c 0 -0.4 0.3 -1 1.3 -1.4 c 3 -1 3.8 -1 4.2 -1 c 2.1 -0.1 1.7 0.1 2.1 -1 c 0.5 -0.6 1.2 -0.7 1.6 -0.5 c 0.5 0.2 1.1 0.8 0.9 1.2 c 0 0.1 -0.1 0.2 -0.1 0.2 c 0 0.1 0.1 0.1 0.1 0.2 c 0.1 0 0.3 0.2 0.1 0.2 c -0.1 0 -0.3 0 -0.4 -0.1 c -0.1 0.1 -0.3 0.3 -0.3 0.5 c -0.1 0.4 -0.4 0.5 -0.5 0.7 c -0.3 0.2 -0.5 0.1 -0.8 -0.1 c -0.3 -0.2 -0.5 -0.1 -0.5 0.5 c 0 0.5 -0.4 0.6 -0.5 1 c -0.1 0.4 -0.2 0.8 0.3 1 c 0.5 0.2 1.7 0.6 1.8 0.3 c 0.1 -0.3 0.9 -0.2 0.8 0.2 c -0.1 0.4 -0.4 0.7 -0.8 0.4 c -0.3 -0.1 -0.8 0.3 -2.3 0.1 c -0.4 -0.1 -0.5 -0.1 -0.7 -0.5 c -0.2 -0.4 -0.1 -0.8 -0.7 -0.8 c -0.2 0 -1.1 0.1 -1.4 0.1 c 0.3 0.4 1.1 0.8 1.2 1.2 c 0.1 0.2 0 0.4 -0.1 0.5 c -0.4 0.4 -1.6 1.5 -1.8 1.8 c 0.4 0.1 0.9 0.1 0.9 0.2 c 0.1 0.2 0.1 0.3 0 0.4 c -0.4 0.4 -2.1 0.1 -2 -0.3 c 0.1 -0.4 0.6 -1.2 1.3 -2.3 z"
          />
          <clipPath id="hr-medalMask">
            <circle cx="50" cy="50" r="35" />
          </clipPath>
        </defs>

        {/* Ground */}
        <rect
          x="-10"
          y="-10"
          width={raceLength}
          height="2000"
          fill="rgb(102,74,52)"
          filter="url(#hr-mud)"
        />

        {/* Medals - always rendered, thrown into position as horses finish */}
        {showMedals && (
          <g transform={`translate(${raceLength - 95} 0)`}>
            {[
              { color: 'gold', label: '1st', shineTextFill: 'rgba(255,230,15,0.1)' },
              { color: 'silver', label: '2nd', shineTextFill: '#000', shineTextOpacity: '0.1' },
              { color: 'rgb(185,107,30)', label: '3rd', shineTextFill: '#000', shineTextOpacity: '0.1' },
            ].map((medal, idx) => {
              const result = raceResults[idx];
              const medalTransform = result
                ? `scale(0.2 0.2) translate(0 ${100 * result.lane - 24})`
                : `scale(0.2 0.2) translate(${1170 + raceLength} -200)`;
              return (
                <g key={`medal-${idx}`} transform={medalTransform} style={{ transition: '500ms' }}>
                  <circle clipPath="url(#hr-medalMask)" cx="50" cy="50" r="35" fill={medal.color} filter="brightness(90%)" />
                  <path clipPath="url(#hr-medalMask)" d="M -10 90 L 0 100 L 100 0 L 90 -10" fill="#fff">
                    <animate
                      attributeName="d"
                      values="M -10 90 L 0 100 L 100 0 L 90 -10; M 50 150 L 60 160 L 160 60 L 150 50; M 50 150 L 60 160 L 160 60 L 150 50"
                      keyTimes="0; 0.167; 1"
                      dur="6s"
                      repeatCount="indefinite"
                    />
                  </path>
                  <path clipPath="url(#hr-medalMask)" d="M 0 0 V 100 L 100 0 Z" fill={medal.color} filter="brightness(120%)" />
                  <circle cx="50" cy="50" r="30" fill={medal.color} />
                  <text x="50" y="50" dominantBaseline="middle" textAnchor="middle" fill={medal.color} filter="brightness(80%)" fontFamily="Arial, Helvetica, sans-serif" fontSize="25">{medal.label}</text>
                  <path clipPath="url(#hr-medalMask)" d="M 40 140 L 50 150 L 150 50 L 140 40" fill="#fff">
                    <animate
                      attributeName="d"
                      values="M 40 140 L 50 150 L 150 50 L 140 40; M -60 40 L -50 50 L 50 -50 L 40 -60; M -60 40 L -50 50 L 50 -50 L 40 -60"
                      keyTimes="0; 0.167; 1"
                      dur="6s"
                      begin="0.5s"
                      repeatCount="indefinite"
                    />
                  </path>
                  <text x="50" y="50" dominantBaseline="middle" textAnchor="middle" fill={medal.shineTextFill} opacity={medal.shineTextOpacity} fontFamily="Arial, Helvetica, sans-serif" fontSize="25">{medal.label}</text>
                </g>
              );
            })}
          </g>
        )}

        {/* Finish Line */}
        <g className="finish-line">
          <path d={`M${finishLinePos} -10v${viewBoxHeight}`} stroke="rgb(72,44,22)" strokeWidth="12" />
          <path d={`M${finishLinePos} -2.5v${(horses.length * 20) + 5}`} stroke="#000" strokeDasharray="5" strokeWidth="10" />
          <path d={`M${finishLinePos} -2.5v${(horses.length * 20) + 5}`} stroke="#fff" strokeDasharray="5" strokeDashoffset="5" strokeWidth="10" />
        </g>

        {/* Horses/Racers - only render when race has started */}
        <g className="player-area" key={`race-${raceKey}`}>
          {raceStarted && animationData && horses.map((horse, i) => {
            const anim = animationData[i];
            if (!anim) return null;
            const finishPos = getFinishPosition(i);

            return (
              <g className="racer" key={`racer-${i}`}>
                <g
                  stroke="#111"
                  strokeWidth="0.25"
                  className="rider"
                  data-player={horse.name}
                  data-color={horse.color}
                  data-lane={i}
                >
                  {/* Horse name */}
                  <g>
                    <text
                      stroke="none"
                      fill="#fff"
                      fontFamily="monospace"
                      fontSize="6"
                      y={7.5 + i * 20}
                      x={-30 - (horse.name.length * 2)}
                    >
                      {horse.name}
                    </text>
                    <animateTransform
                      attributeName="transform"
                      attributeType="XML"
                      type="translate"
                      values="0 0; -113 0"
                      dur={`${(180 / raceLength * anim.dur)}ms`}
                      begin={`raceMotion${i}.end`}
                      fill="freeze"
                    />
                  </g>

                  {/* Finish position (4th+) */}
                  {finishPos && (
                    <text
                      fill="#ccc"
                      stroke="#fff"
                      fontFamily="monospace"
                      fontSize="7"
                      y={7.5 + i * 20}
                      x={finishLinePos + 15}
                      textAnchor="middle"
                    >
                      {finishPos}
                    </text>
                  )}

                  {/* Shadow */}
                  <ellipse
                    filter="url(#hr-blur)"
                    cx="8"
                    cy={22 + i * 20}
                    rx="17"
                    ry="3"
                    fill="rgba(0,0,0,0.5)"
                  />

                  {/* Horse + Jockey */}
                  <g className="things-that-gallop">
                    <use
                      href="#hr-horse"
                      transform={`translate(0 ${7.5 + i * 20})`}
                      filter={`brightness(${anim.brightness}%)`}
                    />
                    <path
                      d={`M 10 ${7.1 + i * 20} h ${4 + (horse.number?.toString().length || 1)} v 5 h -${4 + (horse.number?.toString().length || 1)}`}
                      fill="#fff"
                    />
                    <text fontSize="4" x="11.5" y={11 + i * 20}>{horse.number || i}</text>
                    <animateTransform
                      className="player-gallop"
                      attributeName="transform"
                      attributeType="XML"
                      type="rotate"
                      values={`-12 10 ${7.5 + i * 20}; 12 10 ${7.5 + i * 20}; -12 10 ${7.5 + i * 20}`}
                      dur="500ms"
                      begin={`${anim.gallopOffset}ms`}
                      repeatCount="indefinite"
                    />
                  </g>

                  {/* Jockey */}
                  <use
                    href="#hr-jockey"
                    fill={horse.color}
                    transform={`translate(0 ${7.1 + i * 20})`}
                  />

                  {/* Post-race slide animation */}
                  <animateTransform
                    attributeName="transform"
                    attributeType="XML"
                    type="translate"
                    values="0 0; 130 0"
                    dur={`${(180 / raceLength * anim.dur)}ms`}
                    begin={`raceMotion${i}.end`}
                    fill="freeze"
                    keyTimes="0;1"
                    keySplines="0.67 0.64 0.37 0.28"
                    calcMode="spline"
                  />
                </g>

                {/* Main race animation */}
                <animateTransform
                  id={`raceMotion${i}`}
                  className="player-anim"
                  attributeName="transform"
                  attributeType="XML"
                  type="translate"
                  values={anim.vals}
                  dur={`${anim.dur}ms`}
                  begin="indefinite"
                  keyTimes={anim.keyTimes}
                  keySplines={anim.splines}
                  calcMode="spline"
                  fill="freeze"
                />
              </g>
            );
          })}
        </g>

        {/* Starting Blocks - rendered after horses so the building covers them */}
        <g className="starting-blocks">
          <g className="start-building">
            <path d={`M -10 -2 h 50 v ${buildingH} h-50`} fill="url(#hr-grad)" stroke="#000" strokeWidth="0.5"/>
            <path d={`M -10 -2 l 25 ${buildingH/8} v ${buildingH - (buildingH/3)} l-25 ${buildingH/5} M 40 -2 l-25 ${buildingH/8}v ${buildingH - (buildingH/3)} l25 ${buildingH/5}`} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
          </g>
          <g className="gates">
            {horses.map((horse, i) => (
              <path
                key={`gate-${i}`}
                d={`M40 ${i * 20}v20`}
                stroke="#fff"
                strokeWidth="1"
              >
                <animateTransform
                  className="gate-anim"
                  attributeName="transform"
                  attributeType="XML"
                  type="rotate"
                  values={`0 40 ${(i * 20) + 20}; 90 40 ${(i * 20) + 20}`}
                  dur="200ms"
                  begin="indefinite"
                  fill="freeze"
                />
              </path>
            ))}
          </g>
        </g>
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
          {isRacing ? '🏃 Racing...' : '🏁 Start Race'}
        </button>
      )}

      <style jsx>{`
        .horse-race-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #232323;
          padding: 20px;
          border-radius: 8px;
        }
        .racer {
          transition-duration: 500ms;
          transition-property: transform;
          transition-timing-function: linear;
        }
      `}</style>
    </div>
  );
});

HorseRace.displayName = 'HorseRace';

export default HorseRace;
