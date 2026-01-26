'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import HorseRace from './HorseRace';

/**
 * Race phases:
 * - waiting: Before seed is requested
 * - requesting: Chainlink VRF request sent, waiting for fulfillment
 * - ready: Seed received, countdown to race start
 * - fanfare: Playing trumpet, about to start
 * - racing: Race in progress
 * - finished: Race complete, showing results
 */

const PHASE = {
  WAITING: 'waiting',
  REQUESTING: 'requesting',
  READY: 'ready',
  FANFARE: 'fanfare',
  RACING: 'racing',
  FINISHED: 'finished',
};

// Format time as MM:SS or HH:MM:SS
const formatTime = (seconds) => {
  if (seconds < 0) return '00:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Format date for display
const formatDateTime = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

const ScheduledRace = ({
  // Race configuration
  horses,
  raceLength = 500,
  maxRaceTime = 7000,
  maxRaceDiff = 2000,

  // Scheduling
  raceTime, // Date object or timestamp for when race starts
  fanfareDuration = 3000, // How long to play trumpet before race (ms)

  // Chainlink VRF data (pass these from your contract/backend)
  seed = null,
  seedRequestTxHash = null,
  seedFulfillmentTxHash = null,
  seedStatus = 'waiting', // 'waiting' | 'requesting' | 'fulfilled'
  chainId = 1, // For block explorer links

  // Callbacks
  onRaceComplete = null,
  onRequestSeed = null, // Called when it's time to request seed (you trigger Chainlink)

  // Customization
  trumpetSrc = '/trumpet.mp3',
  showVerificationLinks = true,
  className = '',
  style = {},
}) => {
  const [phase, setPhase] = useState(PHASE.WAITING);
  const [countdown, setCountdown] = useState(null);
  const [raceResults, setRaceResults] = useState(null);
  const audioRef = useRef(null);
  const raceRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Get block explorer URL based on chain
  const getExplorerUrl = (txHash) => {
    const explorers = {
      1: 'https://etherscan.io/tx/',
      137: 'https://polygonscan.com/tx/',
      43114: 'https://snowtrace.io/tx/',
      42161: 'https://arbiscan.io/tx/',
      10: 'https://optimistic.etherscan.io/tx/',
      8453: 'https://basescan.org/tx/',
    };
    const baseUrl = explorers[chainId] || 'https://etherscan.io/tx/';
    return `${baseUrl}${txHash}`;
  };

  // Calculate time until race
  const getSecondsUntilRace = useCallback(() => {
    if (!raceTime) return null;
    const now = Date.now();
    const raceTimestamp = raceTime instanceof Date ? raceTime.getTime() : raceTime;
    return Math.floor((raceTimestamp - now) / 1000);
  }, [raceTime]);

  // Update countdown timer
  useEffect(() => {
    if (!raceTime) return;

    const updateCountdown = () => {
      const seconds = getSecondsUntilRace();
      setCountdown(seconds);
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [raceTime, getSecondsUntilRace]);

  // Handle phase transitions based on seed status and countdown
  useEffect(() => {
    // Update phase based on seed status
    if (seedStatus === 'requesting' && phase === PHASE.WAITING) {
      setPhase(PHASE.REQUESTING);
    } else if (seedStatus === 'fulfilled' && seed && phase === PHASE.REQUESTING) {
      setPhase(PHASE.READY);
    } else if (seed && phase === PHASE.WAITING) {
      // Seed provided directly without request phase
      setPhase(PHASE.READY);
    } else if (seedStatus === 'waiting' && !seed && phase !== PHASE.WAITING) {
      // Reset back to waiting (e.g., when demo is reset)
      setPhase(PHASE.WAITING);
      setRaceResults(null);
    }
  }, [seedStatus, seed, phase]);

  // Handle countdown reaching zero - start fanfare
  useEffect(() => {
    if (phase === PHASE.READY && countdown !== null && countdown <= 0) {
      setPhase(PHASE.FANFARE);

      // Play trumpet
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.log('Audio play failed:', e));
      }

      // Start race after fanfare
      setTimeout(() => {
        setPhase(PHASE.RACING);
      }, fanfareDuration);
    }
  }, [phase, countdown, fanfareDuration]);

  // Auto-start race when entering racing phase
  useEffect(() => {
    if (phase === PHASE.RACING && raceRef.current) {
      raceRef.current.startRace();
    }
  }, [phase]);

  // Handle race completion
  const handleRaceComplete = (results) => {
    setRaceResults(results);
    setPhase(PHASE.FINISHED);
    if (onRaceComplete) {
      onRaceComplete(results);
    }
  };

  // Request seed callback (for manual trigger or timed trigger)
  const handleRequestSeed = () => {
    if (onRequestSeed) {
      onRequestSeed();
    }
  };

  // Render phase-specific content
  const renderPhaseContent = () => {
    switch (phase) {
      case PHASE.WAITING:
        return (
          <div className="phase-content waiting">
            <div className="phase-icon">🎰</div>
            <h2>Next Race</h2>
            {raceTime && (
              <div className="race-time">
                {formatDateTime(raceTime instanceof Date ? raceTime : new Date(raceTime))}
              </div>
            )}
            {countdown !== null && countdown > 0 && (
              <div className="countdown-display">
                <span className="countdown-label">Starts in</span>
                <span className="countdown-time">{formatTime(countdown)}</span>
              </div>
            )}
            <div className="seed-status">
              <span className="status-dot waiting" />
              Awaiting seed request...
            </div>
            {onRequestSeed && (
              <button onClick={handleRequestSeed} className="request-seed-btn">
                Request Chainlink VRF Seed
              </button>
            )}
          </div>
        );

      case PHASE.REQUESTING:
        return (
          <div className="phase-content requesting">
            <div className="phase-icon spinner">🔗</div>
            <h2>Requesting Randomness</h2>
            <div className="seed-status">
              <span className="status-dot requesting" />
              Chainlink VRF request pending...
            </div>
            {seedRequestTxHash && showVerificationLinks && (
              <a
                href={getExplorerUrl(seedRequestTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-link"
              >
                View Request TX: {seedRequestTxHash.slice(0, 10)}...{seedRequestTxHash.slice(-8)}
              </a>
            )}
            {countdown !== null && countdown > 0 && (
              <div className="countdown-display">
                <span className="countdown-label">Race in</span>
                <span className="countdown-time">{formatTime(countdown)}</span>
              </div>
            )}
          </div>
        );

      case PHASE.READY:
        return (
          <div className="phase-content ready">
            <div className="phase-icon">✅</div>
            <h2>Seed Verified</h2>
            <div className="seed-display">
              <span className="seed-label">Race Seed:</span>
              <span className="seed-value">{seed}</span>
            </div>
            {seedFulfillmentTxHash && showVerificationLinks && (
              <a
                href={getExplorerUrl(seedFulfillmentTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-link"
              >
                Verify on-chain: {seedFulfillmentTxHash.slice(0, 10)}...{seedFulfillmentTxHash.slice(-8)}
              </a>
            )}
            <div className="seed-status">
              <span className="status-dot ready" />
              Randomness verified - race locked in!
            </div>
            {countdown !== null && (
              <div className="countdown-display large">
                <span className="countdown-label">Race starts in</span>
                <span className="countdown-time">{formatTime(Math.max(0, countdown))}</span>
              </div>
            )}
          </div>
        );

      case PHASE.FANFARE:
        return (
          <div className="phase-content fanfare">
            <div className="phase-icon trumpet">🎺</div>
            <h2>GET READY!</h2>
            <div className="fanfare-text">Race is about to begin...</div>
          </div>
        );

      case PHASE.RACING:
      case PHASE.FINISHED:
        return null; // Race component handles this

      default:
        return null;
    }
  };

  const showRace = phase === PHASE.RACING || phase === PHASE.FINISHED;

  return (
    <div className={`scheduled-race ${className}`} style={style}>
      {/* Hidden audio element for trumpet */}
      <audio ref={audioRef} src={trumpetSrc} preload="auto" />

      {/* Phase content (pre-race UI) */}
      {!showRace && (
        <div className="pre-race-container">
          {renderPhaseContent()}
        </div>
      )}

      {/* Race component */}
      {showRace && (
        <div className="race-container">
          {phase === PHASE.FINISHED && raceResults && (
            <div className="results-header">
              <h2>🏆 Race Complete!</h2>
              <div className="winner-announcement">
                Winner: <strong>{raceResults[0]?.horse?.name}</strong>
              </div>
              {seed && (
                <div className="seed-verification">
                  Seed used: <code>{seed}</code>
                  {seedFulfillmentTxHash && showVerificationLinks && (
                    <a
                      href={getExplorerUrl(seedFulfillmentTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="verify-link"
                    >
                      (verify)
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <HorseRace
            ref={raceRef}
            horses={horses}
            seed={seed}
            raceLength={raceLength}
            maxRaceTime={maxRaceTime}
            maxRaceDiff={maxRaceDiff}
            showRestartButton={false}
            onRaceComplete={handleRaceComplete}
          />
        </div>
      )}

      <style jsx>{`
        .scheduled-race {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 16px;
          padding: 24px;
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .pre-race-container {
          min-height: 400px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .phase-content {
          text-align: center;
          padding: 40px;
        }

        .phase-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }

        .phase-icon.spinner {
          animation: spin 2s linear infinite;
        }

        .phase-icon.trumpet {
          animation: shake 0.5s ease-in-out infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes shake {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }

        h2 {
          margin: 0 0 16px 0;
          font-size: 28px;
          font-weight: 700;
        }

        .race-time {
          font-size: 18px;
          color: #a0a0a0;
          margin-bottom: 24px;
        }

        .countdown-display {
          margin: 24px 0;
        }

        .countdown-display.large .countdown-time {
          font-size: 72px;
        }

        .countdown-label {
          display: block;
          font-size: 14px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }

        .countdown-time {
          font-size: 48px;
          font-weight: 700;
          font-family: 'SF Mono', Monaco, monospace;
          background: linear-gradient(135deg, #f39c12 0%, #e74c3c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .seed-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 14px;
          color: #888;
          margin: 16px 0;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .status-dot.waiting {
          background: #666;
        }

        .status-dot.requesting {
          background: #f39c12;
          animation: pulse 1s ease-in-out infinite;
        }

        .status-dot.ready {
          background: #2ecc71;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .seed-display {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          padding: 16px 24px;
          margin: 16px 0;
        }

        .seed-label {
          display: block;
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 4px;
        }

        .seed-value {
          font-size: 24px;
          font-family: 'SF Mono', Monaco, monospace;
          color: #2ecc71;
          word-break: break-all;
        }

        .tx-link, .verify-link {
          display: inline-block;
          color: #3498db;
          text-decoration: none;
          font-size: 13px;
          font-family: 'SF Mono', Monaco, monospace;
          padding: 8px 12px;
          background: rgba(52, 152, 219, 0.1);
          border-radius: 4px;
          margin-top: 8px;
          transition: background 0.2s;
        }

        .tx-link:hover, .verify-link:hover {
          background: rgba(52, 152, 219, 0.2);
        }

        .request-seed-btn {
          margin-top: 24px;
          padding: 12px 24px;
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .request-seed-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
        }

        .fanfare-text {
          font-size: 24px;
          color: #f39c12;
          animation: pulse 0.5s ease-in-out infinite;
        }

        .race-container {
          margin-top: 20px;
        }

        .results-header {
          text-align: center;
          padding: 20px;
          background: rgba(46, 204, 113, 0.1);
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .winner-announcement {
          font-size: 24px;
          margin: 12px 0;
        }

        .seed-verification {
          font-size: 13px;
          color: #888;
        }

        .seed-verification code {
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
          margin: 0 4px;
        }
      `}</style>
    </div>
  );
};

export default ScheduledRace;
