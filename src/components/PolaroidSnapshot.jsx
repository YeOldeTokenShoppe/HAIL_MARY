'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './PolaroidSnapshot.module.css';

const PolaroidSnapshot = ({ 
  trigger = false, 
  onComplete, 
  captureElementId = 'canvas',
  label = 'Victory!'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [isBlurred, setIsBlurred] = useState(true);
  const [polaroidImageUrl, setPolaroidImageUrl] = useState(null); // Cached polaroid capture
  const [polaroidBlob, setPolaroidBlob] = useState(null); // Cached polaroid blob
  const polaroidRef = useRef(null);

  useEffect(() => {
    if (trigger) {
      captureSnapshot();
    }
  }, [trigger]);

  const captureSnapshot = () => {
    // Double requestAnimationFrame to ensure render is complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Only capture if we have the specific element ID
        if (!captureElementId) {
          console.error('No captureElementId provided for snapshot');
          return;
        }
        
        // Try to get the specific element
        const element = document.getElementById(captureElementId);
        if (!element) {
          console.error(`Element with id "${captureElementId}" not found`);
          return;
        }
        
        // Find the canvas - either the element itself or a canvas inside it
        const canvas = element.tagName === 'CANVAS' ? element : element.querySelector('canvas');
        
        if (!canvas) {
          console.error(`No canvas found in element with id "${captureElementId}"`);
          return;
        }
        
        try {
          // Just capture the canvas directly
          captureCanvasOnly(canvas);
        } catch (error) {
          console.error('Direct capture failed:', error);
          captureWithDelay();
        }
      });
    });
  };

  const captureCanvasOnly = (canvas) => {
    try {
      // Create a new canvas that matches viewport aspect ratio
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d', { 
        preserveDrawingBuffer: true,
        willReadFrequently: true 
      });
      
      // Draw the entire WebGL canvas
      tempCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
      
      // Convert to data URL with high quality
      const dataUrl = tempCanvas.toDataURL('image/png', 1.0);
      
      // Always show the polaroid, even if capture isn't perfect
      if (dataUrl) {
        setImageUrl(dataUrl);
        setIsVisible(true);
        
        setTimeout(() => {
          setIsBlurred(false);
        }, 300);

        if (onComplete) {
          setTimeout(() => {
            onComplete(dataUrl);
          }, 2000);
        }
      } else {
        // Try alternate capture method
        console.warn('Canvas capture was empty, trying alternate method');
        captureWithDelay();
      }
    } catch (error) {
      console.error('Canvas capture failed:', error);
      captureWithDelay();
    }
  };

  // Backup capture with a small delay to let scene render
  const captureWithDelay = () => {
    setTimeout(() => {
      if (!captureElementId) {
        console.error('No captureElementId provided for snapshot');
        return;
      }
      
      const element = document.getElementById(captureElementId);
      if (!element) {
        console.error(`Element with id "${captureElementId}" not found in backup capture`);
        return;
      }
      
      const canvas = element.tagName === 'CANVAS' ? element : element.querySelector('canvas');
      
      if (!canvas) {
        console.error(`No canvas found in element with id "${captureElementId}" in backup capture`);
        return;
      }
      
      // Force a render by scrolling 0 pixels (triggers reflow)
      window.scrollTo(window.scrollX, window.scrollY);
      
      requestAnimationFrame(() => {
        try {
          // Just capture the canvas
          captureCanvasOnly(canvas);
        } catch (e) {
          console.error('Failed to capture in backup:', e);
        }
      });
    }, 100);
  };

  const captureFromCanvas = (canvas) => {
    try {
      // Ensure WebGL preserveDrawingBuffer or use alternative method
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      
      if (gl && gl.drawingBufferWidth > 0 && gl.drawingBufferHeight > 0) {
        // Force a render if possible
        if (canvas._renderer) {
          canvas._renderer.render(canvas._scene, canvas._camera);
        }
      }
      
      // Try to capture the canvas
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      
      // Check if we got a valid image (not just transparent/black)
      if (dataUrl && dataUrl.length > 100) {
        setImageUrl(dataUrl);
        setIsVisible(true);
        
        setTimeout(() => {
          setIsBlurred(false);
        }, 300);

        if (onComplete) {
          setTimeout(() => {
            onComplete(dataUrl);
          }, 2000);
        }
      } else {
        // Fallback: try to capture the entire viewport
        console.warn('Canvas capture resulted in empty image, trying viewport capture');
        captureFromDOM(canvas.parentElement || document.body);
      }
    } catch (error) {
      console.error('Failed to capture canvas:', error);
      // Fallback to DOM capture
      captureFromDOM(canvas.parentElement || document.body);
    }
  };

  const captureFromDOM = (element) => {
    import('html2canvas').then(({ default: html2canvas }) => {
      // Capture the full viewport for better framing
      const captureElement = document.body; // Always capture full body for consistent framing
      
      html2canvas(captureElement, {
        backgroundColor: '#87CEEB', // Match the scene background
        scale: Math.min(window.devicePixelRatio || 1, 2), // Limit scale for performance
        logging: false,
        useCORS: true, // Allow cross-origin images
        allowTaint: false,
        width: window.innerWidth,
        height: window.innerHeight,
        x: 0,
        y: 0,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        ignoreElements: (element) => {
          // Ignore the polaroid itself if it's already visible
          return element.classList?.contains(styles.overlay) ||
                 element.classList?.contains('action-button');
        },
        onclone: (clonedDoc) => {
          // Ensure WebGL canvas is captured
          const clonedCanvas = clonedDoc.querySelector('canvas');
          const originalCanvas = document.querySelector('canvas');
          
          if (clonedCanvas && originalCanvas) {
            try {
              const ctx = clonedCanvas.getContext('2d');
              ctx.drawImage(originalCanvas, 0, 0);
            } catch (e) {
              console.warn('Could not copy canvas content:', e);
            }
          }
        }
      }).then(canvas => {
        const dataUrl = canvas.toDataURL('image/png');
        setImageUrl(dataUrl);
        setIsVisible(true);
        
        setTimeout(() => {
          setIsBlurred(false);
        }, 300);

        if (onComplete) {
          setTimeout(() => {
            onComplete(dataUrl);
          }, 2000);
        }
      }).catch(error => {
        console.error('Failed to capture DOM element:', error);
        // Try direct canvas capture as last resort
        const canvas = document.querySelector('canvas');
        if (canvas) {
          captureFromCanvas(canvas);
        }
      });
    });
  };

  // Capture the polaroid once when it becomes visible
  const capturePolaroid = async () => {
    if (!polaroidRef.current || polaroidImageUrl) return; // Skip if already captured
    
    try {
      const { default: html2canvas } = await import('html2canvas');
      
      // Hide buttons and shadow temporarily
      const closeBtn = polaroidRef.current.querySelector('button[aria-label="Close polaroid"]');
      const actionBtns = polaroidRef.current.querySelector(`.${styles.actionButtons}`);
      const shadow = polaroidRef.current.querySelector(`.${styles.polaroidShadow}`);
      
      if (closeBtn) closeBtn.style.visibility = 'hidden';
      if (actionBtns) actionBtns.style.visibility = 'hidden';
      if (shadow) shadow.style.visibility = 'hidden';
      
      // Capture the polaroid with extra padding for rotation
      const canvas = await html2canvas(polaroidRef.current, {
        backgroundColor: 'transparent',
        scale: 2, // High quality
        logging: false,
        useCORS: true,
        allowTaint: false,
        // Add extra padding to ensure the rotated element fits completely
        width: polaroidRef.current.offsetWidth + 150,
        height: polaroidRef.current.offsetHeight + 150,
        x: -75,
        y: -75
      });
      
      // Restore buttons and shadow
      if (closeBtn) closeBtn.style.visibility = '';
      if (actionBtns) actionBtns.style.visibility = '';
      if (shadow) shadow.style.visibility = '';
      
      // Store both data URL and blob for reuse
      const dataUrl = canvas.toDataURL('image/png');
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      
      setPolaroidImageUrl(dataUrl);
      setPolaroidBlob(blob);
    } catch (error) {
      console.error('Failed to capture polaroid:', error);
    }
  };
  
  // Capture polaroid when it's fully visible and deblurred
  useEffect(() => {
    if (isVisible && !isBlurred && polaroidRef.current && !polaroidImageUrl) {
      // Small delay to ensure animation is complete
      const timer = setTimeout(() => {
        capturePolaroid();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, isBlurred]);
  
  const handleClick = (e) => {
    // Don't close if clicking on action buttons
    if (e.target.closest('.action-button')) {
      return;
    }
    setIsVisible(false);
    setTimeout(() => {
      setImageUrl(null);
      setIsBlurred(true);
      setPolaroidImageUrl(null);
      setPolaroidBlob(null);
    }, 500);
  };

  const handleDownload = async () => {
    // Ensure polaroid is captured first
    if (!polaroidImageUrl) {
      await capturePolaroid();
    }
    
    // Use the cached polaroid image
    if (polaroidImageUrl) {
      const link = document.createElement('a');
      link.href = polaroidImageUrl;
      link.download = `polaroid-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Fallback to original image if capture failed
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `polaroid-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleShare = async (platform) => {
    // const shareText = `Check out my capture from RL80! ${label}`;
        const shareText = `Get Lit With RL80! 🔥`;
    const shareUrl = window.location.href;
    
    switch(platform) {
      case 'twitter':
        // Ensure polaroid is captured first
        if (!polaroidBlob) {
          await capturePolaroid();
        }
        
        // Use the cached polaroid blob
        try {
          if (polaroidBlob && navigator.clipboard && window.ClipboardItem) {
            const item = new ClipboardItem({ 'image/png': polaroidBlob });
            await navigator.clipboard.write([item]);
            
            // Show notification
            showNotification('Polaroid copied! You can paste it in your tweet 📋');
            
            // Open Twitter with text
            setTimeout(() => {
              window.open(
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
                '_blank',
                'width=550,height=420'
              );
            }, 1000);
          }
        } catch (err) {
          console.error('Failed to capture polaroid:', err);
          // Fallback: copy original image
          try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            if (navigator.clipboard && window.ClipboardItem) {
              const item = new ClipboardItem({ 'image/png': blob });
              await navigator.clipboard.write([item]);
              showNotification('Image copied! You can paste it in your tweet 📋');
            }
          } catch (fallbackErr) {
            console.error('Fallback also failed:', fallbackErr);
          }
          
          // Open Twitter anyway
          window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
            '_blank',
            'width=550,height=420'
          );
        }
        break;
        
      case 'copy':
        // Ensure polaroid is captured first
        if (!polaroidBlob) {
          await capturePolaroid();
        }
        
        // Use the cached polaroid blob
        try {
          if (polaroidBlob && navigator.clipboard && window.ClipboardItem) {
            const item = new ClipboardItem({ 'image/png': polaroidBlob });
            await navigator.clipboard.write([item]);
            showNotification('Polaroid copied to clipboard! 📋');
          }
        } catch (err) {
          console.error('Failed to copy polaroid:', err);
          // Fallback: copy original image
          try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            if (navigator.clipboard && window.ClipboardItem) {
              const item = new ClipboardItem({ 'image/png': blob });
              await navigator.clipboard.write([item]);
              showNotification('Image copied to clipboard! 📋');
            }
          } catch (fallbackErr) {
            // Final fallback: copy URL
            navigator.clipboard.writeText(shareUrl);
            showNotification('Link copied to clipboard!');
          }
        }
        break;
        
      case 'share':
        // Use Web Share API if available (mobile)
        if (navigator.share) {
          try {
            // Ensure polaroid is captured first
            if (!polaroidBlob) {
              await capturePolaroid();
            }
            
            // Use the cached polaroid blob or fallback to original
            const blob = polaroidBlob || await fetch(imageUrl).then(r => r.blob());
            const file = new File([blob], 'polaroid.png', { type: 'image/png' });
            
            await navigator.share({
              title: 'RL80 Capture',
              text: shareText,
              files: [file],
              url: shareUrl
            });
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.error('Share failed:', err);
              showNotification('Share cancelled or unavailable');
            }
          }
        } else {
          // Fallback for desktop: show share options
          showNotification('Use the copy button to share on Discord, Slack, etc.');
        }
        break;
    }
  };

  const showNotification = (message) => {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      z-index: 10000;
      animation: slideUp 0.3s ease;
    `;
    notification.textContent = message;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from { opacity: 0; transform: translate(-50%, 20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(notification);
        document.head.removeChild(style);
      }, 300);
    }, 3000);
  };

  if (!isVisible || !imageUrl) {
    // console.log('PolaroidSnapshot not showing:', { isVisible, hasImageUrl: !!imageUrl });
    return null;
  }

  // console.log('PolaroidSnapshot rendering with image');
  
  return (
    <div 
      className={`${styles.overlay} ${isVisible ? styles.visible : ''}`}
      onClick={handleClick}
    >
      <div 
        ref={polaroidRef}
        className={`${styles.polaroid} ${isVisible ? styles.dropped : ''}`}
      >
        {/* Close button */}
        <button
          className={styles.closeButton}
          onClick={handleClick}
          title="Close"
          aria-label="Close polaroid"
          style={{
            position: 'absolute',
            top: '-15px',
            right: '-15px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: '#ff4444',
            color: 'white',
            border: '3px solid white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 'bold',
            zIndex: 10,
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#ff6666';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#ff4444';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ✕
        </button>
        
        <div className={styles.polaroidInner}>
          <div className={styles.photoFrame}>
            <img 
              src={imageUrl} 
              alt="Snapshot"
              className={`${styles.photo} ${isBlurred ? styles.blurred : ''}`}
            />
          </div>
          <div className={styles.polaroidBottom}>
            <p className={styles.polaroidText}>{label}</p>
          </div>
          
          {/* Action Buttons */}
          <div className={styles.actionButtons}>
            <button 
              className={`${styles.actionButton} action-button`}
              onClick={handleDownload}
              title="Download"
              aria-label="Download polaroid"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            
            <button 
              className={`${styles.actionButton} action-button`}
              onClick={() => handleShare('copy')}
              title="Copy to clipboard"
              aria-label="Copy image to clipboard"
              data-action="copy"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            
            <button 
              className={`${styles.actionButton} action-button`}
              onClick={() => handleShare('twitter')}
              title="Share on X/Twitter"
              aria-label="Share on Twitter"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </button>
            
            <button 
              className={`${styles.actionButton} action-button`}
              onClick={() => handleShare('share')}
              title="Share"
              aria-label="Share via system"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
          </div>
        </div>
        <div className={styles.polaroidShadow} />
      </div>
    </div>
  );
};

export default PolaroidSnapshot;