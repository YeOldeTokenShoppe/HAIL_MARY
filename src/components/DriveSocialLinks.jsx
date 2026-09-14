export default function DriveSocialLinks({ vertical = false }) {
  return <nav aria-label="Social links" className={vertical ? 'socials vertical' : 'socials'}>
    {[
      ['X (Twitter)', 'https://x.com/rl80token', '/x_logo_white.webp'],
      ['Telegram', 'https://t.me/rl80token', '/telegram_logo_white.webp'],
      ['Farcaster', 'https://farcaster.xyz/rl80', '/farcaster_logo.webp'],
    ].map(([name, href, src]) => <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={name}><img src={src} alt="" /></a>)}
    <style jsx>{`
      .socials { display: flex; justify-content: center; gap: 12px; }
      .vertical { flex-direction: column; }
      a { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; border: 1px solid #ffffff26; background: #160e204d; transition: background .2s, border-color .2s; }
      img { width: 18px; height: 18px; object-fit: contain; opacity: .85; }
      a:hover, a:focus-visible { border-color: #ec54d5; background: #2d1534cc; }
      a:focus-visible { outline: 2px solid #ec54d5; outline-offset: 4px; }
    `}</style>
  </nav>;
}
