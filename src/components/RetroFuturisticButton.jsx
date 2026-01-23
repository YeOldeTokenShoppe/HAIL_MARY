'use client'

import React, { useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'

export default function RetroFuturisticButton({
  children = 'Button',
  onClick,
  disabled = false,
  className = '',
  mobile,  // Destructure to prevent passing to DOM
  ...props
}) {
  const buttonRef = useRef(null)
  const blueRectsRef = useRef([])
  const pinkRectsRef = useRef([])
  const isActiveRef = useRef(false)

  const animateIn = useCallback(() => {
    if (isActiveRef.current) return
    isActiveRef.current = true

    const blueRects = gsap.utils.shuffle([...blueRectsRef.current])
    const pinkRects = gsap.utils.shuffle([...pinkRectsRef.current])

    gsap.to(pinkRects, {
      duration: 1.6,
      ease: 'elastic.out(1, 0.3)',
      xPercent: 100,
      stagger: 0.01,
      overwrite: true
    })

    gsap.to(blueRects, {
      duration: 1.6,
      ease: 'elastic.out(1, 0.3)',
      xPercent: 100,
      stagger: 0.01,
      overwrite: true,
      delay: 0.13
    })
  }, [])

  const animateOut = useCallback(() => {
    if (!isActiveRef.current) return
    isActiveRef.current = false

    const blueRects = gsap.utils.shuffle([...blueRectsRef.current])
    const pinkRects = gsap.utils.shuffle([...pinkRectsRef.current])

    gsap.to(pinkRects, {
      duration: 1.6,
      ease: 'elastic.out(1, 0.3)',
      xPercent: -100,
      stagger: 0.01,
      overwrite: true
    })

    gsap.to(blueRects, {
      duration: 1.6,
      ease: 'elastic.out(1, 0.3)',
      xPercent: -100,
      stagger: 0.01,
      overwrite: true,
      delay: 0.13
    })
  }, [])

  useEffect(() => {
    // Initialize rects at -100%
    gsap.set([...blueRectsRef.current, ...pinkRectsRef.current], { xPercent: -100 })
  }, [])

  const handleClick = (e) => {
    if (!disabled && onClick) {
      onClick(e)
    }
  }

  const rectCount = 10
  const rectHeight = 5

  return (
    <>
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@1,500&display=swap');

        .retro-btn {
          position: relative;
          color: #fff;
          cursor: pointer;
          display: flex;
          font-weight: 500;
          font-style: italic;
          align-items: center;
          justify-content: center;
          font-family: 'IBM Plex Mono', monospace;
          height: 50px;
          padding: 0 30px;
          border: none;
          background: transparent;
          transition: transform 0.1s ease;
        }

        .retro-btn:hover {
          transform: scale(1.02);
        }

        .retro-btn:active {
          transform: scale(0.98);
        }

        .retro-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .retro-btn::before {
          background-color: #24252c;
          background-image: repeating-linear-gradient(
            0deg,
            #181a29,
            #181a29 1px,
            #202436 1px,
            #202436 2px
          );
          border-radius: 10px;
          content: '';
          height: 100%;
          position: absolute;
          left: 0;
          top: 0;
          overflow: hidden;
          transform: skew(-15deg);
          transition: box-shadow 700ms;
          width: 100%;
          z-index: -1;
          box-shadow: 0 0 20px 2px #05eafa;
        }

        .retro-btn:hover::before,
        .retro-btn:focus::before {
          box-shadow: 0 0 25px 2px #0763f7;
        }

        .retro-btn:focus {
          outline: none;
        }

        .retro-btn__text {
          transition: color 350ms;
          z-index: 1;
        }

        .retro-btn:hover .retro-btn__text {
          color: #c40a35;
        }

        .retro-btn__svg {
          border-radius: 10px;
          overflow: hidden;
          position: absolute;
          transform: skew(-15deg);
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .retro-btn__svg .blue rect {
          fill: #05eafa;
          shape-rendering: crispEdges;
          mix-blend-mode: color-dodge;
        }

        .retro-btn__svg .pink rect {
          fill: #ff6bd3;
          shape-rendering: crispEdges;
        }
      `}</style>

      <button
        ref={buttonRef}
        className={`retro-btn ${className}`}
        onClick={handleClick}
        onMouseEnter={animateIn}
        onMouseLeave={animateOut}
        onFocus={animateIn}
        onBlur={animateOut}
        disabled={disabled}
        {...props}
      >
        <span className="retro-btn__text">{children}</span>
        <svg className="retro-btn__svg" height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
          <g className="pink">
            {Array.from({ length: rectCount }, (_, i) => (
              <rect
                key={`pink-${i}`}
                ref={(el) => { if (el) pinkRectsRef.current[i] = el }}
                x="-100%"
                y={i * rectHeight}
                width="100%"
                height={rectHeight}
              />
            ))}
          </g>
          <g className="blue">
            {Array.from({ length: rectCount }, (_, i) => (
              <rect
                key={`blue-${i}`}
                ref={(el) => { if (el) blueRectsRef.current[i] = el }}
                x="-100%"
                y={i * rectHeight}
                width="100%"
                height={rectHeight}
              />
            ))}
          </g>
        </svg>
      </button>
    </>
  )
}
