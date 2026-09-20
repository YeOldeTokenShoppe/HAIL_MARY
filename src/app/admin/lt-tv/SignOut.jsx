'use client';

export default function SignOut() {
  async function signOut() {
    await fetch('/api/lt-tv/lineup-auth', { method: 'DELETE' }).catch(() => {});
    window.location.reload();
  }

  return (
    <button type="button" onClick={signOut} style={styles.button}>
      Sign out
    </button>
  );
}

const styles = {
  button: {
    fontSize: '0.78rem',
    color: '#9aa4b2',
    background: 'transparent',
    border: '1px solid #2d343d',
    borderRadius: '8px',
    padding: '0.3rem 0.6rem',
    cursor: 'pointer',
  },
};
