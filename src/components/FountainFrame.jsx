import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

const FountainFrame = forwardRef(({ is80sMode = false, onFullyLoaded }, ref) => {
  const iframeRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
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
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onFullyLoaded]);

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
          console.log('Sent 80s mode state to iframe after load:', is80sMode);
        } catch (e) {
          console.log('Could not send initial message to iframe:', e);
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
        src="/fountain.html"
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