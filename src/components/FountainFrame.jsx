import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

const FountainFrame = forwardRef(({ is80sMode = false, onFullyLoaded, onDonateClick }, ref) => {
  const iframeRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // iOS Safari caches the iframe document aggressively and there's no easy hard-
  // refresh on iOS, so a stale public/fountain.html keeps loading on phones/tablets.
  // In production, bump this ?v= when fountain.html changes. In development, use a
  // unique query per page load so every reload fetches the latest file (computed
  // once per mount so the iframe doesn't reload on every re-render).
  const [frameSrc] = useState(() => {
    const base =
      process.env.NODE_ENV === 'development'
        ? `/fountain.html?dev=${Date.now()}`
        : '/fountain.html?v=20260616';
    // Forward the dev light-tuning gate (/fountain?lights) into the iframe doc —
    // the inner HTML reads its own location.search, which otherwise only has dev/v.
    const onParent =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('lights');
    return onParent ? `${base}&lights` : base;
  });

  useImperativeHandle(ref, () => iframeRef.current);

  useEffect(() => {
    // Listen for messages from the iframe
    const handleMessage = (event) => {
      if (event.data?.type === 'fountainReady') {
        // console.log('Fountain fully loaded and ready');
        if (onFullyLoaded) {
          onFullyLoaded();
        }
      }
      // Handle donation trigger from iframe
      if (event.data?.type === 'openDonation') {
        if (onDonateClick) {
          onDonateClick(event.data?.charity || null);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onFullyLoaded, onDonateClick]);

  useEffect(() => {
    // Send 80s mode state to iframe when it changes
    if (iframeRef.current && isLoaded) {
      try {
        iframeRef.current.contentWindow.postMessage(
          { type: '80sMode', value: is80sMode },
          '*'
        );
      } catch (e) {
        // console.log('Could not send message to iframe:', e);
      }
    }
  }, [is80sMode, isLoaded]);

  const handleIframeLoad = () => {
    setIsLoaded(true);
    // console.log('Fountain iframe loaded');
    
    // Send current 80s mode state to iframe after it loads
    if (iframeRef.current && is80sMode) {
      setTimeout(() => {
        try {
          iframeRef.current.contentWindow.postMessage(
            { type: '80sMode', value: is80sMode },
            '*'
          );
        } catch (e) {
        }
      }, 100); // Small delay to ensure iframe is fully initialized
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      zIndex: 1
    }}>
      <iframe
        ref={iframeRef}
        src={frameSrc}
        onLoad={handleIframeLoad}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          overflow: 'hidden'
        }}
        title="Interactive Fountain"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
});

FountainFrame.displayName = 'FountainFrame';
export default FountainFrame;