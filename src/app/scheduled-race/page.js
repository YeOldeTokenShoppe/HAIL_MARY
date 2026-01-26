'use client';

import { useState, useEffect } from 'react';
import ScheduledRace from '@/components/ScheduledRace';

// Sample horses
const RACE_HORSES = [
  { name: 'Aquinas', color: '#ff6b6b', number: 1 },
  { name: 'Lightning', color: '#4ecdc4', number: 2 },
  { name: 'Shadow', color: '#2c3e50', number: 3 },
  { name: 'Blaze', color: '#f39c12', number: 4 },
  { name: 'Storm', color: '#9b59b6', number: 5 },
  { name: 'Comet', color: '#3498db', number: 6 },
  { name: 'Midnight', color: '#1a1a2e', number: 7 },
  { name: 'Spirit', color: '#e74c3c', number: 8 },
];

export default function ScheduledRaceDemo() {
  // Simulated Chainlink VRF state
  const [seed, setSeed] = useState(null);
  const [seedStatus, setSeedStatus] = useState('waiting');
  const [requestTxHash, setRequestTxHash] = useState(null);
  const [fulfillmentTxHash, setFulfillmentTxHash] = useState(null);
  const [raceTime, setRaceTime] = useState(null);

  // Demo controls
  const [countdownSeconds, setCountdownSeconds] = useState(15);
  const [simulateDelay, setSimulateDelay] = useState(3);

  // Set up initial race time
  useEffect(() => {
    setRaceTime(new Date(Date.now() + countdownSeconds * 1000));
  }, []);

  // Simulate Chainlink VRF request
  const handleRequestSeed = () => {
    setSeedStatus('requesting');
    // Simulate tx hash
    setRequestTxHash('0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 10));

    // Simulate Chainlink fulfillment after delay
    setTimeout(() => {
      const randomSeed = Math.floor(Math.random() * 1000000000);
      setSeed(randomSeed);
      setFulfillmentTxHash('0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 10));
      setSeedStatus('fulfilled');
    }, simulateDelay * 1000);
  };

  // Reset demo
  const resetDemo = () => {
    setSeed(null);
    setSeedStatus('waiting');
    setRequestTxHash(null);
    setFulfillmentTxHash(null);
    setRaceTime(new Date(Date.now() + countdownSeconds * 1000));
  };

  // Handle race completion
  const handleRaceComplete = (results) => {
    console.log('Race complete!', results);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a1a',
      color: '#fff',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>
          Scheduled Race Demo
        </h1>
        <p style={{ textAlign: 'center', color: '#888', marginBottom: '30px' }}>
          Simulates Chainlink VRF integration for provably fair racing
        </p>

        {/* Demo Controls */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Demo Controls</h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>Countdown (seconds)</span>
              <input
                type="number"
                value={countdownSeconds}
                onChange={(e) => setCountdownSeconds(parseInt(e.target.value) || 15)}
                style={{
                  padding: '8px 12px',
                  background: '#1a1a2e',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  width: '100px'
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>VRF Delay (seconds)</span>
              <input
                type="number"
                value={simulateDelay}
                onChange={(e) => setSimulateDelay(parseInt(e.target.value) || 3)}
                style={{
                  padding: '8px 12px',
                  background: '#1a1a2e',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  width: '100px'
                }}
              />
            </label>

            <button
              onClick={resetDemo}
              style={{
                padding: '8px 20px',
                background: '#e74c3c',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Reset Demo
            </button>
          </div>

          {/* Status display */}
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'monospace'
          }}>
            <div>Status: <span style={{ color: '#f39c12' }}>{seedStatus}</span></div>
            {seed && <div>Seed: <span style={{ color: '#2ecc71' }}>{seed}</span></div>}
            {requestTxHash && <div>Request TX: <span style={{ color: '#3498db' }}>{requestTxHash}</span></div>}
            {fulfillmentTxHash && <div>Fulfillment TX: <span style={{ color: '#3498db' }}>{fulfillmentTxHash}</span></div>}
          </div>
        </div>

        {/* Scheduled Race Component */}
        <ScheduledRace
          horses={RACE_HORSES}
          raceTime={raceTime}
          seed={seed}
          seedStatus={seedStatus}
          seedRequestTxHash={requestTxHash}
          seedFulfillmentTxHash={fulfillmentTxHash}
          chainId={8453} // Base
          onRequestSeed={handleRequestSeed}
          onRaceComplete={handleRaceComplete}
          fanfareDuration={10000}
          raceLength={600}
          maxRaceTime={8000}
          maxRaceDiff={2500}
        />

        {/* Integration Example */}
        <div style={{
          marginTop: '40px',
          background: '#0d1117',
          borderRadius: '8px',
          padding: '20px',
          fontFamily: 'monospace',
          fontSize: '13px'
        }}>
          <h3 style={{ marginTop: 0, color: '#58a6ff' }}>Integration Example:</h3>
          <pre style={{ overflow: 'auto', color: '#c9d1d9', margin: 0 }}>
{`// In your component:
const [seed, setSeed] = useState(null);
const [seedStatus, setSeedStatus] = useState('waiting');

// Request randomness from Chainlink VRF
const requestSeed = async () => {
  setSeedStatus('requesting');
  const tx = await vrfContract.requestRandomWords();
  setRequestTxHash(tx.hash);
};

// Listen for VRF fulfillment (via events or polling)
useEffect(() => {
  vrfContract.on('RandomWordsFulfilled', (requestId, randomWord) => {
    setSeed(randomWord.toString());
    setSeedStatus('fulfilled');
  });
}, []);

<ScheduledRace
  horses={horses}
  raceTime={nextRaceTime}      // When race starts
  seed={seed}                   // From Chainlink VRF
  seedStatus={seedStatus}       // 'waiting' | 'requesting' | 'fulfilled'
  seedRequestTxHash={reqTx}     // For verification
  seedFulfillmentTxHash={fulfillTx}
  onRequestSeed={requestSeed}   // Trigger VRF request
  onRaceComplete={(results) => {
    // Handle results, payouts, etc.
  }}
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
}
