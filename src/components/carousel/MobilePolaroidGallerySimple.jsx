'use client'

import React, { useMemo, useState } from 'react'
import { useLanguage } from '../LanguageProvider'

const MobilePolaroidGallerySimple = ({ images = [], is80sMode = false }) => {
  const n = images.length || 8
  const [isPaused, setIsPaused] = useState(false)
  const { t } = useLanguage()
  
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
      { year: "2200 BCE", location: "Fertile Crescent", description: "Driving back bear market" },
      { year: "1982 CE", location: "Los Angeles", description: "The Guardian of Good Times" },
      { year: "circa 1350–1450 CE", location: "Wartburg Castle, Thuringia", description: "Early clown encounter turns ugly" },
      { year: "2019 CE", location: "Tokyo", description: "Featured in popular manga series" },
      { year: "2081 CE", location: "Neo-Miami", description: "Laying down DeFi Beats" },
      { year: "2077 CE", location: "Night City", description: "Popular among cyberpunk-cyborgs" },
      { year: "87 CE", location: "Peloponnesian Peninsula", description: "Advising on making good choices" },
      { year: "4th century CE", location: "Transtiberim, Rome", description: "Patron of the arts - pre-meme era" }
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
          animation: 
            polaroid-slide var(--d) infinite,
            polaroid-z-order var(--d) infinite steps(1);
        }
        
        .polaroid-gallery .polaroid-frame:last-child {
          animation-name: polaroid-slide, polaroid-z-order-last;
        }
        
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
          6.25%,
          12.5% { z-index: 1 }
          87.5% { z-index: 2 }
        }
        
        @keyframes polaroid-z-order-last {
          6.25%,
          12.5% { z-index: 1 }
          93.75% { z-index: 2 }
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
      
      <div className="polaroid-container">
        <div className={`pause-indicator ${isPaused ? 'visible' : ''}`}>
          {isPaused ? 'Paused - Tap to resume' : 'Shuffling...'}
        </div>
        <div 
          className={`polaroid-gallery ${isPaused ? 'paused' : ''}`}
          onClick={() => setIsPaused(!isPaused)}
        >
          {images.slice(0, 8).map((img, i) => (
            <div key={i} className="polaroid-frame">
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
          <h2 className="mobile-gallery-heading">{t('carousel.title') || 'Iconography'}</h2>
          <p className="mobile-gallery-description">
            {t('carousel.subtitle') || 'A visual canon of Our Lady of Perpetual Profit, from antiquity to the future.'}
          </p>
        </div>
      </div>
    </>
  )
}

export default MobilePolaroidGallerySimple