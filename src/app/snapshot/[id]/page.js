import { db, doc, getDoc } from '@/lib/firebaseServer';
import Link from 'next/link';

export async function generateMetadata({ params }) {
  const { id } = await params;
  let imageUrl = null;

  try {
    if (db) {
      const snap = await getDoc(doc(db, 'polaroids', id));
      if (snap.exists()) {
        imageUrl = snap.data().storageUrl;
      }
    }
  } catch (err) {
    console.error('[Snapshot] Failed to fetch polaroid doc:', err.message);
  }

  return {
    title: 'Hail Mary Rig Snapshot',
    description: 'Check out my rig!',
    openGraph: {
      title: 'Hail Mary Rig Snapshot',
      description: 'Check out my rig!',
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: 'Hail Mary Rig Snapshot' }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Hail Mary Rig Snapshot',
      description: 'Check out my rig! 🤑',
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

export default async function SnapshotPage({ params }) {
  const { id } = await params;
  let imageUrl = null;

  try {
    if (db) {
      const snap = await getDoc(doc(db, 'polaroids', id));
      if (snap.exists()) {
        imageUrl = snap.data().storageUrl;
      }
    }
  } catch (err) {
    console.error('[Snapshot] Failed to fetch polaroid doc:', err.message);
  }

  return (
    <div style={{
      backgroundColor: '#0a0a0a',
      minHeight: '100dvh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '1.5rem',
      color: '#fff',
      fontFamily: "'Orbitron', monospace",
      padding: '2rem',
    }}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="RL80 Oil Rig Snapshot"
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            borderRadius: '8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}
        />
      ) : (
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>Snapshot not found</p>
      )}
      <Link
        href="/hailmary"
        style={{
          color: '#00bbf9',
          textDecoration: 'none',
          fontSize: '1.1rem',
          padding: '0.75rem 1.5rem',
          border: '1px solid #00bbf9',
          borderRadius: '8px',
          transition: 'background 0.2s',
        }}
      >
        Visit RL80 Oil Rig
      </Link>
    </div>
  );
}
