'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import localFont from 'next/font/local';
import styles from './page.module.css';

// Arrival curtain. A visitor who bought the carny's ticket on /hailmary left
// through the clown mouth's vortex under a curtain of its light; the same
// colour is on screen here until the tunnel's first frame, then fades, so the
// cut reads as coming out of the portal into the dark. Anyone else fades up
// from black. The key is set by the hailmary page (RIDE_TICKET_KEY there).
const RIDE_TICKET_KEY = 'hm_ride_ticket';
const VORTEX_LIGHT = '#e6ffff';
function arrivalColor() {
  try {
    if (sessionStorage.getItem(RIDE_TICKET_KEY) === '1') {
      sessionStorage.removeItem(RIDE_TICKET_KEY);
      return VORTEX_LIGHT;
    }
  } catch (e) {}
  return '#000';
}

const blackletter = localFont({
  src: '../../../public/fonts/UnifrakturMaguntia-Regular.ttf',
  weight: '400',
  display: 'swap',
});

const OldsCoolTunnel = dynamic(() => import('@/components/OldsCoolTunnel'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading} role="status">
      Loading tunnel…
    </div>
  ),
});

const destinations = [
  { href: '/fountain', label: 'Fountain' },
  { href: '/hailmary', label: 'Hail Mary' },
  { href: '/trade', label: 'Trade' },
  { href: '/exlibris', label: 'Ex Libris' },
];

export default function HubPage() {
  // Client-rendered on the way in from /hailmary (no hydration), so the colour
  // can be read in the initialiser; a direct load has no key and gets black.
  const [curtain] = useState(() => (typeof window === 'undefined' ? '#000' : arrivalColor()));
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  // Drop the curtain from the tree once it has faded.
  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => setGone(true), 1800);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <main className={styles.hub} aria-labelledby="hub-title">
      <div className={styles.scene}>
        <OldsCoolTunnel isFullscreen coaster onReady={onReady} />
      </div>
      {!gone && (
        <div
          aria-hidden="true"
          className={styles.curtain}
          style={{ background: curtain, opacity: ready ? 0 : 1 }}
        />
      )}

      <header className={styles.header}>
        <Link
          href="/"
          prefetch={false}
          className={`${styles.logo} ${blackletter.className}`}
          aria-label="RL80 home"
        >
          RL80
        </Link>

        <nav className={styles.navigation} aria-label="Explore destinations">
          <h1 id="hub-title" className={styles.title}>Explore</h1>
          <ul className={styles.destinations}>
            {destinations.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} prefetch={false} className={styles.destination}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
    </main>
  );
}
