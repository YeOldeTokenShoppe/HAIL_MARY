// THE LINEUP — what is on air and what is planned, readable from a phone.
//
// This is the half of the studio that can live on the deployed site. It reads
// the slate, which is committed source and therefore ships with the build. It
// cannot write anything, run anything or spend anything: making an episode
// needs a checkout and files that are gitignored, so that stays local at
// /lt-tv. See docs/lt-tv.md.

import { cookies } from 'next/headers';
import { SHOWS } from '@/content/lt-tv';
import { SESSION_COOKIE, tokenIsValid } from '@/lib/ltTv/lineupAuth.mjs';
import LineupLogin from './LineupLogin';
import SignOut from './SignOut';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'LT TV lineup' };

export default async function LineupPage() {
  const store = await cookies();
  if (!tokenIsValid(store.get(SESSION_COOKIE)?.value)) return <LineupLogin />;

  const shows = SHOWS.map((show) => ({
    ...show,
    onAir: show.episodes.filter((episode) => episode.playable).length,
  }));
  const total = shows.reduce((sum, show) => sum + show.onAir, 0);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>LT TV</h1>
        <SignOut />
      </header>
      <p style={styles.summary}>
        {total === 0
          ? 'Nothing on air yet.'
          : `${total} episode${total === 1 ? '' : 's'} on air.`}
      </p>

      {shows.map((show) => (
        <section key={show.id} style={styles.show}>
          <h2 style={styles.showTitle}>{show.title}</h2>
          <p style={styles.showFormat}>{show.format}</p>

          {show.episodes.length === 0 ? (
            <p style={styles.empty}>Coming soon — no episodes on the slate.</p>
          ) : (
            <ol style={styles.list}>
              {show.episodes.map((episode) => (
                <li key={episode.id} style={styles.item}>
                  <div style={styles.itemHead}>
                    <span style={styles.number}>{episode.number ?? '—'}</span>
                    <span style={styles.itemTitle}>{episode.title}</span>
                    <span style={episode.playable ? styles.onAir : styles.planned}>
                      {episode.playable ? 'On air' : 'Planned'}
                    </span>
                  </div>
                  {episode.summary ? <p style={styles.itemSummary}>{episode.summary}</p> : null}
                  {episode.runtime ? <p style={styles.runtime}>{episode.runtime}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}

      <p style={styles.footer}>
        Read only. Writing and recording happen in the studio on your own
        machine — double-click <code style={styles.code}>LT TV Studio</code> in
        the repo folder.
      </p>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100dvh',
    margin: '0 auto',
    maxWidth: '38rem',
    padding: '16px 16px 3rem',
    background: '#0b0d10',
    color: '#e8eaed',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '1rem',
    paddingTop: '0.5rem',
  },
  title: { margin: 0, fontSize: '1.5rem', letterSpacing: '0.04em' },
  summary: { margin: '0.25rem 0 1.75rem', fontSize: '0.875rem', color: '#9aa4b2' },
  show: { marginBottom: '2rem' },
  showTitle: { margin: 0, fontSize: '1.1rem' },
  showFormat: {
    margin: '0.15rem 0 0.85rem',
    fontSize: '0.78rem',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: '#6f7a88',
  },
  empty: { margin: 0, fontSize: '0.875rem', color: '#6f7a88', fontStyle: 'italic' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.6rem' },
  item: {
    background: '#14181d',
    border: '1px solid #222831',
    borderRadius: '11px',
    padding: '0.8rem 0.9rem',
  },
  itemHead: { display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' },
  number: {
    fontVariantNumeric: 'tabular-nums',
    fontSize: '0.78rem',
    color: '#6f7a88',
    minWidth: '1.4rem',
  },
  itemTitle: { fontWeight: 600, flex: '1 1 8rem' },
  onAir: {
    fontSize: '0.7rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#0b0d10',
    background: '#7cc4a4',
    borderRadius: '999px',
    padding: '0.15rem 0.5rem',
    whiteSpace: 'nowrap',
  },
  planned: {
    fontSize: '0.7rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#9aa4b2',
    border: '1px solid #2d343d',
    borderRadius: '999px',
    padding: '0.15rem 0.5rem',
    whiteSpace: 'nowrap',
  },
  itemSummary: { margin: '0.45rem 0 0', fontSize: '0.875rem', color: '#9aa4b2' },
  runtime: {
    margin: '0.3rem 0 0',
    fontSize: '0.78rem',
    color: '#6f7a88',
    fontVariantNumeric: 'tabular-nums',
  },
  footer: {
    margin: '2rem 0 0',
    paddingTop: '1rem',
    borderTop: '1px solid #1c222a',
    fontSize: '0.8rem',
    color: '#6f7a88',
    lineHeight: 1.6,
  },
  code: { background: '#14181d', borderRadius: '5px', padding: '0.1rem 0.3rem' },
};
