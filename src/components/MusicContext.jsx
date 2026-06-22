
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { storage } from "@/lib/firebaseClient";
import { ref as storageRefUtil, getDownloadURL } from "firebase/storage";
import globalAudioManager from "@/lib/globalAudio";

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

// Track lists, sorted by actual release era.
//
// `eightyTracks` is the brand's headline playlist: genuine 1980s material.
// `non80sTracks` is the "NOW"/modern bucket — anything post-1989. It's
// deliberately the small list right now; ADD MORE MODERN TRACKS HERE to make
// the era toggle feel balanced (the music era switch on MusicButton flips
// between these two). Both are exposed via `allTracks` for any page that needs
// to resolve a curated subset by path (e.g. the fountain override) without
// caring which era bucket a song lives in.
const eightyTracks = [
  { name: "Walking in L.A. - Missing Persons", path: "audio/walking_in_LA.m4a", bpm: 85 },
  { name: "Paradise City - GnR", path: "audio/06 Paradise City.mp3", bpm: 140 },
  { name: "For Those About To Rock - AC/DC", path: "audio/for-those-about-to-rock-ac-dc.m4a", bpm: 75 },
  { name: "Sweet Dreams - Eurythmics", path: "audio/Sweet Dreams Eurythmics.m4a", bpm: 85 },
  { name: "Every Little Thing She Does (Is Magic) - The Police", path: "audio/EveryLittleThing.mp3", bpm: 85 },
  { name: "Like A Prayer - Madonna", path: "audio/like-a-prayer-madonna.m4a", bpm: 85 },
  { name: "Cat People (Putting Out Fire) - David Bowie", path: "/audio/Cat People (Putting Out Fire).mp3", bpm: 100 },
  { name: "Eyes Without A Face - Billy Idol", path: "/audio/Eyes Without A Face.mp3", bpm: 110 },
  { name: "I Ran (So Far Away) - Flock of Seagulls", path: "/audio/I Ran (So Far Away).mp3", bpm: 100 },
  // { name: "Girls On Film - Duran Duran", path: "/audio/Girls On Film.mp3", bpm: 100 },
  { name: "Cities - Siouxsie & The Banshees", path: "/audio/Cities.mp3", bpm: 100 },
  { name: "99 Luftballoons - Nena", path: "audio/99RedBalloons.mp3", bpm: 85 },
  { name: "Personal Jesus - Depeche Mode", path: "audio/PersonalJesus.m4a", bpm: 85 },
  { name: "Twilight Zone - Golden Earring", path: "audio/TwilightZone.m4a", bpm: 85 },
  { name: "She's Crafty - Beastie Boys", path: "audio/ShesCrafty.m4a", bpm: 85 },
  { name: "Ah Leah! Donnie Iris", path: "audio/AhLeah.m4a", bpm: 85 },
  { name: "Love My Way - Psychedelic Furs", path: "audio/LoveMyWay.m4a", bpm: 85 },
  { name: "Love Is A Stranger - Eurythmics", path: "audio/LoveIsAStranger.m4a", bpm: 85 },
  { name: "Wishing (If I Had a Photograph of You) - A Flock of Seagulls", path: "audio/Wishing.m4a", bpm: 85 },
  { name: "Wishing Well - Sananda Maitraya", path: "audio/WishingWell.m4a", bpm: 85 },
  { name: "Sin In My Heart - Siouxsie & The Banshees", path: "audio/SinInMyHeart.m", bpm: 85 },
  { name: "If You All Get To Heaven - Terence Trent D'Arby", path: "audio/IfYouAllGetToHeaven.m4a", bpm: 85 },
  { name: "Dirty Cash - The Adventures of Stevie V", path: "audio/Dirty Cash.m4a", bpm: 100 },
    { name: "Heart Of Glass - Blondie", path: "audio/HeartOfGlass.mp3", bpm: 100 },
      { name: "Gold Dust Woman - Fleetwood Mac", path: "audio/GoldDustWoman.m4a", bpm: 100 },
            { name: "How To Be A Zillionaire - ABC", path: "audio/HowToBeAZillionaire.mp3", bpm: 100 },
                   { name: "Church of the Poison Mind - Culture Club", path: "audio/ChurchOfThePoisonMind.mp3", bpm: 100 },

];

