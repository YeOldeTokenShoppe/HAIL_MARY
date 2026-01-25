'use client';

import { useState, useRef } from 'react';
import HorseRace from '@/components/HorseRace';

// Sample custom horses
const CUSTOM_HORSES = [
  { name: 'Thunder', color: '#ff6b6b', number: 1 },
  { name: 'Lightning', color: '#4ecdc4', number: 2 },
  { name: 'Shadow', color: '#2c3e50', number: 3 },
  { name: 'Blaze', color: '#f39c12', number: 4 },
  { name: 'Storm', color: '#9b59b6', number: 5 },
  { name: 'Comet', color: '#3498db', number: 6 },
];

export default function HorseRaceDemo() {
  const [results, setResults] = useState(null);
  const [lastFinisher, setLastFinisher] = useState(null);
  const [useCustomHorses, setUseCustomHorses] = useState(false);
  const [useSeed, setUseSeed] = useState(false);
  const [seed, setSeed] = useState(12345);
  const raceRef = useRef(null);

  const handleRaceComplete = (raceResults) => {
    setResults(raceResults);
    console.log('Race complete!', raceResults);
  };

  const handleHorseFinish = (result) => {
    setLastFinisher(result);
    console.log(`${result.horse.name} finished in position ${result.position}!`);
  };

  const handleRaceStart = () => {
    setResults(null);
    setLastFinisher(null);
    console.log('Race started!');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1a2e',
      color: '#fff',
      padding: '20px'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Horse Race Component Demo</h1>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '20px',
        justifyContent: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={useCustomHorses}
            onChange={(e) => setUseCustomHorses(e.target.checked)}
          />
          Use Custom Horses
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={useSeed}
            onChange={(e) => setUseSeed(e.target.checked)}
          />
          Use Seed (Simulcast)
        </label>

        {useSeed && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Seed:
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
              style={{
                width: '80px',
                padding: '4px',
                background: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px'
              }}
            />
          </label>
        )}

        <button
          onClick={() => raceRef.current?.startRace()}
          style={{
            padding: '8px 16px',
            background: '#4ecdc4',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Start Race (via ref)
        </button>
      </div>

      {/* Race Component */}
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <HorseRace
          ref={raceRef}
          horses={useCustomHorses ? CUSTOM_HORSES : undefined}
          seed={useSeed ? seed : null}
          onRaceStart={handleRaceStart}
          onRaceComplete={handleRaceComplete}
          onHorseFinish={handleHorseFinish}
          raceLength={600}
          maxRaceTime={8000}
          maxRaceDiff={2500}
        />
      </div>

      {/* Live Updates */}
      {lastFinisher && !results && (
        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          padding: '10px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '8px',
          maxWidth: '400px',
          margin: '20px auto'
        }}>
          <strong>{lastFinisher.horse.name}</strong> just finished in position <strong>{lastFinisher.position}</strong>!
        </div>
      )}

      {/* Final Results */}
      {results && (
        <div style={{
          marginTop: '30px',
          maxWidth: '500px',
          margin: '30px auto',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h2 style={{ textAlign: 'center', marginBottom: '15px' }}>Race Results</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #444' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Position</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Horse</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Color</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #333',
                    background: idx < 3 ? 'rgba(255,215,0,0.1)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '10px' }}>
                    {result.position === 1 && '🥇 '}
                    {result.position === 2 && '🥈 '}
                    {result.position === 3 && '🥉 '}
                    {result.position}
                  </td>
                  <td style={{ padding: '10px' }}>{result.horse.name}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '20px',
                        height: '20px',
                        background: result.horse.color,
                        borderRadius: '50%',
                        border: '2px solid #fff'
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Usage Example */}
      {/* <div style={{
        marginTop: '40px',
        maxWidth: '700px',
        margin: '40px auto',
        background: '#0d1117',
        borderRadius: '8px',
        padding: '20px',
        fontFamily: 'monospace',
        fontSize: '14px'
      }}>
        <h3 style={{ marginBottom: '15px', color: '#58a6ff' }}>Usage Example:</h3>
        <pre style={{ overflow: 'auto', color: '#c9d1d9' }}>
{`import HorseRace from '@/components/HorseRace';

<HorseRace
  horses={[
    { name: 'Thunder', color: '#ff6b6b', number: 1 },
    { name: 'Lightning', color: '#4ecdc4', number: 2 },
    // ... more horses
  ]}
  seed={12345}  // For simulcast (same race for all viewers)
  onRaceComplete={(results) => {
    console.log('Winner:', results[0].horse.name);
  }}
  onHorseFinish={(result) => {
    console.log(\`\${result.horse.name} finished \${result.position}\`);
  }}
  raceLength={600}
  maxRaceTime={8000}
/>`}
        </pre>
      </div> */}
    </div>
  );
}
