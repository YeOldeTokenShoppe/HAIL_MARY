
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { storage } from "@/utilities/firebaseClient";
import { ref as storageRefUtil, getDownloadURL } from "firebase/storage";
import globalAudioManager from "@/utilities/globalAudio";

// Create the music context
export const MusicContext = createContext();

// Custom hook to use the music context
export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};

// Track lists
const non80sTracks = [
  { name: "Lifetimes", path: "audio/192k/07-lifetimes.m4a", bpm: 135 },
  { name: "Magnetic - Tunde Adebimpe", path: "audio/320k/01-magnetic.m4a", bpm: 130 },
  { name: "Rocket Man - Steven Drozd", path: "audio/320k/rocket-man---steven-drozd.m4a", bpm: 45 }
];

const eightyTracks = [
  { name: "For Those About To Rock - AC/DC", path: "audio/320k/for-those-about-to-rock-ac-dc.m4a", bpm: 75 },
  { name: "Dirty Cash - The Adventures of Stevie V", path: "audio/320k/dirty-cash.m4a", bpm: 100 },
  { name: "Intergalactic - Beastie Boys", path: "audio/320k/intergalactic-beastie-boys.m4a", bpm: 108 },
  { name: "Good Life - Inner City", path: "audio/320k/good-life-inner-city.m4a", bpm: 120 },
  { name: "Like A Prayer - Madonna", path: "audio/320k/like-a-prayer-madonna.m4a", bpm: 85 },
  { name: "99 Luftballoons - Nena", path: "audio/320k/99-luftballoons-nena.m4a", bpm: 85 },
  { name: "Sweet Dreams - Eurythmics", path: "audio/320k/sweet-dreams-eurythmics.m4a", bpm: 85 }
];