// Modern / "NOW" bucket — genuinely post-1989. Thin on purpose; grow this list.
const non80sTracks = [
    { name: "Band Of Matron Saints - RJD2", path: "audio/BandOfMatronSaints.m4a", bpm: 100 },
    { name: "Utopia - Goldfrapp", path: "audio/08 Utopia.m4a", bpm: 100 },
  // { name: "Gangsta's Paradise - Coolio", path: "/audio/gangstas_paradise.mp3", bpm: 80 },
  // { name: "Intergalactic - Beastie Boys", path: "audio/Intergalactic.mp3", bpm: 108 },
  // { name: "Heroes - Janelle Monae", path: "audio/Heroes.m4a", bpm: 85 },
  { name: "Lifetimes", path: "audio/07 Lifetimes.m4a", bpm: 105 },
    { name: "Amor Amor - Arno Elias", path: "audio/AmorAmor.m4a", bpm: 105 },
];

// Every track across both eras, deduped by path. Used to resolve curated
// per-page subsets (the fountain pins a handful by path) independent of era.
const allTracks = (() => {
  const seen = new Set();
  return [...eightyTracks, ...non80sTracks].filter((t) => {
    const key = (t.path || '').replace(/^\//, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
})();

// Normalize a track path for comparison (some entries have a leading slash, some don't)
const normalizeTrackPath = (p) => (p || '').replace(/^\//, '');

// Ride page exclusive track
export const gangstasParadiseTrack = { name: "Gangsta's Paradise - Coolio", path: "/audio/gangstas_paradise.mp3", bpm: 80 };

// Music Provider component
export const MusicProvider = ({ children }) => {
  const [showSpotify, setShowSpotify] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.2);
  const [isDucked, setIsDucked] = useState(false); // music dips while a character speaks
  const [trackProgress, setTrackProgress] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [is80sMode, setIs80sMode] = useState(false);
  // Which playlist plays. Independent of the visual is80sMode theme flag so the
  // music toggle never repaints a page. '80s' (brand default) -> eightyTracks,
  // 'modern' -> non80sTracks.
  const [musicEra, setMusicEraState] = useState('80s');
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
  const [preloadedUrl, setPreloadedUrl] = useState(null);
  const [preloadedIndex, setPreloadedIndex] = useState(null);
  const [preloadedPath, setPreloadedPath] = useState(null);
  const [pageSpecificTracks, setPageSpecificTracks] = useState([]);
  const [pagePlaylistOverride, setPagePlaylistOverride] = useState(null); // when set, playback is restricted to exactly these tracks

  // Use refs to track current values for event handlers
  const currentTrackIndexRef = React.useRef(0);
  const is80sModeRef = React.useRef(false);
  const musicEraRef = React.useRef('80s');
  const loadTrackRef = React.useRef(null);
  const shuffleHistoryRef = React.useRef([]);
  const pageSpecificTracksRef = React.useRef([]);
  const pendingRemovalTracksRef = React.useRef([]);
  const pagePlaylistOverrideRef = React.useRef(null);
  
  // The active playlist. A page can override it entirely (e.g. the fountain page
  // restricts playback to a curated handful); otherwise it's the mode's base list
  // plus any page-specific additions.
  const getCurrentPlaylist = useCallback(() => {
    if (pagePlaylistOverride && pagePlaylistOverride.length) {
      return pagePlaylistOverride;
    }
    const baseTracks = musicEra === 'modern' ? non80sTracks : eightyTracks;
    return [...baseTracks, ...pageSpecificTracks];
  }, [musicEra, pageSpecificTracks, pagePlaylistOverride]);

  // Add a track for the current page
  const addPageTrack = useCallback((track) => {
    setPageSpecificTracks(prev => {
      if (prev.some(t => t.path === track.path)) return prev;
      return [...prev, track];
    });
  }, []);

  // Remove a track when leaving a page (deferred if currently playing)
  const removePageTrack = useCallback((track) => {
    // Check if this track is currently playing
    const isCurrentlyPlaying = currentTrack && currentTrack.path === track.path;

    if (isCurrentlyPlaying) {
      // Defer removal until track ends
      pendingRemovalTracksRef.current = [...pendingRemovalTracksRef.current, track.path];
    } else {
      setPageSpecificTracks(prev => prev.filter(t => t.path !== track.path));
    }
  }, [currentTrack]);

  // Update refs when values change
  React.useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);
  
  React.useEffect(() => {
    is80sModeRef.current = is80sMode;
  }, [is80sMode]);

  React.useEffect(() => {
    musicEraRef.current = musicEra;
  }, [musicEra]);

  React.useEffect(() => {
    shuffleHistoryRef.current = shuffleHistory;
  }, [shuffleHistory]);

  React.useEffect(() => {
    pageSpecificTracksRef.current = pageSpecificTracks;
  }, [pageSpecificTracks]);

  React.useEffect(() => {
    pagePlaylistOverrideRef.current = pagePlaylistOverride;
  }, [pagePlaylistOverride]);


  // Load and play track function
  const loadTrack = useCallback(async (index, shouldAutoPlay = false) => {
    const playlist = getCurrentPlaylist();
    
    if (index < 0 || index >= playlist.length) {
      return;
    }
    
    setIsLoadingTrack(true);
    
    try {
      
      // Check if storage is initialized and not a dummy
      if (!storage || !storage.app) {
        console.error('[MusicContext] Firebase storage is not properly initialized!');
        console.error('[MusicContext] This usually means Firebase environment variables are missing in production.');
        console.error('[MusicContext] Please add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET and other Firebase env vars to your deployment.');
        throw new Error('Firebase storage not properly initialized - check environment variables');
      }
      
      const trackRef = storageRefUtil(storage, playlist[index].path);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Firebase Storage timeout after 10 seconds')), 10000);
      });
      
      let url;
      try {
        // Race between getDownloadURL and timeout
        url = await Promise.race([
          getDownloadURL(trackRef),
          timeoutPromise
        ]);
      } catch (firebaseError) {
        console.error('[MusicContext] Firebase Storage error:', firebaseError);
        console.error('[MusicContext] Error code:', firebaseError.code);
        console.error('[MusicContext] Error message:', firebaseError.message);
        
        // Check specific error types
        if (firebaseError.code === 'storage/object-not-found') {
          console.error('[MusicContext] File not found in Firebase Storage:', playlist[index].path);
        } else if (firebaseError.code === 'storage/unauthorized') {
          console.error('[MusicContext] Firebase Storage permissions error - check security rules');
        } else if (firebaseError.code === 'storage/canceled') {
          console.error('[MusicContext] Firebase Storage request was canceled');
        } else if (firebaseError.code === 'storage/unknown') {
          console.error('[MusicContext] Unknown Firebase Storage error - may be network/CORS issue');
        } else if (firebaseError.message === 'Firebase Storage timeout after 10 seconds') {
          console.error('[MusicContext] Firebase Storage request timed out - check network and Firebase configuration');
          console.error('[MusicContext] This often indicates missing Firebase configuration in production');
        }
        
        throw firebaseError;
      }
      
      if (!url || url === '') {
        console.error('[MusicContext] Got empty URL from Firebase Storage - check Firebase configuration');
        throw new Error('Empty URL from Firebase Storage');
      }
      
      
      if (audioRef.current) {
        
        // Check if we're replacing a placeholder (data: URL)
        const isReplacingPlaceholder = audioRef.current.src && audioRef.current.src.startsWith('data:');
        const wasPlaying = !audioRef.current.paused;
        
        if (!isReplacingPlaceholder) {
          // Normal load - clear existing source first
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        
        // Set new source
        audioRef.current.src = url;
        audioRef.current.load();
        
        await new Promise((resolve, reject) => {
          const handleCanPlay = () => {
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
        
        // If we're replacing a placeholder that was playing, or shouldAutoPlay is true, play the track
        if (shouldAutoPlay || (isReplacingPlaceholder && wasPlaying)) {
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch (e) {
            console.error('[MusicContext] Play blocked:', e.message);
            setIsPlaying(false);
            // Return false to indicate play was blocked
            return false;
          }
        } else {
        }
        // Return true to indicate success
        return true;
      }
    } catch (error) {
      console.error('[MusicContext] Error loading track:', error);
      setIsLoadingTrack(false);
      setIsPlaying(false);
      return false;
    }
  }, [getCurrentPlaylist, setCurrentTrackBPM]);
  
  // Load a track by its Firebase Storage path (for DJ listener mode)
  const loadTrackByPath = useCallback(async (path, trackName, bpm = 100, seekSeconds = 0) => {
    if (!path || !storage || !storage.app) return false;

    setIsLoadingTrack(true);
    try {
      const trackRef = storageRefUtil(storage, path);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Firebase Storage timeout')), 10000);
      });
      const url = await Promise.race([getDownloadURL(trackRef), timeoutPromise]);
      if (!url) throw new Error('Empty URL from Firebase Storage');

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = url;
        audioRef.current.load();

        await new Promise((resolve) => {
          const handleCanPlay = () => {
            audioRef.current.removeEventListener('canplaythrough', handleCanPlay);
            audioRef.current.removeEventListener('error', handleErr);
            resolve();
          };
          const handleErr = () => {
            audioRef.current.removeEventListener('canplaythrough', handleCanPlay);
            audioRef.current.removeEventListener('error', handleErr);
            resolve();
          };
          audioRef.current.addEventListener('canplaythrough', handleCanPlay);
          audioRef.current.addEventListener('error', handleErr);
          setTimeout(() => {
            audioRef.current.removeEventListener('canplaythrough', handleCanPlay);
            audioRef.current.removeEventListener('error', handleErr);
            resolve();
          }, 10000);
        });

        if (seekSeconds > 0 && isFinite(seekSeconds) && audioRef.current.duration) {
          audioRef.current.currentTime = Math.min(seekSeconds, audioRef.current.duration);
        }

        const trackObj = { name: trackName, path, bpm };
        setCurrentTrack(trackObj);
        setCurrentTrackBPM(bpm);
        setIsLoadingTrack(false);

        if (globalAudioManager) {
          globalAudioManager.setState({ currentTrack: trackObj });
        }

        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (e) {
          setIsPlaying(false);
        }
        return true;
      }
    } catch (error) {
      console.error('[MusicContext] Error loading track by path:', error);
      setIsLoadingTrack(false);
      return false;
    }
  }, []);

  // Update loadTrackRef when loadTrack changes
  React.useEffect(() => {
    loadTrackRef.current = loadTrack;
  }, [loadTrack]);
  
  // Preload a track URL when component mounts or when mode changes
  useEffect(() => {
    // Debug Firebase configuration in production
    // console.log('[MusicContext] Firebase Config Check:', {
    //   hasStorage: !!storage,
    //   storageApp: storage?.app ? 'initialized' : 'missing',
    //   storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'NOT SET',
    //   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
    //   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'set' : 'NOT SET',
    //   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'NOT SET'
    // });
    
    // Log the storage bucket value (partially masked for security)
    if (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      // console.log('[MusicContext] Storage bucket configured:', bucket.substring(0, 10) + '...');
    } else {
      console.error('[MusicContext] ERROR: Firebase Storage Bucket is not configured!');
      console.error('[MusicContext] Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your deployment environment variables');
    }
    
    if (storage) {
      // console.log('[MusicContext] Storage object exists, app status:', storage.app ? 'valid' : 'invalid/dummy');
    }
    
    const preloadFirstTrack = async () => {
      // Skip preload if storage is not properly initialized
      if (!storage || !storage.app) {
        console.warn('[MusicContext] Skipping track preload - Firebase storage not properly initialized');
        return;
      }

      const playlist = getCurrentPlaylist();
      if (playlist.length > 0) {
        let index = 0;
        // Use random starting track if shuffle is enabled
        if (isShuffled) {
          index = Math.floor(Math.random() * playlist.length);
        }
        
        try {
          // console.log('[MusicContext] Attempting to preload track:', playlist[index].path);
          const trackRef = storageRefUtil(storage, playlist[index].path);
          // console.log('[MusicContext] Storage ref created:', trackRef._location?.path);

          // Add timeout for preloading too
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Preload timeout after 5 seconds')), 5000);
          });
          
          const url = await Promise.race([
            getDownloadURL(trackRef),
            timeoutPromise
          ]);
          
          // console.log('[MusicContext] Successfully preloaded track, URL length:', url?.length);
          setPreloadedUrl(url);
          setPreloadedIndex(index);
          setPreloadedPath(playlist[index].path);
        } catch (error) {
          console.warn('[MusicContext] Failed to preload track:', error.message);
        }
      }
    };
    
    // Only preload if we don't already have audio loaded
    if (!audioRef.current?.src) {
      preloadFirstTrack();
    }
  }, [getCurrentPlaylist, isShuffled]);

  // Play/Pause functions
  const play = useCallback(() => {
    if (audioRef.current) {
      // If no track loaded, use preloaded URL or load a new track
      if (!audioRef.current.src) {
        // Resolve the preloaded track against the CURRENT playlist by path — the
        // list may have been filtered (page exclusions) since it was preloaded,
        // which shifts indices and can drop the preloaded track entirely.
        const playlist = getCurrentPlaylist();
        const preloadIdx = preloadedPath
          ? playlist.findIndex((t) => normalizeTrackPath(t.path) === normalizeTrackPath(preloadedPath))
          : -1;
        if (preloadedUrl && preloadIdx !== -1) {
          // Use the preloaded URL for instant playback
          audioRef.current.src = preloadedUrl;
          audioRef.current.load();

          // Set track info
          setCurrentTrackIndex(preloadIdx);
          setCurrentTrackBPM(playlist[preloadIdx].bpm || 100);
          setCurrentTrack(playlist[preloadIdx]);

          // Play immediately - this should work because we're in user interaction context
          audioRef.current.play().then(() => {
            setIsPlaying(true);

            // Clear preloaded data
            setPreloadedUrl(null);
            setPreloadedIndex(null);
            setPreloadedPath(null);

            // Save state to global manager
            if (globalAudioManager) {
              globalAudioManager.setState({
                currentTrackIndex: preloadIdx,
                is80sMode: is80sMode,
                currentTrack: playlist[preloadIdx],
                isShuffled: isShuffled
              });
            }
          }).catch(e => {
            console.error('[MusicContext] Play blocked even with preloaded track:', e);
            setIsPlaying(false);
          });
        } else {
          // Fallback: Load from Firebase Storage (playlist already filtered above)
          let startIndex = 0;

          // Use random starting track if shuffle is enabled
          if (isShuffled && playlist.length > 0) {
            startIndex = Math.floor(Math.random() * playlist.length);
          }
          
          setIsLoadingTrack(true);
          
          // Load track with autoplay
          loadTrack(startIndex, true).then((success) => {
            if (!success) {
              // The track is now loaded, so next click will just resume
            }
          }).catch(error => {
            console.error('[MusicContext] Failed to load track:', error);
            console.error('[MusicContext] Full error details:', {
              message: error.message,
              code: error.code,
              stack: error.stack
            });
            setIsLoadingTrack(false);
            
            // Show user-friendly error
            alert('Unable to load music. Please check your internet connection and try again.');
          });
        }
      } else {
        // Resume playback
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(e => {
          setIsPlaying(false);
        });
      }
    }
  }, [loadTrack, getCurrentPlaylist, isShuffled, preloadedUrl, preloadedIndex, preloadedPath, setCurrentTrackBPM]);
  
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
    const playlist = getCurrentPlaylist();
    
    let nextIndex;
    if (isShuffled) {
      nextIndex = getRandomTrackIndex(playlist);
      // Update shuffle history
      const newHistory = [...shuffleHistory, currentTrackIndex];
      setShuffleHistory(newHistory);
      if (globalAudioManager) {
        globalAudioManager.setState({ shuffleHistory: newHistory });
      }
    } else {
      nextIndex = (currentTrackIndex + 1) % playlist.length;
    }
    
    const wasPlaying = audioRef.current && !audioRef.current.paused;
    loadTrack(nextIndex, wasPlaying);
  }, [currentTrackIndex, getCurrentPlaylist, isShuffled, shuffleHistory, getRandomTrackIndex, loadTrack]);
  
  // Previous track function
  const prevTrack = useCallback(() => {
    const playlist = getCurrentPlaylist();
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
  }, [currentTrackIndex, getCurrentPlaylist, isShuffled, shuffleHistory, loadTrack]);
  
  
  // Initialize audio element and restore state on mount
  useEffect(() => {
    if (!globalAudioManager) return;
    
    const audio = globalAudioManager.getAudio();
    audioRef.current = audio;
    setAudioElement(audio);
    
    // Restore state from global manager
    const savedState = globalAudioManager.getState();

    // Music era persists on its own (a user can set it before any track loads).
    if (savedState.musicEra) {
      setMusicEraState(savedState.musicEra);
      musicEraRef.current = savedState.musicEra;
    }

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
      
    }
    
    // Add ended event listener that uses refs for current values
    const handleEnded = () => {

      // Set playing to false first to stop animation
      setIsPlaying(false);

      // Clean up any tracks that were pending removal (deferred while playing)
      if (pendingRemovalTracksRef.current.length > 0) {
        const pathsToRemove = pendingRemovalTracksRef.current;
        setPageSpecificTracks(prev => prev.filter(t => !pathsToRemove.includes(t.path)));
        pageSpecificTracksRef.current = pageSpecificTracksRef.current.filter(t => !pathsToRemove.includes(t.path));
        pendingRemovalTracksRef.current = [];
      }

      // For auto-advance, always play the next track. Honor a page playlist
      // override (e.g. the fountain page) so auto-advance stays within it.
      const override = pagePlaylistOverrideRef.current;
      const baseTracks = musicEraRef.current === 'modern' ? non80sTracks : eightyTracks;
      const playlist = (override && override.length)
        ? override
        : [...baseTracks, ...pageSpecificTracksRef.current];
      const savedState = globalAudioManager?.getState();
      const shuffled = savedState?.isShuffled !== undefined ? savedState.isShuffled : true;

      if (shuffled) {
        // Get current state
        const currentIdx = currentTrackIndexRef.current;
        const history = shuffleHistoryRef.current || [];

        // Check if we've played all tracks - if so, reset history
        let availableIndices;
        if (history.length >= playlist.length - 1) {
          // All tracks have been played, start fresh (exclude only current track)
          availableIndices = playlist.map((_, i) => i).filter(i => i !== currentIdx);
          // Reset the history
          setShuffleHistory([currentIdx]);
          shuffleHistoryRef.current = [currentIdx];
          if (globalAudioManager) {
            globalAudioManager.setState({ shuffleHistory: [currentIdx] });
          }
        } else {
          // Filter out tracks we've already played AND the current track
          availableIndices = playlist.map((_, i) => i).filter(i =>
            i !== currentIdx && !history.includes(i)
          );

          // Fallback if somehow all tracks are exhausted
          if (availableIndices.length === 0) {
            availableIndices = playlist.map((_, i) => i).filter(i => i !== currentIdx);
          }
        }

        const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];

        // Update shuffle history with the current track (the one that just ended)
        const newHistory = [...history, currentIdx];
        setShuffleHistory(newHistory);
        shuffleHistoryRef.current = newHistory;
        if (globalAudioManager) {
          globalAudioManager.setState({ shuffleHistory: newHistory });
        }

        setTimeout(() => {
          if (loadTrackRef.current) {
            loadTrackRef.current(nextIndex, true);
          }
        }, 100);
      } else {
        // Sequential playback
        const nextIndex = (currentTrackIndexRef.current + 1) % playlist.length;
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

  // Persist the visual 80s theme flag. It no longer touches the music — the
  // music playlist is governed by `musicEra` (see effect below) — so flipping a
  // page's theme never interrupts playback.
  useEffect(() => {
    if (globalAudioManager) {
      globalAudioManager.setState({ is80sMode });
    }
  }, [is80sMode]);

  // Handle music-era change - persist it and reload a track from the new
  // playlist so the switch is audible immediately.
  //
  // IMPORTANT: this effect lists `loadTrack` as a dep (it calls it), and
  // `loadTrack`'s identity churns whenever the playlist changes — including
  // when a page sets/clears `pagePlaylistOverride` on mount/unmount (e.g. the
  // fountain page). Without the era guard below, simply navigating to/from such
  // a page would re-run this effect and restart the current song with a new
  // random track. Only reload when the era GENUINELY changed.
  const prevMusicEraRef = React.useRef(musicEra);
  useEffect(() => {
    if (globalAudioManager) {
      globalAudioManager.setState({ musicEra });
    }

    // Bail unless the era actually changed (skips override/loadTrack churn).
    if (prevMusicEraRef.current === musicEra) {
      return;
    }
    prevMusicEraRef.current = musicEra;

    // If we have a track playing or paused, reload from the new playlist
    if (audioRef.current && audioRef.current.src) {
      const wasPlaying = !audioRef.current.paused;

      // Get the playlist for the new era
      const playlist = getCurrentPlaylist();

      // Choose a random track if shuffled, otherwise start at 0
      let newTrackIndex = 0;
      if (isShuffled && playlist.length > 0) {
        newTrackIndex = Math.floor(Math.random() * playlist.length);
        // Reset shuffle history for the new playlist
        setShuffleHistory([]);
        if (globalAudioManager) {
          globalAudioManager.setState({ shuffleHistory: [] });
        }
      }

      setCurrentTrackIndex(newTrackIndex);
      loadTrack(newTrackIndex, wasPlaying);
    }
  }, [musicEra, isShuffled, loadTrack]);
  
  // Update volume when it changes, with a smooth "duck" ramp while a character
  // is speaking (isDucked) so dialogue stays intelligible over the music.
  useEffect(() => {
    if (!globalAudioManager) return;
    const audio = globalAudioManager.getAudio();
    if (!audio) return;

    const DUCK_FACTOR = 0.18; // music drops to 18% of chosen volume while speaking
    const target = Math.max(0, Math.min(1, volume * (isDucked ? DUCK_FACTOR : 1)));
    const start = audio.volume;
    const delta = target - start;

    // Snap if the change is negligible; otherwise ease over ~280ms.
    if (Math.abs(delta) < 0.005) {
      audio.volume = target;
      return;
    }

    const duration = 280;
    let raf = null;
    let startTs = null;
    const step = (ts) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
      audio.volume = Math.max(0, Math.min(1, start + delta * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [volume, isDucked]);
  
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
    isDucked,
    setMusicDucked: setIsDucked,
    trackProgress,
    setTrackProgress,
    currentTrackIndex,
    setCurrentTrackIndex,
    is80sMode,
    setIs80sMode,
    musicEra,
    setMusicEra: (era) => {
      const next = era === 'modern' ? 'modern' : '80s';
      setMusicEraState(next);
      musicEraRef.current = next;
      if (globalAudioManager) {
        globalAudioManager.setState({ musicEra: next });
      }
    },
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
    allTracks,
    loadTrackByPath,
    isShuffled,
    addPageTrack,
    removePageTrack,
    pagePlaylistOverride,
    setPagePlaylistOverride,
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