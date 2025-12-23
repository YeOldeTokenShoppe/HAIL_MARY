import { useRef, useCallback, useEffect } from 'react';

export const useAudio = () => {
  const audioRefs = useRef({});
  const audioContext = useRef(null);
  
  // Initialize audio context for tablets
  useEffect(() => {
    const initAudio = async () => {
      try {
        // Try to create AudioContext for better tablet support
        if ('AudioContext' in window || 'webkitAudioContext' in window) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          audioContext.current = new AudioContextClass();
          
          // Handle audio context state changes for tablets
          const handleInteraction = () => {
            if (audioContext.current && audioContext.current.state === 'suspended') {
              audioContext.current.resume().then(() => {
                console.log('Audio context resumed for tablet');
              });
            }
          };
          
          // Listen for user interactions to resume audio context on tablets
          ['touchstart', 'touchend', 'mousedown', 'keydown'].forEach(event => {
            document.addEventListener(event, handleInteraction, { once: true });
          });
        }
      } catch (error) {
        console.warn('AudioContext initialization failed:', error);
      }
    };
    
    initAudio();
  }, []);

  const loadSound = useCallback((soundId, soundPath) => {
    try {
      if (!audioRefs.current[soundId]) {
        const audio = new Audio(soundPath);
        audio.preload = 'auto';
        
        // Add event listeners for tablet debugging
        audio.addEventListener('canplaythrough', () => {
          console.log(`Audio ready: ${soundId}`);
        });
        
        audio.addEventListener('error', (e) => {
          console.error(`Audio load error for ${soundId}:`, e);
        });
        
        audioRefs.current[soundId] = audio;
        console.log(`Audio loaded: ${soundId} from ${soundPath}`);
      }
    } catch (error) {
      console.warn('Audio load error:', error);
    }
  }, []);

  const playSound = useCallback((soundIdOrPath, options = {}) => {
    try {
      let audio;
      
      // If it's a sound ID that was preloaded
      if (audioRefs.current[soundIdOrPath]) {
        audio = audioRefs.current[soundIdOrPath];
      } else {
        // Otherwise create a new audio instance
        audio = new Audio(soundIdOrPath);
        audioRefs.current[soundIdOrPath] = audio;
      }
      
      // Set volume - ensure it's set before playing for tablet compatibility
      audio.volume = typeof options.volume === 'number' ? options.volume : (typeof options === 'number' ? options : 0.5);
      audio.currentTime = 0;
      
      if (options.loop) {
        audio.loop = true;
      } else {
        audio.loop = false; // Explicitly disable loop for tablets
      }
      
      // Enhanced tablet audio support with user gesture detection
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Audio played successfully
            console.log(`Audio played: ${soundIdOrPath}`);
          })
          .catch(e => {
            // Audio play failed - common on tablets without user interaction
            if (e.name === 'NotAllowedError') {
              console.warn('Audio blocked - user interaction required:', e);
            } else {
              console.warn('Audio play failed:', e);
            }
          });
      }
    } catch (error) {
      console.warn('Audio error:', error);
    }
  }, []);

  const stopSound = useCallback((soundIdOrPath) => {
    try {
      let audio;
      
      if (audioRefs.current[soundIdOrPath]) {
        audio = audioRefs.current[soundIdOrPath];
      } else {
        audio = audioRefs.current[soundIdOrPath];
      }
      
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    } catch (error) {
      console.warn('Audio stop error:', error);
    }
  }, []);

  return { loadSound, playSound, stopSound };
};