// Music Provider component
export const MusicProvider = ({ children }) => {
  const [showSpotify, setShowSpotify] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.2);
  const [trackProgress, setTrackProgress] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [is80sMode, setIs80sMode] = useState(false);
  const [currentTrackUrl, setCurrentTrackUrl] = useState('');
  const [currentTrackPath, setCurrentTrackPath] = useState(''); // Add path tracking
  const [currentTrackBPM, setCurrentTrackBPM] = useState(100); // Add BPM tracking
  const [currentTrackShader, setCurrentTrackShader] = useState(null); // Add shader tracking
  const audioRef = React.useRef(globalAudioManager?.getAudio());
  const [audioElement, setAudioElement] = useState(globalAudioManager?.getAudio());
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [isShuffled, setIsShuffled] = useState(true); // Default to shuffled
  const [shuffleHistory, setShuffleHistory] = useState([]);
  const [shuffleQueue, setShuffleQueue] = useState([]);
  
  // Use refs to track current values for event handlers
  const currentTrackIndexRef = React.useRef(0);
  const is80sModeRef = React.useRef(false);
  const loadTrackRef = React.useRef(null);
  
  // Update refs when values change
  React.useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);
  
  React.useEffect(() => {
    is80sModeRef.current = is80sMode;
  }, [is80sMode]);
  
  
  // Load and play track function
  const loadTrack = useCallback(async (index, shouldAutoPlay = false) => {
    console.log('[MusicContext] loadTrack called:', { index, shouldAutoPlay, is80sMode });
    const playlist = is80sMode ? eightyTracks : non80sTracks;
    
    if (index < 0 || index >= playlist.length) {
      console.log('[MusicContext] Invalid track index:', index);
      return;
    }
    
    console.log('[MusicContext] Loading track:', playlist[index].name);
    setIsLoadingTrack(true);
    
    try {
      const trackRef = storageRefUtil(storage, playlist[index].path);
      const url = await getDownloadURL(trackRef);
      
      if (audioRef.current) {
        // Clear any existing source first
        audioRef.current.pause();
        audioRef.current.src = '';
        
        // Set new source
        audioRef.current.src = url;
        audioRef.current.load();
        
        await new Promise((resolve, reject) => {
          const handleCanPlay = () => {
            console.log('[MusicContext] Track can play through');
            audioRef.current.removeEventListener('canplaythrough', handleCanPlay);
            audioRef.current.removeEventListener('error', handleError);
            resolve();
          };
          const handleError = (e) => {
            console.error('[MusicContext] Error loading track:', e);
            audioRef.current.removeEventListener('canplaythrough', handleCanPlay);
            audioRef.current.removeEventListener('error', handleError);
            reject(e);
          };
          audioRef.current.addEventListener('canplaythrough', handleCanPlay);
          audioRef.current.addEventListener('error', handleError);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            audioRef.current.removeEventListener('canplaythrough', handleCanPlay);
            audioRef.current.removeEventListener('error', handleError);
            resolve();
          }, 10000);
        });
        
        setCurrentTrackIndex(index);
        setCurrentTrackBPM(playlist[index].bpm || 100);
        setCurrentTrack(playlist[index]);
        setIsLoadingTrack(false);
        
        // Save state to global manager
        if (globalAudioManager) {
          globalAudioManager.setState({
            currentTrackIndex: index,
            is80sMode: is80sMode,
            currentTrack: playlist[index],
            isShuffled: isShuffled
          });
        }
        
        if (shouldAutoPlay) {
          console.log('[MusicContext] Auto-playing track');
          audioRef.current.play().then(() => {
            console.log('[MusicContext] Playback started successfully');
            setIsPlaying(true);
          }).catch(e => {
            console.log('[MusicContext] Auto-play blocked:', e);
            setIsPlaying(false);
          });
        }
      }
    } catch (error) {
      console.error('[MusicContext] Error loading track:', error);
      setIsLoadingTrack(false);
      setIsPlaying(false);
    }
  }, [is80sMode, setCurrentTrackBPM]);
  
  // Update loadTrackRef when loadTrack changes
  React.useEffect(() => {
    loadTrackRef.current = loadTrack;
  }, [loadTrack]);
  
  // Play/Pause functions
  const play = useCallback(() => {
    if (audioRef.current) {
      // If no track loaded, load a random track if shuffled
      if (!audioRef.current.src) {
        const playlist = is80sMode ? eightyTracks : non80sTracks;
        let startIndex = 0;
        
        if (isShuffled && playlist.length > 0) {
          // Start with a random track
          startIndex = Math.floor(Math.random() * playlist.length);
          console.log('[MusicContext] Starting with random track:', startIndex);
        }
        
        loadTrack(startIndex, true);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(e => console.log('Play blocked:', e));
      }
    }
  }, [loadTrack, is80sMode, isShuffled]);
  
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);
  
  // Get random track index that hasn't been played recently
  const getRandomTrackIndex = useCallback((playlist) => {
    // If we've played all tracks, reset history
    if (shuffleHistory.length >= playlist.length - 1) {
      setShuffleHistory([currentTrackIndex]);
      // Get a random track that's not the current one
      const availableIndices = playlist.map((_, i) => i).filter(i => i !== currentTrackIndex);
      return availableIndices[Math.floor(Math.random() * availableIndices.length)];
    }
    
    // Get indices we haven't played yet (or haven't played recently)
    const availableIndices = playlist.map((_, i) => i).filter(i => 
      i !== currentTrackIndex && !shuffleHistory.includes(i)
    );
    
    if (availableIndices.length === 0) {
      // Fallback: if somehow all tracks are in history, just pick any track except current
      const allIndices = playlist.map((_, i) => i).filter(i => i !== currentTrackIndex);
      return allIndices[Math.floor(Math.random() * allIndices.length)];
    }
    
    return availableIndices[Math.floor(Math.random() * availableIndices.length)];
  }, [currentTrackIndex, shuffleHistory]);

  // Next track function
  const nextTrack = useCallback(() => {
    console.log('[MusicContext] nextTrack called');
    console.log('[MusicContext] Current is80sMode:', is80sMode);
    console.log('[MusicContext] Current track index:', currentTrackIndex);
    console.log('[MusicContext] Is shuffled:', isShuffled);
    const playlist = is80sMode ? eightyTracks : non80sTracks;
    console.log('[MusicContext] Using playlist:', playlist);
    
    let nextIndex;
    if (isShuffled) {
      nextIndex = getRandomTrackIndex(playlist);
      // Update shuffle history
      const newHistory = [...shuffleHistory, currentTrackIndex];
      setShuffleHistory(newHistory);
      if (globalAudioManager) {
        globalAudioManager.setState({ shuffleHistory: newHistory });
      }
      console.log('[MusicContext] Random next index:', nextIndex);
    } else {
      nextIndex = (currentTrackIndex + 1) % playlist.length;
      console.log('[MusicContext] Sequential next index:', nextIndex);
    }
    
    const wasPlaying = audioRef.current && !audioRef.current.paused;
    console.log('[MusicContext] Was playing:', wasPlaying);
    loadTrack(nextIndex, wasPlaying);
  }, [currentTrackIndex, is80sMode, isShuffled, shuffleHistory, getRandomTrackIndex, loadTrack]);
  
  // Previous track function
  const prevTrack = useCallback(() => {
    const playlist = is80sMode ? eightyTracks : non80sTracks;
    let prevIndex;
    
    if (isShuffled && shuffleHistory.length > 0) {
      // Go back in shuffle history
      prevIndex = shuffleHistory[shuffleHistory.length - 1];
      const newHistory = shuffleHistory.slice(0, -1);
      setShuffleHistory(newHistory);
      if (globalAudioManager) {
        globalAudioManager.setState({ shuffleHistory: newHistory });
      }
    } else {
      prevIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    }
    
    const wasPlaying = audioRef.current && !audioRef.current.paused;
    loadTrack(prevIndex, wasPlaying);
  }, [currentTrackIndex, is80sMode, isShuffled, shuffleHistory, loadTrack]);
  
  
  // Initialize audio element and restore state on mount
  useEffect(() => {
    if (!globalAudioManager) return;
    
    const audio = globalAudioManager.getAudio();
    audioRef.current = audio;
    setAudioElement(audio);
    
    // Restore state from global manager
    const savedState = globalAudioManager.getState();
    
    if (savedState.src) {
      // Restore all state
      setCurrentTrackIndex(savedState.currentTrackIndex);
      setIs80sMode(savedState.is80sMode);
      setCurrentTrack(savedState.currentTrack);
      setIsPlaying(savedState.isPlaying);
      setIsShuffled(savedState.isShuffled !== undefined ? savedState.isShuffled : true);
      setShuffleHistory(savedState.shuffleHistory || []);
      setShuffleQueue(savedState.shuffleQueue || []);
      
      if (savedState.currentTrack) {
        setCurrentTrackBPM(savedState.currentTrack.bpm || 100);
      }
      
      console.log('[MusicContext] Restored state:', savedState);
    }
    
    // Add ended event listener that uses refs for current values
    const handleEnded = () => {
      console.log('[MusicContext] Track ended, advancing to next track (shuffled)');
      
      // Set playing to false first to stop animation
      setIsPlaying(false);
      
      // For auto-advance, always play the next track
      const playlist = is80sModeRef.current ? eightyTracks : non80sTracks;
      const savedState = globalAudioManager?.getState();
      const shuffled = savedState?.isShuffled !== undefined ? savedState.isShuffled : true;
      
      if (shuffled) {
        // Get a random next track
        const currentIdx = currentTrackIndexRef.current;
        const availableIndices = playlist.map((_, i) => i).filter(i => i !== currentIdx);
        const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        
        console.log('[MusicContext] Random next index:', nextIndex);
        setTimeout(() => {
          if (loadTrackRef.current) {
            loadTrackRef.current(nextIndex, true);
          }
        }, 100);
      } else {
        // Sequential playback
        const nextIndex = (currentTrackIndexRef.current + 1) % playlist.length;
        console.log('[MusicContext] Sequential next index:', nextIndex);
        setTimeout(() => {
          if (loadTrackRef.current) {
            loadTrackRef.current(nextIndex, true);
          }
        }, 100);
      }
    };
    
    audio.onended = handleEnded;
    
    return () => {
      // Don't clear the audio on unmount - keep it playing
      audio.onended = null;
    };
  }, []);

  // Handle 80s mode change - reload track from new playlist
  useEffect(() => {
    // console.log('[MusicContext] 80s mode changed to:', is80sMode);
    
    // Save mode change to global manager
    if (globalAudioManager) {
      globalAudioManager.setState({ is80sMode });
    }
    
    // If we have a track playing or paused, reload from the new playlist
    if (audioRef.current && audioRef.current.src) {
      const wasPlaying = !audioRef.current.paused;
      console.log('[MusicContext] Switching playlist, was playing:', wasPlaying);
      
      // Get the playlist for the new mode
      const playlist = is80sMode ? eightyTracks : non80sTracks;
      
      // Choose a random track if shuffled, otherwise start at 0
      let newTrackIndex = 0;
      if (isShuffled && playlist.length > 0) {
        newTrackIndex = Math.floor(Math.random() * playlist.length);
        console.log('[MusicContext] Starting with random track in new playlist:', newTrackIndex);
        // Reset shuffle history for the new playlist
        setShuffleHistory([]);
        if (globalAudioManager) {
          globalAudioManager.setState({ shuffleHistory: [] });
        }
      }
      
      setCurrentTrackIndex(newTrackIndex);
      loadTrack(newTrackIndex, wasPlaying);
    }
  }, [is80sMode, isShuffled, loadTrack]);
  
  // Update volume when it changes
  useEffect(() => {
    if (globalAudioManager) {
      const audio = globalAudioManager.getAudio();
      if (audio) {
        audio.volume = volume;
      }
    }
  }, [volume]);
  
  // Removed restoration logic - now handled by MusicManager component
  

  const value = {
    showSpotify,
    setShowSpotify,
    currentTrack,
    setCurrentTrack,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    trackProgress,
    setTrackProgress,
    currentTrackIndex,
    setCurrentTrackIndex,
    is80sMode,
    setIs80sMode,
    currentTrackUrl,
    setCurrentTrackUrl,
    currentTrackPath,
    setCurrentTrackPath,
    currentTrackBPM,
    setCurrentTrackBPM,
    currentTrackShader,
    setCurrentTrackShader,
    audioElement: audioRef.current,
    audioRef,
    // New methods for direct control
    loadTrack,
    play,
    pause,
    nextTrack,
    prevTrack,
    isLoadingTrack,
    non80sTracks,
    eightyTracks,
    isShuffled,
    setIsShuffled: (shuffled) => {
      setIsShuffled(shuffled);
      if (globalAudioManager) {
        globalAudioManager.setState({ isShuffled: shuffled });
      }
      // Reset shuffle history when toggling shuffle
      if (shuffled) {
        setShuffleHistory([currentTrackIndex]);
        if (globalAudioManager) {
          globalAudioManager.setState({ shuffleHistory: [currentTrackIndex] });
        }
      }
    },
  };
  
  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
};