'use client';

import React, { useState, useEffect } from 'react';
import './PolaroidDisplay.css';

export default function PolaroidDisplay({ imageUrl, isVisible, position = 'bottom-right', onClose }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    if (imageUrl) {
      const img = new Image();
      img.onload = () => setIsLoaded(true);
      img.src = imageUrl;
    }
  }, [imageUrl]);

  useEffect(() => {
    if (isLoaded) {
      // Show action buttons after a delay
      const timer = setTimeout(() => setShowActions(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `candle-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'candle.jpg', { type: 'image/jpeg' });
        
        await navigator.share({
          title: 'My Prayer Candle',
          text: 'Check out my prayer candle!',
          files: [file]
        });
      } catch (error) {
        // AbortError happens when user cancels the share dialog - this is normal behavior
        if (error.name !== 'AbortError') {
          console.error('Share failed:', error);
        }
        // Silently ignore user cancellation
      }
    }
  };

  if (!isVisible || !imageUrl) return null;

  return (
    <div 
      className={`polaroid-display ${position} ${isLoaded ? 'loaded' : ''}`}
      onClick={onClose}
    >
      <div className="polaroid-wrapper" onClick={(e) => e.stopPropagation()}>
        <img 
          src={imageUrl} 
          alt="Prayer Candle Polaroid" 
          className={`polaroid-image ${isLoaded ? 'visible' : ''}`}
        />
        
        {showActions && (
          <div className="polaroid-actions">
            <button onClick={handleDownload} className="action-button">
              <span>📥</span>
            </button>
            {navigator.share && (
              <button onClick={handleShare} className="action-button">
                <span>🔗</span>
              </button>
            )}
            <button onClick={onClose} className="action-button close">
              <span>✕</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}