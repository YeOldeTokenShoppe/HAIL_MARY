/**
 * Share embed target for Farcaster casts.
 * When a user shares a prize claim, the cast links to this page.
 * The fc:miniapp meta tag tells Warpcast to render it as a mini-app embed
 * with the OG image as the 3:2 preview card.
 */

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const prizeId = params?.prize || '';
  const edition = params?.edition || '';

  const ogUrl = new URL('/api/og/prize', process.env.NEXT_PUBLIC_SITE_URL || 'https://rl80.com');
  if (prizeId) ogUrl.searchParams.set('prize', prizeId);
  if (edition) ogUrl.searchParams.set('edition', edition);

  return {
    title: `RL80 Gachapon Prize #${edition}`,
    description: 'Claim weekly collectibles from the RL80 Gachapon machine',
    openGraph: {
      title: `RL80 Gachapon Prize #${edition}/100`,
      description: 'Claim weekly collectibles from the RL80 Gachapon machine',
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 800,
          alt: 'RL80 Gachapon Prize',
        },
      ],
    },
    other: {
      'fc:miniapp': 'true',
    },
  };
}

export default function SharePage({ searchParams }) {
  return (
    <div style={{
      backgroundColor: '#0a0a0a',
      height: '100dvh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '1rem',
      color: '#fff',
      fontFamily: "'Orbitron', monospace",
    }}>
      <div style={{
        fontSize: '2rem',
        background: 'linear-gradient(135deg, #00f5d4, #00bbf9)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontWeight: '800',
      }}>
        RL80 GACHAPON
      </div>
      <p style={{
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '0.9rem',
        textAlign: 'center',
        maxWidth: '300px',
      }}>
        Open in Warpcast to play the Gachapon and claim weekly collectibles
      </p>
    </div>
  );
}
