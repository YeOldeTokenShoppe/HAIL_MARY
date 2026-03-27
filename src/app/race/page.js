'use client';

import { useState, useEffect, useRef } from 'react';
import PolaroidSnapshot from '@/components/PolaroidSnapshot';
import Script from 'next/script';

export default function RacePage() {
  const [raceResult, setRaceResult] = useState(null);
  const [triggerSnapshot, setTriggerSnapshot] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      // Accept messages from both iframe postMessage and direct window postMessage
      if (event.data?.type === 'raceFinished' && event.data.screenshot) {
        console.log('[Race] Received race result:', event.data.positionText, event.data.time);
        setRaceResult(event.data);
        setCanvasReady(false);

        // Draw screenshot onto our canvas, then trigger the snapshot
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            console.log('[Race] Canvas drawn, size:', img.width, 'x', img.height);
            setCanvasReady(true);
          }
        };
        img.onerror = () => {
          console.error('[Race] Failed to load screenshot image');
        };
        img.src = event.data.screenshot;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Only trigger PolaroidSnapshot after canvas is drawn
  useEffect(() => {
    if (canvasReady && raceResult) {
      const timer = setTimeout(() => {
        console.log('[Race] Triggering polaroid snapshot');
        setTriggerSnapshot(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [canvasReady, raceResult]);

  const handleSnapshotComplete = (polaroidUrl) => {
    console.log('[Race] Polaroid captured');
  };

  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden', background: '#000' }}>
      <iframe
        src="/game/index.html"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        allow="autoplay; fullscreen"
      />

      {/* Hidden canvas for PolaroidSnapshot to capture from */}
      <canvas
        ref={canvasRef}
        id="race-capture-canvas"
        style={{ position: 'fixed', top: 0, left: 0, width: 1, height: 1, pointerEvents: 'none', opacity: 0, zIndex: -1 }}
      />

      <PolaroidSnapshot
        trigger={triggerSnapshot}
        onComplete={handleSnapshotComplete}
        captureElementId="race-capture-canvas"
        label={raceResult ? `${raceResult.positionText} Place! ${raceResult.time}` : 'Race Finish!'}
      />
    </div>
  );
}
