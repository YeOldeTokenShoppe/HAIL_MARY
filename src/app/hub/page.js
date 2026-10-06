'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import localFont from 'next/font/local';
import styles from './page.module.css';

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
  return (
    <main className={styles.hub} aria-labelledby="hub-title">
      <div className={styles.scene}>
        <OldsCoolTunnel isFullscreen coaster />
      </div>

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
