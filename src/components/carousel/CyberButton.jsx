'use client'

import React, { useState } from 'react'

export default function CyberButton({ 
  children, 
  onClick, 
  href, 
  keyText = 'ENTER',
  glitchText,
  ...props 
}) {
  const [isHovered, setIsHovered] = useState(false)
  
  const handleClick = (e) => {
    if (href) {
      window.location.href = href
    } else if (onClick) {
      onClick(e)
    }
  }
  
  const buttonStyle = {
    '--corner': '12px',
    '--border': '2px',
    '--clip': `polygon(
      0 0,
      100% 0,
      100% calc(100% - var(--corner)),
      calc(100% - var(--corner)) 100%,
      0% 100%
    )`,
    fontFamily: 'monospace',
    fontSize: '1.2rem',
    letterSpacing: '2px',
    width: '200px',
    textAlign: 'left',
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    border: '0',
    background: 'transparent',
    position: 'relative',
    color: '#ff6ec7',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    pointerEvents: 'auto',
  }
  
  const backdropStyle = {
    position: 'absolute',
    zIndex: -1,
    inset: 0,
    background: isHovered 
      ? 'linear-gradient(135deg, #ff6ec7, #c77dff)'
      : 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    clipPath: 'var(--clip)',
    pointerEvents: 'none',
    transition: 'all 0.3s ease',
  }
  
  const backdropBorderStyle = {
    content: '""',
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, #ff6ec7, #c77dff)',
    translate: '0 0',
    border: 'var(--border) solid transparent',
    clipPath: 'var(--clip)',
    mask: 'linear-gradient(#0000 0% 100%), linear-gradient(#fff 0% 100%)',
    WebkitMask: 'linear-gradient(#0000 0% 100%), linear-gradient(#fff 0% 100%)',
    maskClip: 'padding-box, border-box',
    WebkitMaskClip: 'padding-box, border-box',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
    zIndex: 2,
  }
  
  const cornerStyle = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    height: 'var(--corner)',
    width: 'var(--corner)',
  }
  
  const cornerAfterStyle = {
    content: '""',
    height: 'calc(var(--border) * 2)',
    width: '200%',
    position: 'absolute',
    top: '50%',
    left: '50%',
    translate: '-50% -50%',
    transform: 'rotate(135deg)',
    background: 'linear-gradient(135deg, #ff6ec7, #c77dff)',
  }
  
  const kbdStyle = {
    color: isHovered ? '#000' : '#fff',
    fontWeight: 'bold',
    width: '28px',
    height: '28px',
    fontSize: '10px',
    borderRadius: '50%',
    background: isHovered 
      ? '#fff' 
      : 'linear-gradient(135deg, #ff6ec7, #c77dff)',
    display: 'inline-grid',
    placeItems: 'center',
    transition: 'all 0.3s ease',
  }
  
  const glitchStyle = {
    display: isHovered ? 'flex' : 'none',
    position: 'absolute',
    inset: 0,
    translate: '0% 0',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    pointerEvents: 'none',
    color: '#7209b7',
    textShadow: '0 1px #ff6ec7',
    animation: isHovered ? 'glitch 2s infinite' : 'none',
  }
  
  return (
    <>
      <style jsx>{`
        @keyframes glitch {
          0% { clip-path: polygon(0 2%, 100% 2%, 100% 95%, 95% 95%, 95% 90%, 85% 90%, 85% 95%, 8% 95%, 0 70%); }
          2%, 8% { 
            clip-path: polygon(0 78%, 100% 78%, 100% 100%, 95% 100%, 95% 90%, 85% 90%, 85% 100%, 8% 100%, 0 78%);
            transform: translate(-5px, 0);
          }
          6% { 
            clip-path: polygon(0 78%, 100% 78%, 100% 100%, 95% 100%, 95% 90%, 85% 90%, 85% 100%, 8% 100%, 0 78%);
            transform: translate(5px, 0);
          }
          9% { 
            clip-path: polygon(0 78%, 100% 78%, 100% 100%, 95% 100%, 95% 90%, 85% 90%, 85% 100%, 8% 100%, 0 78%);
            transform: translate(0, 0);
          }
          10% { 
            clip-path: polygon(0 44%, 100% 44%, 100% 54%, 95% 54%, 95% 54%, 85% 54%, 85% 54%, 8% 54%, 0 54%);
            transform: translate(5px, 0);
          }
          13% { 
            clip-path: polygon(0 44%, 100% 44%, 100% 54%, 95% 54%, 95% 54%, 85% 54%, 85% 54%, 8% 54%, 0 54%);
            transform: translate(0, 0);
          }
          14%, 21% { 
            clip-path: polygon(0 0, 100% 0, 100% 0, 95% 0, 95% 0, 85% 0, 85% 0, 8% 0, 0 0);
            transform: translate(5px, 0);
          }
          25% { 
            clip-path: polygon(0 0, 100% 0, 100% 0, 95% 0, 95% 0, 85% 0, 85% 0, 8% 0, 0 0);
            transform: translate(5px, 0);
          }
          30% { 
            clip-path: polygon(0 0, 100% 0, 100% 0, 95% 0, 95% 0, 85% 0, 85% 0, 8% 0, 0 0);
            transform: translate(-5px, 0);
          }
          35%, 45% { 
            clip-path: polygon(0 40%, 100% 40%, 100% 85%, 95% 85%, 95% 85%, 85% 85%, 85% 85%, 8% 85%, 0 70%);
            transform: translate(-5px, 0);
          }
          40% { 
            clip-path: polygon(0 40%, 100% 40%, 100% 85%, 95% 85%, 95% 85%, 85% 85%, 85% 85%, 8% 85%, 0 70%);
            transform: translate(5px, 0);
          }
          50% { 
            clip-path: polygon(0 40%, 100% 40%, 100% 85%, 95% 85%, 95% 85%, 85% 85%, 85% 85%, 8% 85%, 0 70%);
            transform: translate(0, 0);
          }
          55% { 
            clip-path: polygon(0 63%, 100% 63%, 100% 80%, 95% 80%, 95% 80%, 85% 80%, 85% 80%, 8% 80%, 0 70%);
            transform: translate(5px, 0);
          }
          60% { 
            clip-path: polygon(0 63%, 100% 63%, 100% 80%, 95% 80%, 95% 80%, 85% 80%, 85% 80%, 8% 80%, 0 70%);
            transform: translate(0, 0);
          }
          31%, 61%, 100% { 
            clip-path: polygon(0 0, 100% 0, 100% 0, 95% 0, 95% 0, 85% 0, 85% 0, 8% 0, 0 0);
          }
        }
      `}</style>
      
      <button
        style={buttonStyle}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        {...props}
      >
        <span style={backdropStyle}>
          <span style={backdropBorderStyle}></span>
          <span style={cornerStyle}>
            <span style={{
              ...cornerAfterStyle,
              position: 'absolute',
              content: '""',
              display: 'block',
            }}></span>
          </span>
        </span>
        <kbd style={kbdStyle}>{keyText}</kbd>
        <span style={{ 
          position: 'relative',
          zIndex: 1,
          color: isHovered ? '#000' : '#ff6ec7',
          transition: 'color 0.3s ease',
        }}>
          {children}
        </span>
        {glitchText && (
          <div style={glitchStyle} aria-hidden="true">
            <span style={backdropStyle}>
              <span style={cornerStyle}></span>
            </span>
            <kbd style={kbdStyle}>{keyText}</kbd>
            <span style={{ display: 'flex', gap: '2px' }}>
              {glitchText.split('').map((char, i) => (
                <span 
                  key={i}
                  style={{
                    transform: i % 3 === 0 ? 'scaleY(-1)' : i % 2 === 0 ? 'scale(-1, -1)' : 'none',
                  }}
                >
                  {char}
                </span>
              ))}
            </span>
          </div>
        )}
      </button>
    </>
  )
}