'use client'

import React, { useMemo, useState } from 'react'

const MobilePolaroidGallery = ({ images = [] }) => {
  const n = images.length || 8
  const [isPaused, setIsPaused] = useState(false)
  
  // Generate random rotations for each image
  const rotations = useMemo(() => {
    return Array.from({ length: n }, () => -20 + Math.random() * 40)
  }, [n])
  
  // Captions for each polaroid
  const captions = useMemo(() => [
    { year: "3500 BCE", location: "Mesopotamia" },
    { year: "1348 CE", location: "Venice" },
    { year: "1987 CE", location: "Tokyo" },
    { year: "2089 CE", location: "Neo-Miami" },
    { year: "2156 CE", location: "Lunar Colony" },
    { year: "2234 CE", location: "Europa" },
    { year: "2455 CE", location: "Dyson Sphere" },
    { year: "2801 CE", location: "Andromeda" }
  ], [])
  
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .mobile-gallery {
          --d: 16s; /* duration - slower shuffling */
          --n: ${n}; /* number of images */
          
          display: grid;
          width: 300px;
          margin: 0 auto;
          padding-top: 60px;
          position: relative;
          height: 380px;
          cursor: pointer;
        }
        
        .mobile-gallery.paused > .polaroid-wrapper {
          animation-play-state: paused !important;
        }
        
        .polaroid-wrapper {
          grid-area: 1/1;
          width: 100%;
          position: relative;
          z-index: 2;
          animation: 
            slide var(--d) infinite,
            z-order var(--d) infinite steps(1);
        }
        
        .polaroid-wrapper:last-child {
          animation-name: slide, z-order-last;
        }
        
        .polaroid-frame {
          background: white;
          padding: 10px 10px 60px 10px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.1);
          width: 100%;
          box-sizing: border-box;
          position: relative;
        }
        
        .polaroid-img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          display: block;
        }
        
        .polaroid-caption {
          position: absolute;
          bottom: 8px;
          left: 10px;
          right: 10px;
          text-align: center;
          font-family: 'Courier New', monospace;
          color: #333;
          font-size: 11px;
          line-height: 1.2;
        }
        
        .polaroid-year {
          font-weight: bold;
          font-size: 12px;
        }
        
        .polaroid-location {
          font-style: italic;
          font-size: 10px;
          opacity: 0.7;
          margin-top: 2px;
        }
        
        /* Generated styles for each image */
        ${Array.from({ length: n }, (_, i) => `
        .polaroid-wrapper:nth-child(${i + 1}) {
          animation-delay: calc(${(1 - (i + 1))/n} * var(--d));
          --r: ${rotations[i]}deg;
        }`).join('')}
        
        @keyframes slide {
          0% {
            transform: translateX(0%) rotate(var(--r));
          }
          ${10/n}% {
            transform: translateX(120%) rotate(var(--r));
          }
          ${10/n + 0.01}% {
            transform: translateX(120%) rotate(var(--r));
          }
          ${20/n}% {
            transform: translateX(0%) rotate(var(--r));
          }
          100% {
            transform: translateX(0%) rotate(var(--r));
          }
        }
        
        @keyframes z-order {
          0%, ${10/n - 0.01}% {
            z-index: 2;
          }
          ${10/n}%, ${100 - 100/n - 0.01}% {
            z-index: 1;
          }
          ${100 - 100/n}%, 100% {
            z-index: 2;
          }
        }
        
        @keyframes z-order-last {
          0%, ${10/n - 0.01}% {
            z-index: 2;
          }
          ${10/n}%, ${100 - 50/n - 0.01}% {
            z-index: 1;
          }
          ${100 - 50/n}%, 100% {
            z-index: 2;
          }
        }
        
        .gallery-container {
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #CDB380 0%, #B39C7D 100%);
          overflow: hidden;
          position: relative;
        }
        
        .pause-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 10px 20px;
          border-radius: 20px;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s;
          z-index: 100;
        }
        
        .pause-indicator.visible {
          opacity: 1;
        }
      `}} />
      
      <div className="gallery-container">
        <div 
          className={`mobile-gallery ${isPaused ? 'paused' : ''}`}
          onClick={() => setIsPaused(!isPaused)}
        >
          <div className={`pause-indicator ${isPaused ? 'visible' : ''}`}>
            {isPaused ? 'Paused - Tap to resume' : 'Shuffling...'}
          </div>
          {images.map((img, i) => (
            <div key={i} className="polaroid-wrapper">
              <div className="polaroid-frame">
                <img 
                  className="polaroid-img"
                  src={img.url || `/carousel_images/img${(i % 8) + 1}.jpg`}
                  alt={`Polaroid ${i + 1}`}
                />
                <div className="polaroid-caption">
                  <div className="polaroid-year">{captions[i]?.year}</div>
                  <div className="polaroid-location">{captions[i]?.location}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default MobilePolaroidGallery