'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import PolaroidSnapshot from '@/components/PolaroidSnapshot';

export default function RacePage() {
  const { user, isSignedIn } = useUser();
  const [raceResult, setRaceResult] = useState(null);
  const [triggerSnapshot, setTriggerSnapshot] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerRank, setPlayerRank] = useState(null);
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'raceFinished' && event.data.screenshot) {
        console.log('[Race] Received race result:', event.data.positionText, event.data.time);
        setRaceResult(event.data);
        setCanvasReady(false);
        setSaved(false);
        setShowLeaderboard(false);

        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            setCanvasReady(true);
          }
        };
        img.src = event.data.screenshot;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Trigger polaroid after canvas is ready
  useEffect(() => {
    if (canvasReady && raceResult) {
      const timer = setTimeout(() => setTriggerSnapshot(true), 200);
      return () => clearTimeout(timer);
    }
  }, [canvasReady, raceResult]);

  // Save race result to Firestore
  useEffect(() => {
    if (raceResult && !saved) {
      setSaved(true);
      saveRaceResult(raceResult);
    }
  }, [raceResult, saved]);

  const saveRaceResult = async (result) => {
    try {
      const timeInSeconds = parseTimeString(result.time);
      await fetch('/api/race', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: timeInSeconds,
          position: result.position,
          track: 'loop_track',
          userId: user?.id || 'anonymous',
          userName: user?.firstName || user?.username || 'Anonymous Racer',
          userImage: user?.imageUrl || null,
        }),
      });
      console.log('[Race] Result saved to leaderboard');
      fetchLeaderboard(timeInSeconds);
    } catch (err) {
      console.error('[Race] Failed to save result:', err);
    }
  };

  const parseTimeString = (timeStr) => {
    // Parse "1:26.72" format to seconds
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(timeStr);
  };

  const fetchLeaderboard = async (playerTime) => {
    try {
      const res = await fetch('/api/race?track=loop_track&limit=20');
      const data = await res.json();
      setLeaderboard(data.times || []);

      // Find player's rank
      if (playerTime) {
        const rank = (data.times || []).findIndex(t => t.time >= playerTime) + 1;
        setPlayerRank(rank || data.times?.length || 0);
      }
    } catch (err) {
      console.error('[Race] Failed to fetch leaderboard:', err);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
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

      <canvas
        ref={canvasRef}
        id="race-capture-canvas"
        style={{ position: 'fixed', top: 0, left: 0, width: 1, height: 1, pointerEvents: 'none', opacity: 0, zIndex: -1 }}
      />

      <PolaroidSnapshot
        trigger={triggerSnapshot}
        onComplete={() => console.log('[Race] Polaroid captured')}
        captureElementId="race-capture-canvas"
        label={raceResult ? `${raceResult.positionText} Place! ${raceResult.time}` : 'Race Finish!'}
      />

      {/* Leaderboard toggle button - appears after race */}
      {raceResult && (
        <button
          onClick={() => {
            setShowLeaderboard(!showLeaderboard);
            if (!leaderboard.length) fetchLeaderboard();
          }}
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 20px',
            background: 'rgba(0,0,0,0.85)',
            color: '#FFD700',
            border: '2px solid #FFD700',
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            zIndex: 100,
            backdropFilter: 'blur(8px)',
          }}
        >
          {showLeaderboard ? 'Close' : 'Leaderboard'}
        </button>
      )}

      {/* Leaderboard panel */}
      {showLeaderboard && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '100%',
          maxWidth: 400,
          height: '100dvh',
          background: 'rgba(2, 14, 32, 0.97)',
          borderLeft: '2px solid rgba(255, 215, 0, 0.4)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          backdropFilter: 'blur(12px)',
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h2 style={{ margin: 0, color: '#FFD700', fontSize: 24, fontWeight: 700 }}>
              Leaderboard
            </h2>
            <button
              onClick={() => setShowLeaderboard(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                fontSize: 28,
                cursor: 'pointer',
                padding: '0 4px',
              }}
            >
              &times;
            </button>
          </div>

          {/* Player result highlight */}
          {raceResult && playerRank && (
            <div style={{
              margin: '16px 24px',
              padding: '14px 18px',
              background: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: 10,
              textAlign: 'center',
            }}>
              <div style={{ color: '#FFD700', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                YOUR RESULT
              </div>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
                {raceResult.time}
              </div>
              <div style={{ color: '#aaa', fontSize: 13, marginTop: 2 }}>
                Rank #{playerRank} &middot; {raceResult.positionText} place finish
              </div>
            </div>
          )}

          {/* Leaderboard list */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 24px 20px',
          }}>
            {leaderboard.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>
                Loading...
              </p>
            ) : (
              leaderboard.map((entry, i) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {/* Rank */}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.1)',
                    color: i < 3 ? '#000' : '#888',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>

                  {/* Avatar */}
                  {entry.userImage ? (
                    <img
                      src={entry.userImage}
                      alt=""
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.1)',
                      flexShrink: 0,
                    }} />
                  )}

                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {entry.userName}
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{
                    color: i < 3 ? '#FFD700' : '#ccc',
                    fontSize: 16,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}>
                    {formatTime(entry.time)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
