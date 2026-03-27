'use client';

import { useState, useEffect, useRef } from 'react';
import PolaroidSnapshot from '@/components/PolaroidSnapshot';

export default function RacePage() {
  const [raceResult, setRaceResult] = useState(null);
  const [triggerSnapshot, setTriggerSnapshot] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'raceFinished') {
        setRaceResult(event.data);
        setScreenshotUrl(event.data.screenshot);
        setTriggerSnapshot(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSnapshotComplete = (polaroidUrl) => {
    // Polaroid has been captured and displayed
  };

  const handleSnapshotClose = () => {
    setTriggerSnapshot(false);
    setRaceResult(null);
    setScreenshotUrl(null);
  };

  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden', background: '#000' }}>
      <iframe
        ref={iframeRef}
        src="/game/index.html"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        allow="autoplay; fullscreen"
      />

      {/* Hidden canvas to receive the screenshot from the iframe */}
      {screenshotUrl && (
        <img
          id="race-screenshot"
          src={screenshotUrl}
          style={{ display: 'none' }}
          alt=""
        />
      )}

      {/* Render a canvas element for PolaroidSnapshot to capture */}
      {screenshotUrl && (
        <canvas
          id="race-capture-canvas"
          style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', opacity: 0, zIndex: -1 }}
          ref={(canvas) => {
            if (canvas && screenshotUrl) {
              const img = new Image();
              img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
              };
              img.src = screenshotUrl;
            }
          }}
        />
      )}

      <PolaroidSnapshot
        trigger={triggerSnapshot}
        onComplete={handleSnapshotComplete}
        captureElementId="race-capture-canvas"
        label={raceResult ? `${raceResult.positionText} Place! ${raceResult.time}` : 'Race Finish!'}
      />
    </div>
  );
}
