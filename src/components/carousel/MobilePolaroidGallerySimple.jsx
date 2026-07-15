'use client'

import React, { useMemo, useState, useRef } from 'react'
import { useLanguage } from '../LanguageProvider'
import DropInTitle from '../DropInTitle'
import { useInView } from "framer-motion";

// How long after a tap a second one still counts as a double tap.
const DOUBLE_TAP_MS = 300

// `onSelect` is optional and opt-in: /about's Carousel.js mounts this without
// it and keeps the plain tap-to-pause gallery it has always had. Only the root
// page passes one, which is what turns a double tap into a close-up.
const MobilePolaroidGallerySimple = ({ images = [], is80sMode = false, onSelect }) => {
  const n = images.length || 8
  const [isPaused, setIsPaused] = useState(false)
  const lastTapRef = useRef({ time: 0, index: -1 })
  const { t } = useLanguage()

  // Both taps of a double tap still run the pause toggle, so the two cancel out
  // and the gallery is left exactly as it was found. That's deliberate: the
  // alternative — holding the toggle back for DOUBLE_TAP_MS to see whether a
  // second tap is coming — would put a visible 300ms stall on every single tap,
  // which is the gesture people actually use.
  const handleTap = (e) => {
    setIsPaused((p) => !p)
    if (!onSelect) return

    // The frame under the finger IS the event target: the browser hit-tests
    // through the z-order the shuffle animation assigns, so the topmost card
    // falls out of the event for free. Deriving it from elapsed animation time
    // would mean re-deriving the whole keyframe schedule in JS.
    const frame = e.target.closest?.('.polaroid-frame')
    const index = frame ? Number(frame.dataset.index) : -1
    if (index < 0) return

    const prev = lastTapRef.current
    // Same card, not just a second tap anywhere: if the stack shuffled between
    // the two, opening whatever landed under the finger would be a surprise.
    // (In practice the first tap's pause freezes it, so it rarely can.)
    if (e.timeStamp - prev.time < DOUBLE_TAP_MS && prev.index === index) {
      lastTapRef.current = { time: 0, index: -1 }
      onSelect(index)
      return
    }
    lastTapRef.current = { time: e.timeStamp, index }
  }
    const ref = useRef(null);
    const inView = useInView(ref, {
      amount: 0.01,
      margin: "200px 0px",
    });
  const captions = useMemo(() => {
    // Try to get captions from translations, fallback to hardcoded if not available
    const translatedCaptions = []
    for (let i = 0; i < 8; i++) {
      const caption = t(`carousel.captions.${i}`)
      if (caption && typeof caption === 'object') {
        translatedCaptions.push(caption)
      }
    }
    
    // If we got all 8 captions from translations, use them
    if (translatedCaptions.length === 8) {
      return translatedCaptions
    }
    
    // Otherwise fallback to hardcoded captions
    return [
      { year: "2200 BCE", location: "Fertile Crescent", description: "Driving back a bear market" },
      { year: "1982 CE", location: "Los Angeles", description: "The Guardian of Good Times" },
      { year: "circa 1350–1450 CE", location: "Wartburg Castle, Thuringia", description: "Early clown encounter turns ugly" },
      { year: "2019 CE", location: "Tokyo", description: "Featured in popular manga series" },
      { year: "2081 CE", location: "Neo-Miami", description: "Laying down DeFi Beats" },
      { year: "2077 CE", location: "Night City", description: "Still popular in cyberpunk culture" },
      { year: "87 CE", location: "Peloponnesian Peninsula", description: "Managing the attention economy" },
      { year: "4th century CE", location: "Transtiberim, Rome", description: "Supporting the arts - pre-meme era" }
    ]
  }, [t])
  
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .polaroid-gallery {
          --d: 30s; 
          display: grid;
          width: 17rem;
          position: fixed;
          top: calc(35% + 1rem);
          left: 50%;
          transform: translate(-50%, -50%);
          cursor: pointer;
          margin-top: 2rem;
          margin-bottom: 7rem;
          z-index: 10;
        }
        
        .polaroid-gallery.paused > .polaroid-frame {
          animation-play-state: paused !important;
        }


         @media (max-width: 480px) {
                 .polaroid-gallery {
                    width: 15rem;
                }
              }
        
        .polaroid-gallery > .polaroid-frame {
          grid-area: 1/1;
          width: 100%;
          background: white;
          padding: 10px 10px 80px 10px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 2;
          
          // animation: 
          //   polaroid-slide var(--d) infinite,
          //   polaroid-z-order var(--d) infinite steps(1);
        }
          @keyframes z1 { 0%,87.5% { z-index: 8 } 6.25%,12.5% { z-index: 0 } }
@keyframes z2 { 0%,87.5% { z-index: 8 } 6.25%,12.5% { z-index: 0 } }
@keyframes z3 { 0%,87.5% { z-index: 8 } 6.25%,12.5% { z-index: 0 } }
@keyframes z4 { 0%,87.5% { z-index: 8 } 6.25%,12.5% { z-index: 0 } }
@keyframes z5 { 0%,87.5% { z-index: 8 } 6.25%,12.5% { z-index: 0 } }
@keyframes z6 { 0%,87.5% { z-index: 8 } 6.25%,12.5% { z-index: 0 } }
@keyframes z7 { 0%,87.5% { z-index: 8 } 6.25%,12.5% { z-index: 0 } }
@keyframes z8 { 0%,93.75% { z-index: 8 } 6.25%,12.5% { z-index: 0 } }

.polaroid-gallery > .polaroid-frame:nth-child(1) { animation: polaroid-slide var(--d) infinite, z1 var(--d) infinite steps(1); }
.polaroid-gallery > .polaroid-frame:nth-child(2) { animation: polaroid-slide var(--d) infinite, z2 var(--d) infinite steps(1); }
.polaroid-gallery > .polaroid-frame:nth-child(3) { animation: polaroid-slide var(--d) infinite, z3 var(--d) infinite steps(1); }
.polaroid-gallery > .polaroid-frame:nth-child(4) { animation: polaroid-slide var(--d) infinite, z4 var(--d) infinite steps(1); }
.polaroid-gallery > .polaroid-frame:nth-child(5) { animation: polaroid-slide var(--d) infinite, z5 var(--d) infinite steps(1); }
.polaroid-gallery > .polaroid-frame:nth-child(6) { animation: polaroid-slide var(--d) infinite, z6 var(--d) infinite steps(1); }
.polaroid-gallery > .polaroid-frame:nth-child(7) { animation: polaroid-slide var(--d) infinite, z7 var(--d) infinite steps(1); }
.polaroid-gallery > .polaroid-frame:nth-child(8) { animation: polaroid-slide var(--d) infinite, z8 var(--d) infinite steps(1); }
        
        // .polaroid-gallery .polaroid-frame:last-child {
        //   animation-name: polaroid-slide, polaroid-z-order-last;
        // }
        
        .polaroid-frame img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          display: block;
        }
        
        .polaroid-caption {
          position: absolute;
          bottom: 15px;
          left: 10px;
          right: 10px;
          text-align: center;
          font-family: 'Permanent Marker';
          color: #333;
          font-size: 16px;
          line-height: 1.15;
        }
        
        .polaroid-year {
          font-weight: bold;
          font-size: 15px;
        }
        
        .polaroid-location {
          font-style: italic;
          font-size: 13px;
          opacity: 0.7;
          margin-top: 1px;
        }
        
        .polaroid-description {
          font-size: 12px;
          opacity: 0.6;
          margin-top: 2px;
          font-style: normal;
          line-height: 1.2;
        }
        
        /* Individual image styles for 8 images */
        .polaroid-gallery > .polaroid-frame:nth-child(1) {
          animation-delay: calc(0s * var(--d));
          --r: -15deg;
        }
        .polaroid-gallery > .polaroid-frame:nth-child(2) {
          animation-delay: calc(-0.125 * var(--d));
          --r: 5deg;
        }
        .polaroid-gallery > .polaroid-frame:nth-child(3) {
          animation-delay: calc(-0.25 * var(--d));
          --r: -10deg;
        }
        .polaroid-gallery > .polaroid-frame:nth-child(4) {
          animation-delay: calc(-0.375 * var(--d));
          --r: 12deg;
        }
        .polaroid-gallery > .polaroid-frame:nth-child(5) {
          animation-delay: calc(-0.5 * var(--d));
          --r: -8deg;
        }
        .polaroid-gallery > .polaroid-frame:nth-child(6) {
          animation-delay: calc(-0.625 * var(--d));
          --r: 18deg;
        }
        .polaroid-gallery > .polaroid-frame:nth-child(7) {
          animation-delay: calc(-0.75 * var(--d));
          --r: -5deg;
        }
        .polaroid-gallery > .polaroid-frame:nth-child(8) {
          animation-delay: calc(-0.875 * var(--d));
          --r: 10deg;
        }
        
        @keyframes polaroid-slide {
          6.25% { transform: translateX(120%) rotate(var(--r)) }
          0%,
          100%,
          12.5% { transform: translateX(0%) rotate(var(--r)) }
        }
        
