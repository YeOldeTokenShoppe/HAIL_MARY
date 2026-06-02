'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './PolaroidSnapshot.module.css';

const PolaroidSnapshot = ({
  trigger = false,
  onComplete,
  captureElementId = 'canvas',
  label = 'Victory!',
  backgroundImage = null,
  referralOverlay = null, // { code, link } — overlaid on polaroid bottom
}) => {
  const instanceId = React.useRef(Math.random().toString(36).substring(7));
  React.useEffect(() => {
    // Warm the watermark fonts so they're cached before a snapshot is captured.
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.load("bold 32px 'Manufacturing Consent'").catch(() => {});
      document.fonts.load("bold 14px 'Orbitron'").catch(() => {});
    }
  }, []);
  React.useEffect(() => {
  }, [backgroundImage]);
  const [isVisible, setIsVisible] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [compositedImageUrl, setCompositedImageUrl] = useState(null); // Store the composited version separately
  const [isBlurred, setIsBlurred] = useState(true);
  const [polaroidImageUrl, setPolaroidImageUrl] = useState(null); // Cached polaroid capture
  const [polaroidBlob, setPolaroidBlob] = useState(null); // Cached polaroid blob
  const [caption, setCaption] = useState(label);
  const captionRef = useRef(null);
  const polaroidRef = useRef(null);

  useEffect(() => {
    if (trigger) {
      setCaption(label);
      captureSnapshot();
    }
  }, [trigger]);

  // Draw the "Hail Mary Prospecting Co." logo watermark (two lines, stacked in corner).
  // Custom fonts must be loaded before canvas fillText, or it silently falls back to plain sans-serif.
  const drawWatermark = async (ctx) => {
    // Make sure the custom fonts are loaded before drawing, but NEVER let a slow
    // or missing font block the snapshot. Orbitron's bold weight comes from the
    // Google Fonts link and its local face is font-display:block, so an un-raced
    // await here can hang forever and the watermark never gets drawn at all.
    try {
      const fontsReady = Promise.allSettled([
        document.fonts.load("bold 32px 'Manufacturing Consent'"),
        document.fonts.load("bold 14px 'Orbitron'"),
      ]);
      const timeout = new Promise((resolve) => setTimeout(resolve, 800));
      await Promise.race([fontsReady, timeout]);
    } catch (e) {
      // If font loading fails, fall through and draw with whatever is available
    }

    // Anchor to the centered square the polaroid actually shows. The photo frame
    // is 1:1 with object-fit:cover, so it center-crops the canvas — fixed corner
    // coordinates get cropped off (left/right on a wide canvas, top/bottom on a
    // tall one), which is why the watermark vanished. Position + scale relative to
    // the visible square so it survives any aspect ratio.
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const square = Math.min(w, h);
    const offX = (w - square) / 2;
    const offY = (h - square) / 2;
    const big = Math.max(18, Math.round(square * 0.075));
    const small = Math.max(9, Math.round(square * 0.032));
    const pad = Math.round(square * 0.05);
    const cx = offX + square / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(202, 156, 4, 0.85)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.font = `bold ${big}px 'Manufacturing Consent', -apple-system, sans-serif`;
    ctx.fillText('Hail Mary', cx, offY + pad + big);
    ctx.font = `bold ${small}px 'Orbitron', -apple-system, sans-serif`;
    ctx.fillText('Prospecting Co.', cx, offY + pad + big + small + Math.round(square * 0.012));
    ctx.restore();
  };

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
          // List all canvases for debugging
          const allCanvases = document.querySelectorAll('canvas');
          allCanvases.forEach((c, i) => {
          });
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
        willReadFrequently: true,
        alpha: true
      });

      // Don't try to get WebGL context - it will conflict with React Three Fiber's existing context
      // Just note that we're working with a WebGL canvas
      
      // If we have a background image, draw it first
      if (backgroundImage) {
        const bgImg = new Image();
        bgImg.crossOrigin = 'anonymous'; // Allow CORS for image loading
        bgImg.onload = async () => {
          
          // First, capture the character from the canvas
          const characterCanvas = document.createElement('canvas');
          characterCanvas.width = canvas.width;
          characterCanvas.height = canvas.height;
          const characterCtx = characterCanvas.getContext('2d', { alpha: true });
          
          // Draw the WebGL canvas to extract character
          characterCtx.drawImage(canvas, 0, 0);
          
          // Get image data to process pixels
          const imageData = characterCtx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Process pixels: make dark pixels and shadow artifacts transparent
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const alpha = data[i + 3];
            
            // Calculate luminance for better shadow detection
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
            
            // Remove dark pixels, shadows, and low-contrast artifacts
            if (luminance < 25 || (r < 30 && g < 30 && b < 30)) {
              data[i + 3] = 0; // Set alpha to 0 (transparent)
            }
            // Also remove pixels that are very close to the background color (soft shadows)
            else if (Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10 && luminance < 50) {
              data[i + 3] = 0; // Remove grayish shadow artifacts
            }
          }
          
          // Put the processed image back
          characterCtx.putImageData(imageData, 0, 0);
          
          // Now composite: background first, then character
          tempCtx.clearRect(0, 0, canvas.width, canvas.height);
          tempCtx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
          tempCtx.drawImage(characterCanvas, 0, 0);
          
          await drawWatermark(tempCtx);

          const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.6);
          if (dataUrl) {
            setImageUrl(dataUrl);
            setCompositedImageUrl(dataUrl);
            setIsVisible(true);
            setTimeout(() => { setIsBlurred(false); }, 300);
          }
        };
        bgImg.onerror = (err) => {
          console.error('[PolaroidSnapshot] Failed to load background:', err);
          // Fallback: draw without background
          tempCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
          const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.6);
          
          if (dataUrl) {
            setImageUrl(dataUrl);
            setIsVisible(true);
            setTimeout(() => {
              setIsBlurred(false);
            }, 300);
          }
        };
        bgImg.src = backgroundImage;
      } else {
        // No background image, just draw the canvas
        tempCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height);

        (async () => {
          await drawWatermark(tempCtx);

          const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.6);
          if (dataUrl) {
            setImageUrl(dataUrl);
            setIsVisible(true);
            setTimeout(() => { setIsBlurred(false); }, 300);
          } else {
            console.warn('Canvas capture was empty, trying alternate method');
            captureWithDelay();
          }
        })();
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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      
      // Check if we got a valid image (not just transparent/black)
      if (dataUrl && dataUrl.length > 100) {
        setImageUrl(dataUrl);
        setIsVisible(true);
        
        setTimeout(() => {
          setIsBlurred(false);
        }, 300);

        // Don't call onComplete here - let the polaroid capture handle it
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setImageUrl(dataUrl);
        setIsVisible(true);
        
        setTimeout(() => {
          setIsBlurred(false);
        }, 300);

        // Don't call onComplete here - let the polaroid capture handle it
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
    if (!polaroidRef.current || polaroidImageUrl) return polaroidImageUrl; // Return existing if already captured
    
    try {
      const { default: html2canvas } = await import('html2canvas');
      
      // Hide buttons and shadow temporarily
      const closeBtn = polaroidRef.current.querySelector('button[aria-label="Close polaroid"]');
      const actionBtns = polaroidRef.current.querySelector(`.${styles.actionButtons}`);
      const shadow = polaroidRef.current.querySelector(`.${styles.polaroidShadow}`);
      
      if (closeBtn) closeBtn.style.visibility = 'hidden';
      if (actionBtns) actionBtns.style.visibility = 'hidden';
      if (shadow) shadow.style.visibility = 'hidden';
      
      // Create a temporary container with transparent background
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: ${polaroidRef.current.offsetWidth + 200}px;
        height: ${polaroidRef.current.offsetHeight + 200}px;
        background: transparent;
        z-index: -1;
        visibility: hidden;
      `;
      document.body.appendChild(tempContainer);
      
      // Clone the polaroid element for capture
      const clonedPolaroid = polaroidRef.current.cloneNode(true);
      clonedPolaroid.style.position = 'relative';
      clonedPolaroid.style.margin = '100px';
      
      // Make sure the cloned image has the current composited imageUrl
      const clonedImg = clonedPolaroid.querySelector('img');
      if (clonedImg) {
        // Use the composited image if we have it, otherwise use the regular image
        const srcToUse = compositedImageUrl || imageUrl;
        clonedImg.src = srcToUse;
        
        // Wait for the image to actually load
        await new Promise((resolve) => {
          if (clonedImg.complete) {
            resolve();
          } else {
            clonedImg.onload = resolve;
            clonedImg.onerror = resolve; // Resolve even on error to avoid hanging
          }
        });
      }
      
      tempContainer.appendChild(clonedPolaroid);
      tempContainer.style.visibility = 'visible';
      
      // Small delay to ensure rendering
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Capture the cloned element with transparent background
      const canvas = await html2canvas(clonedPolaroid, {
        backgroundColor: null, // Transparent background
        scale: 2, // High quality
        logging: false,
        useCORS: true,
        allowTaint: true, // Allow tainted canvas since we're using data URLs
        width: clonedPolaroid.offsetWidth + 150,
        height: clonedPolaroid.offsetHeight + 150,
        x: -75,
        y: -75
      });
      
      // Remove temporary container
      document.body.removeChild(tempContainer);
      
      // Restore buttons and shadow
      if (closeBtn) closeBtn.style.visibility = '';
      if (actionBtns) actionBtns.style.visibility = '';
      if (shadow) shadow.style.visibility = '';
      
      // Store both data URL and blob for reuse - using WebP for transparency and better compression
      const dataUrl = canvas.toDataURL('image/webp', 0.9);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
      
      setPolaroidImageUrl(dataUrl);
      setPolaroidBlob(blob);
      
      // Return the data URL so it can be used immediately
      return dataUrl;
    } catch (error) {
      console.error('Failed to capture polaroid:', error);
      return null;
    }
  };
  
  // Track if we've called onComplete
  const hasCalledOnCompleteRef = useRef(false);
  
  // Capture polaroid when it's fully visible and deblurred
  useEffect(() => {
    // For backgrounds, wait for compositedImageUrl; otherwise use imageUrl
    const requiredImage = backgroundImage ? compositedImageUrl : imageUrl;
    
    
    if (isVisible && !isBlurred && polaroidRef.current && !hasCalledOnCompleteRef.current && requiredImage) {
      // Wait longer to ensure the composited image is ready
      const timer = setTimeout(async () => {
        
        // ONLY capture and call onComplete if we have the right image
        if (backgroundImage && !compositedImageUrl) {
          return; // Don't capture yet
        }
        
        const capturedUrl = await capturePolaroid();
        
        // Pass the complete polaroid to onComplete after it's captured
        if (onComplete && capturedUrl && !hasCalledOnCompleteRef.current) {
          hasCalledOnCompleteRef.current = true; // Mark as called
          onComplete(capturedUrl);
        } else {
        }
      }, 1500); // Increased delay to ensure background is fully composited
      return () => clearTimeout(timer);
    }
  }, [isVisible, isBlurred]); // Reduce dependencies to prevent re-triggers
  
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
    // Ensure polaroid is captured first and get the URL
    const capturedUrl = await capturePolaroid();
    
    // Use the captured polaroid image
    if (capturedUrl) {
      const link = document.createElement('a');
      link.href = capturedUrl;
      link.download = `polaroid-${Date.now()}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Fallback to original image if capture failed
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `polaroid-${Date.now()}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleShare = async (platform) => {
    const refSuffix = referralOverlay?.code ? `?ref=${referralOverlay.code}` : '';
    const shareText = referralOverlay?.code
      ? `Check out my rig! Join me on the grid 🤑`
      : `Check out my rig! 🤑`;
    const shareUrl = `https://rl80.com/oil${refSuffix}`;
    
    switch(platform) {
      case 'twitter':
        // Ensure polaroid is captured first
        const capturedUrl = polaroidImageUrl || await capturePolaroid();
        const imgSrc = capturedUrl || imageUrl;

        // Copy image to clipboard as PNG so user can paste into tweet
        let clipboardOk = false;
        try {
          showNotification('Copying image...');
          const img = new Image();
          img.src = imgSrc;
          await new Promise(r => { img.onload = r; img.onerror = r; });
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          c.getContext('2d').drawImage(img, 0, 0);
          const pngBlob = await new Promise(r => c.toBlob(r, 'image/png'));
          if (pngBlob && navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
            clipboardOk = true;
          }
        } catch (clipErr) {
          console.error('Clipboard copy failed:', clipErr);
        }

        if (clipboardOk) {
          // Show persistent paste instruction, then open Twitter after a short delay
          showNotification('Image copied! Press Cmd+V (or Ctrl+V) to paste it into your tweet');
          await new Promise(r => setTimeout(r, 1500));
        }

        // Open Twitter compose — no URL in text, user pastes image directly
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
          '_blank',
          'width=550,height=420'
        );
        break;
        
      case 'copy':
        // Ensure polaroid is captured first
        if (!polaroidBlob) {
          await capturePolaroid();
        }
        
        // Use the cached polaroid blob
        try {
          if (polaroidBlob && navigator.clipboard && window.ClipboardItem) {
            const item = new ClipboardItem({ 'image/webp': polaroidBlob });
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
              const item = new ClipboardItem({ 'image/webp': blob });
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
            const file = new File([blob], 'polaroid.webp', { type: 'image/webp' });
            
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
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 16px 28px;
      border-radius: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 16px;
      font-weight: 600;
      z-index: 999999;
      animation: slideUp 0.3s ease;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
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
    return null;
  }

  
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
          <div className={styles.polaroidBottom} onClick={(e) => e.stopPropagation()}>
            <p
              ref={captionRef}
              className={styles.polaroidText}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const text = e.currentTarget.textContent.trim();
                setCaption(text || label);
                // Invalidate cached polaroid so next share/download re-captures with new caption
                setPolaroidImageUrl(null);
                setPolaroidBlob(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
              }}
              style={{ cursor: 'text', outline: 'none' }}
            >
              {caption}
            </p>
            {referralOverlay && (
              <div style={{
                marginTop: 6,
                padding: '4px 8px',
                background: 'rgba(0,0,0,0.06)',
                borderRadius: 3,
                textAlign: 'center',
                fontFamily: "'Share Tech Mono', monospace",
              }}>
                <div style={{ fontSize: 8, letterSpacing: '0.2em', color: '#666', marginBottom: 2 }}>
                  JOIN ME ON THE GRID
                </div>
                <div style={{ fontSize: 10, color: '#333', fontWeight: 700, letterSpacing: '0.05em' }}>
                  {referralOverlay.link || `rl80.xyz/oil?ref=${referralOverlay.code}`}
                </div>
              </div>
            )}
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
        {/* <div className={styles.polaroidShadow} /> */}
      </div>
    </div>
  );
};

export default PolaroidSnapshot;