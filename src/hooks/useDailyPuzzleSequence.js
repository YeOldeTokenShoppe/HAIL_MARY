"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { 
  getUserDailySequence, 
  validateUserSequence,
  recordPuzzleAttempt,
  getUserPuzzleStats 
} from '@/utilities/dailyPuzzleSequence';

export const useDailyPuzzleSequence = () => {
  const { user, isSignedIn } = useUser();
  const [puzzleData, setPuzzleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  
  // Fetch the daily sequence for the current user
  const fetchSequence = useCallback(async () => {
    if (!isSignedIn || !user?.id) {
      setPuzzleData(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const sequence = await getUserDailySequence(user.id);
      setPuzzleData(sequence);
      
      // Also fetch stats
      const userStats = await getUserPuzzleStats(user.id);
      setStats(userStats);
    } catch (err) {
      console.error('Error fetching daily sequence:', err);
      setError(err.message);
      setPuzzleData(null);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, user?.id]);
  
  // Initial fetch
  useEffect(() => {
    fetchSequence();
  }, [fetchSequence]);
  
  // Refresh at midnight UTC
  useEffect(() => {
    if (!isSignedIn) return;
    
    const checkForNewDay = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      
      const timeUntilMidnight = tomorrow.getTime() - now.getTime();
      
      // Set timeout for midnight
      const timeout = setTimeout(() => {
        fetchSequence();
        // Set up daily check
        const interval = setInterval(fetchSequence, 24 * 60 * 60 * 1000);
        return () => clearInterval(interval);
      }, timeUntilMidnight);
      
      return () => clearTimeout(timeout);
    };
    
    return checkForNewDay();
  }, [isSignedIn, fetchSequence]);
  
  // Validate a sequence attempt
  const validateSequence = useCallback(async (attemptedSequence) => {
    if (!isSignedIn || !user?.id) {
      return {
        valid: false,
        reason: 'not_signed_in',
        message: 'Please sign in to play the daily puzzle'
      };
    }
    
    try {
      const result = await validateUserSequence(user.id, attemptedSequence);
      
      // Refresh the puzzle data after validation
      if (result.valid) {
        await fetchSequence();
      }
      
      return result;
    } catch (err) {
      console.error('Error validating sequence:', err);
      return {
        valid: false,
        reason: 'error',
        message: 'An error occurred while validating your sequence'
      };
    }
  }, [isSignedIn, user?.id, fetchSequence]);
  
  // Record a puzzle completion (for individual puzzles within the sequence)
  const recordPuzzleComplete = useCallback(async (puzzleIndex) => {
    if (!isSignedIn || !user?.id) return;
    
    // This is for tracking individual puzzle completions within the 3-puzzle set
    // You could extend the Firebase schema to track this if needed
    console.log(`Puzzle ${puzzleIndex + 1} completed for user ${user.id}`);
  }, [isSignedIn, user?.id]);
  
  // Get the sequence only (for display purposes)
  const getSequence = useCallback(() => {
    if (!puzzleData?.sequence) return null;
    return puzzleData.sequence;
  }, [puzzleData]);
  
  // Check if puzzle is already completed today
  const isCompletedToday = useCallback(() => {
    return puzzleData?.completedToday || false;
  }, [puzzleData]);
  
  return {
    // Data
    sequence: puzzleData?.sequence || null,
    isCompletedToday: puzzleData?.completedToday || false,
    attempts: puzzleData?.attempts || 0,
    lastAttempt: puzzleData?.lastAttempt,
    stats,
    
    // State
    loading,
    error,
    isSignedIn,
    
    // Actions
    validateSequence,
    recordPuzzleComplete,
    refreshSequence: fetchSequence,
    getSequence,
    checkIsCompletedToday: isCompletedToday, // Renamed to avoid conflict
    
    // Utility
    isOffline: puzzleData?.isOffline || false // Indicates if using local-only sequence
  };
};