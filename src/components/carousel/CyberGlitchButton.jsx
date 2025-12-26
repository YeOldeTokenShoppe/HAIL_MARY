'use client'

import React from 'react'

export default function CyberGlitchButton({ 
  text = "ENTER_", 
  onClick,
  href,
  primaryHue = 298,  // Purple/pink for your theme
  primaryShadowHue = 180,
  secondaryShadowHue = 60,
  label = "RL80",
  mobile = false,
  ...props 
}) {
  const handleClick = (e) => {
    if (href) {
      window.location.href = href
    } else if (onClick) {
      onClick(e)
    }
  }
  
  return (
    <>
      <style jsx>{`
        @keyframes shimmy-text {
          0% {
            clip-path: inset(2% 0 95% 0);
          }
          2%, 8% {
            clip-path: inset(78% 0 0 0);
            transform: translate(-5px, 0);
          }
          6% {
            clip-path: inset(78% 0 0 0);
            transform: translate(5px, 0);
          }
          9% {
            clip-path: inset(78% 0 0 0);
            transform: translate(0, 0);
          }
          10% {
            clip-path: inset(44% 0 46% 0);
            transform: translate(5px, 0);
          }
          13% {
            clip-path: inset(44% 0 46% 0);
            transform: translate(0, 0);
          }
          14%, 21% {
            clip-path: inset(0 0 100% 0);
            transform: translate(5px, 0);
          }
          15%, 20% {
            clip-path: inset(40% 0 60% 0);
            transform: translate(5px, 0);
          }
          25% {
            clip-path: inset(40% 0 15% 0);
            transform: translate(5px, 0);
          }
          30% {
            clip-path: inset(40% 0 15% 0);
            transform: translate(-5px, 0);
          }
          35%, 45% {
            clip-path: inset(63% 0 20% 0);
            transform: translate(-5px, 0);
          }
          40% {
            clip-path: inset(63% 0 20% 0);
            transform: translate(5px, 0);
          }
          50% {
            clip-path: inset(63% 0 20% 0);
            transform: translate(0, 0);
          }
          55% {
            clip-path: inset(0 0 90% 0);
            transform: translate(5px, 0);
          }
          60% {
            clip-path: inset(0 0 90% 0);
            transform: translate(0, 0);
          }
          31%, 61%, 100% {
            clip-path: inset(0 0 100% 0);
          }
        }
        
        .cybr-btn {
          font-family: monospace;
          font-weight: bold;
          position: relative;
          text-transform: uppercase;
          font-size: ${mobile ? '20px' : '26px'};
          outline: transparent;
          border: 0;
          min-width: ${mobile ? '200px' : '300px'};
          clip-path: polygon(-10% -10%, 110% -10%, 110% 110%, 10% 110%, -10% 40%);
          padding: ${mobile ? '20px 40px' : '32px 64px'};
          transition: all 0.1s ease;
          cursor: pointer;
        }
        
        .cybr-btn:hover .cybr-btn__text::after,
        .cybr-btn:hover .cybr-btn__glitch::after {
          display: block;
        }
        
        .cybr-btn:hover {
          --primary-lightness: 40;
        }
        
        .cybr-btn:active {
          --primary-lightness: 30;
        }
        
        .cybr-btn__glitch {
          height: 100%;
          width: 100%;
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          pointer-events: none;
        }
        
        .cybr-btn__glitch::after {
          display: none;
          content: '';
          height: 98%;
          width: 98%;
          position: absolute;
          top: 1%;
          left: 1%;
          background: inherit;
          animation: shimmy-text 2s infinite alternate ease-in-out;
        }
        
        .cybr-btn__text {
          color: white;
          display: block;
          height: 100%;
          width: 100%;
          position: relative;
          z-index: 2;
          white-space: nowrap;
        }
        
        .cybr-btn__text::after {
          display: none;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          position: absolute;
          content: attr(data-text);
          color: white;
          filter: brightness(1);
          animation: shimmy-text 2s infinite alternate ease-in-out;
        }
        
      `}</style>
      
      <button
        className="cybr-btn"
        onClick={handleClick}
        style={{
          '--primary-hue': primaryHue,
          '--primary-lightness': 50,
          '--shadow-primary-hue': primaryShadowHue,
          '--shadow-secondary-hue': secondaryShadowHue,
          background: `hsl(${primaryHue}, 85%, calc(var(--primary-lightness) * 1%))`,
          boxShadow: `-2px 0 1px 0px inset hsl(${primaryShadowHue}, 90%, 50%)`,
        }}
        {...props}
      >
        <span 
          className="cybr-btn__text" 
          data-text={text}
          style={{
            textShadow: `2px 2px hsl(${primaryShadowHue}, 90%, 50%), -2px -2px hsl(${secondaryShadowHue}, 90%, 60%)`,
          }}
        >
          {text}
        </span>
        <span 
          className="cybr-btn__glitch"
          style={{
            filter: `drop-shadow(-2px 2px hsl(${primaryShadowHue}, 90%, 50%)) 
                     drop-shadow(-1px -1px hsla(${primaryShadowHue}, 90%, 50%, 0.5)) 
                     drop-shadow(2px 2px hsl(${primaryShadowHue}, 90%, 50%))`,
          }}
        />
        <span 
          style={{
            position: 'absolute',
            padding: '1px 4px',
            lineHeight: 1,
            bottom: '-5%',
            right: '5%',
            background: `hsl(${secondaryShadowHue}, 90%, 60%)`,
            color: 'hsl(0, 0%, 5%)',
            fontSize: '9px',
            letterSpacing: '1px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            boxShadow: `2px 0 1px 0 inset hsl(${primaryShadowHue}, 90%, 50%)`,
          }}
        >
          {label}
        </span>
      </button>
    </>
  )
}