@keyframes polaroid-z-order {
  0%, 6.24% { z-index: 10 }
  6.25%, 87.49% { z-index: 1 }
  87.5%, 100% { z-index: 10 }
}

@keyframes polaroid-z-order-last {
  0%, 6.24% { z-index: 10 }
  6.25%, 93.74% { z-index: 1 }
  93.75%, 100% { z-index: 10 }
}
        
        .polaroid-container {
          height: 100vh;
          width: 100vw;
          display: grid;
          place-content: center;
          background: ${is80sMode ? 'transparent' : 'linear-gradient(135deg, #CDB380 0%, #B39C7D 100%)'};
          overflow: hidden;
          position: fixed;
          top: 0;
          left: 0;
          touch-action: pan-x;
        }
        
        .pause-indicator {
          position: absolute;
          top: 65%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 10px 20px;
          border-radius: 20px;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          text-align: center;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s;
          z-index: 100;
        }
        
        .pause-indicator.visible {
          opacity: 1;
        }
        
        .mobile-gallery-info {
          position: fixed;
          bottom: 18%;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          color: #333;
          font-family: 'Permanent Marker', -apple-system, BlinkMacSystemFont, sans-serif;
          z-index: 11;
          padding: 0 20px;
          width: 90%;
          max-width: 320px;
        }
        
        .mobile-gallery-heading {
          font-size: 24px;
          margin-bottom: -5px;
          letter-spacing: 0.5px;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .mobile-gallery-description {
          font-size: 14px;
          line-height: 1.4;
          opacity: 0.8;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-weight: 400;
        }
      `}} />
      <div style={{ marginBottom: "3rem" }}>
       <DropInTitle
                lines={["Souvenirs", "From the", "Singular80"]}
            colors={["#00ff00", "#f4e4c1", "#ffd700"]}
                fontSize={{ mobile: "3rem", desktop: "3.4rem" }}
                isMobile={typeof window !== "undefined" && window.innerWidth <= 900}
                triggerAnimation={inView}
                instanceId="holy-trin-heading"
              />
              </div>
                       <p className="mobile-gallery-description">
            {t('carousel.subtitle') || 'A visual canon of Our Lady of Perpetual Profit, from antiquity to the future.'}
          </p>
      
      <div className="polaroid-container">
        <div className={`pause-indicator ${isPaused ? 'visible' : ''}`}>
          {isPaused ? 'Paused - Tap to resume' : 'Shuffling...'}
        </div>
        <div
          className={`polaroid-gallery ${isPaused ? 'paused' : ''}`}
          onClick={handleTap}
        >
          {images.slice(0, 8).map((img, i) => (
            <div key={i} className="polaroid-frame" data-index={i}>
              <img 
                src={img.url || `/carousel_images/img${i + 1}.jpg`}
                alt={`Polaroid ${i + 1}`}
              />
              <div className="polaroid-caption">
                <div className="polaroid-year">{captions[i]?.year}</div>
                <div className="polaroid-location">{captions[i]?.location}</div>
                <div className="polaroid-description">{captions[i]?.description}</div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mobile-gallery-info">
          {/* <h2 className="mobile-gallery-heading">{t('carousel.title') || 'Iconography'}</h2> */}
 

        </div>
      </div>
    </>
  )
}

export default MobilePolaroidGallerySimple