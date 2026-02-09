import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const edition = searchParams.get('edition') || '?';
  const prizeName = searchParams.get('name') || 'RL80 Gachapon Prize';
  const username = searchParams.get('user') || '';

  // 3:2 aspect ratio for Farcaster embed cards
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '800px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
          fontFamily: 'monospace',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 245, 212, 0.15) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Border frame */}
        <div
          style={{
            position: 'absolute',
            inset: '20px',
            border: '2px solid rgba(0, 245, 212, 0.3)',
            borderRadius: '24px',
            display: 'flex',
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: '900',
            color: '#00f5d4',
            letterSpacing: '8px',
            textTransform: 'uppercase',
            marginBottom: '20px',
            display: 'flex',
          }}
        >
          RL80 GACHAPON
        </div>

        {/* Prize name */}
        <div
          style={{
            fontSize: '36px',
            color: '#ffffff',
            fontWeight: '700',
            marginBottom: '16px',
            display: 'flex',
          }}
        >
          {prizeName}
        </div>

        {/* Edition badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #00f5d4, #00bbf9)',
              borderRadius: '50px',
              color: '#000',
              fontSize: '24px',
              fontWeight: '800',
              display: 'flex',
            }}
          >
            #{edition}/100
          </div>
        </div>

        {/* Claimed by */}
        {username && (
          <div
            style={{
              fontSize: '24px',
              color: 'rgba(255, 255, 255, 0.6)',
              display: 'flex',
            }}
          >
            Claimed by @{username}
          </div>
        )}

        {/* Bottom CTA */}
        <div
          style={{
            position: 'absolute',
            bottom: '50px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              padding: '12px 32px',
              border: '2px solid rgba(0, 245, 212, 0.5)',
              borderRadius: '50px',
              color: '#00f5d4',
              fontSize: '20px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              display: 'flex',
            }}
          >
            Play Gachapon
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
