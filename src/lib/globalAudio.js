// Global audio singleton that persists across all navigation
class GlobalAudioManager {
  constructor() {
    if (typeof window === 'undefined') return;
    
    // Check if instance already exists
    if (window.__globalAudioInstance) {
      return window.__globalAudioInstance;
    }
    
    // Create the audio element
    this.audio = new Audio();
    this.audio.volume = 0.2;
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "auto";
    
    // Store state
    this.currentTrackIndex = 0;
    this.is80sMode = false;
    // Music era is independent of the visual is80sMode theme flag: it only
    // decides which playlist plays. Defaults to the brand's headline '80s'.
    this.musicEra = '80s';
    this.currentTrack = null;
    this.isShuffled = true; // Default to shuffled
    this.shuffleHistory = [];
    this.shuffleQueue = [];
    
    // Store instance globally
    window.__globalAudioInstance = this;
  }
  
  getAudio() {
    return this.audio;
  }
  
  setState(state) {
    if (state.currentTrackIndex !== undefined) this.currentTrackIndex = state.currentTrackIndex;
    if (state.is80sMode !== undefined) this.is80sMode = state.is80sMode;
    if (state.musicEra !== undefined) this.musicEra = state.musicEra;
    if (state.currentTrack !== undefined) this.currentTrack = state.currentTrack;
    if (state.isShuffled !== undefined) this.isShuffled = state.isShuffled;
    if (state.shuffleHistory !== undefined) this.shuffleHistory = state.shuffleHistory;
    if (state.shuffleQueue !== undefined) this.shuffleQueue = state.shuffleQueue;
  }
  
  getState() {
    return {
      currentTrackIndex: this.currentTrackIndex,
      is80sMode: this.is80sMode,
      musicEra: this.musicEra,
      currentTrack: this.currentTrack,
      isPlaying: this.audio && !this.audio.paused,
      src: this.audio?.src || '',
      isShuffled: this.isShuffled,
      shuffleHistory: this.shuffleHistory,
      shuffleQueue: this.shuffleQueue
    };
  }
}

// Export singleton instance
const globalAudioManager = typeof window !== 'undefined' ? new GlobalAudioManager() : null;

export default globalAudioManager;