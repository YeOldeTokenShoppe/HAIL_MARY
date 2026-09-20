'use client';

import { useState } from 'react';

export default function LineupLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/lt-tv/lineup-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        // The page decides what to show, server side, from the cookie just set.
        window.location.reload();
        return;
      }
      const body = await response.json().catch(() => ({}));
      setError(body.error || 'Wrong password.');
    } catch {
      setError('Could not reach the server.');
    }
    setBusy(false);
  }

  return (
    <main style={styles.page}>
      <form style={styles.card} onSubmit={submit}>
        <h1 style={styles.title}>LT TV</h1>
        <p style={styles.blurb}>The lineup, for whoever is making the show.</p>
        <input
          type="password"
          value={password}
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          onChange={(event) => setPassword(event.target.value)}
          style={styles.input}
        />
        <button type="submit" disabled={busy || password.length === 0} style={styles.button}>
          {busy ? 'Checking…' : 'Show me the lineup'}
        </button>
        {error ? <p style={styles.error}>{error}</p> : null}
      </form>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    background: '#0b0d10',
    color: '#e8eaed',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '22rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    background: '#14181d',
    border: '1px solid #262c34',
    borderRadius: '14px',
    padding: '1.5rem',
  },
  title: { margin: 0, fontSize: '1.5rem', letterSpacing: '0.04em' },
  blurb: { margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#9aa4b2' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.7rem 0.8rem',
    fontSize: '1rem',
    color: '#e8eaed',
    background: '#0b0d10',
    border: '1px solid #2d343d',
    borderRadius: '9px',
    outline: 'none',
  },
  button: {
    padding: '0.7rem 0.8rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#0b0d10',
    background: '#7cc4a4',
    border: 'none',
    borderRadius: '9px',
    cursor: 'pointer',
  },
  error: { margin: 0, fontSize: '0.85rem', color: '#e88b8b' },
};
