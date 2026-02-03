'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWalletAuth } from '@/components/WalletAuthProvider';
import {
  db,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  runTransaction,
  serverTimestamp,
  getDocs,
  orderBy,
  limit
} from '@/lib/firebaseClient';

// ============================================
// TESTING MODE CONFIGURATION
// ============================================
// Set to true to use mock data instead of Firebase
const TEST_MODE = true;

// Mock prize data for testing
const MOCK_PRIZE = {
  id: 'test_prize_001',
  modelPath: '/models/Collectible1.glb',           // Vending machine display (with capsule)
  collectibleModelPath: '/models/Collectible1.glb', // Collection card display (no capsule)
  videoSrc: '/videos/neon80s.mp4',                 // Video texture for 3D model screen
  name: 'Trade Life RL80',
  description: 'Our Lady of Perpetual Profit',
  weekIdentifier: '2026-W05',
  isActive: true,
  maxClaims: 100,
  claimCount: 23, // Change this to test different remaining counts
  previewConfig: {
    icon: '/images/maryToy.webp',
    accentColor: '#00f5d4'
  }
};

// Test scenarios - uncomment the one you want to test:
const TEST_SCENARIO = 'available'; // 'available' | 'claimed' | 'sold_out' | 'no_prize'
// ============================================

/**
 * Hook for managing weekly prize claims
 *
 * Collections used:
 * - weeklyPrizes: Prize configurations (modelPath, name, description, maxClaims, claimCount, isActive)
 * - prizeClaims: User claim records (prizeId, userId, walletAddress, claimedAt, etc.)
 */
export function useWeeklyPrize() {
  const { user, isSignedIn } = useUser();
  const { walletAddress, isWalletConnected, tokenBalance } = useWalletAuth();

  // State
  const [currentPrize, setCurrentPrize] = useState(null);
  const [claimStatus, setClaimStatus] = useState('loading');
  const [claimCount, setClaimCount] = useState(0);
  const [userClaim, setUserClaim] = useState(null);
  const [isClaimLoading, setIsClaimLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if user has tokens (at least 1)
  const hasTokens = tokenBalance && parseInt(tokenBalance) > 0;

  // Combined eligibility check
  const isEligible = isSignedIn && isWalletConnected && hasTokens;

  // ============================================
  // TEST MODE LOGIC
  // ============================================
  useEffect(() => {
    if (TEST_MODE) {
      console.log('[useWeeklyPrize] TEST MODE ENABLED');
      console.log('[useWeeklyPrize] Test scenario:', TEST_SCENARIO);

      if (TEST_SCENARIO === 'no_prize') {
        setCurrentPrize(null);
        setClaimCount(0);
      } else if (TEST_SCENARIO === 'sold_out') {
        setCurrentPrize({ ...MOCK_PRIZE, claimCount: MOCK_PRIZE.maxClaims });
        setClaimCount(MOCK_PRIZE.maxClaims);
      } else {
        setCurrentPrize(MOCK_PRIZE);
        setClaimCount(MOCK_PRIZE.claimCount);
      }

      // Simulate claimed state
      if (TEST_SCENARIO === 'claimed') {
        setUserClaim({
          id: 'test_claim_001',
          prizeId: MOCK_PRIZE.id,
          prizeName: MOCK_PRIZE.name,
          prizeDescription: MOCK_PRIZE.description,
          prizeModelPath: MOCK_PRIZE.collectibleModelPath, // Use collectible model (no capsule)
          prizeVideoSrc: MOCK_PRIZE.videoSrc,              // Video for 3D model screen
          prizeIcon: MOCK_PRIZE.previewConfig?.icon,
          prizeAccentColor: MOCK_PRIZE.previewConfig?.accentColor,
          claimedAt: { toDate: () => new Date() },
          weekIdentifier: MOCK_PRIZE.weekIdentifier,
          claimNumber: MOCK_PRIZE.claimCount,
          maxClaims: MOCK_PRIZE.maxClaims
        });
      } else {
        setUserClaim(null);
      }

      return;
    }
  }, []);

  // ============================================
  // PRODUCTION MODE: Subscribe to active prize (real-time)
  // ============================================
  useEffect(() => {
    if (TEST_MODE) return; // Skip in test mode

    if (!db) {
      setClaimStatus('no_prize');
      return;
    }

    const prizesRef = collection(db, 'weeklyPrizes');
    const activeQuery = query(
      prizesRef,
      where('isActive', '==', true),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      activeQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setCurrentPrize(null);
          setClaimStatus('no_prize');
          setClaimCount(0);
          return;
        }

        const prizeDoc = snapshot.docs[0];
        const prizeData = { id: prizeDoc.id, ...prizeDoc.data() };
        setCurrentPrize(prizeData);
        setClaimCount(prizeData.claimCount || 0);
      },
      (err) => {
        console.error('Error fetching active prize:', err);
        setError(err.message);
        setClaimStatus('no_prize');
      }
    );

    return () => unsubscribe();
  }, []);

  // Subscribe to user's claim for current prize
  useEffect(() => {
    if (TEST_MODE) return; // Skip in test mode

    if (!db || !currentPrize || !walletAddress) {
      setUserClaim(null);
      return;
    }

    const claimsRef = collection(db, 'prizeClaims');
    const userClaimQuery = query(
      claimsRef,
      where('prizeId', '==', currentPrize.id),
      where('walletAddress', '==', walletAddress.toLowerCase())
    );

    const unsubscribe = onSnapshot(
      userClaimQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setUserClaim(null);
        } else {
          const claimDoc = snapshot.docs[0];
          setUserClaim({ id: claimDoc.id, ...claimDoc.data() });
        }
      },
      (err) => {
        console.error('Error fetching user claim:', err);
      }
    );

    return () => unsubscribe();
  }, [currentPrize?.id, walletAddress]);

  // Update claim status based on all factors
  useEffect(() => {
    if (!currentPrize) {
      setClaimStatus('no_prize');
      return;
    }

    if (userClaim) {
      setClaimStatus('claimed');
      return;
    }

    if (claimCount >= (currentPrize.maxClaims || 100)) {
      setClaimStatus('sold_out');
      return;
    }

    if (!isEligible) {
      setClaimStatus('ineligible');
      return;
    }

    setClaimStatus('available');
  }, [currentPrize, userClaim, claimCount, isEligible]);

  // Claim the prize
  const claimPrize = useCallback(async () => {
    // ============================================
    // TEST MODE: Simulate claim
    // ============================================
    if (TEST_MODE) {
      console.log('[useWeeklyPrize] TEST MODE: Simulating prize claim...');
      setIsClaimLoading(true);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockClaim = {
        id: 'test_claim_' + Date.now(),
        prizeId: currentPrize.id,
        userId: user?.id || 'test_user',
        walletAddress: walletAddress?.toLowerCase() || 'test_wallet',
        claimedAt: { toDate: () => new Date() },
        weekIdentifier: currentPrize.weekIdentifier,
        prizeName: currentPrize.name,
        prizeModelPath: currentPrize.collectibleModelPath || currentPrize.modelPath,
        prizeVideoSrc: currentPrize.videoSrc,
        prizeDescription: currentPrize.description,
        prizeIcon: currentPrize.previewConfig?.icon,
        prizeAccentColor: currentPrize.previewConfig?.accentColor,
        claimNumber: claimCount + 1,
        maxClaims: currentPrize.maxClaims
      };

      setUserClaim(mockClaim);
      setClaimCount(prev => prev + 1);
      setIsClaimLoading(false);

      console.log('[useWeeklyPrize] TEST MODE: Claim successful!', mockClaim);
      return mockClaim;
    }

    // ============================================
    // PRODUCTION MODE: Real Firebase claim
    // ============================================
    if (!db || !currentPrize || !user || !walletAddress) {
      throw new Error('Cannot claim: missing requirements');
    }

    if (claimStatus !== 'available') {
      throw new Error(`Cannot claim: status is ${claimStatus}`);
    }

    setIsClaimLoading(true);
    setError(null);

    try {
      const prizeRef = doc(db, 'weeklyPrizes', currentPrize.id);

      // Use transaction to atomically check and increment claim count
      const claimData = await runTransaction(db, async (transaction) => {
        const prizeSnapshot = await transaction.get(prizeRef);

        if (!prizeSnapshot.exists()) {
          throw new Error('Prize no longer exists');
        }

        const prizeData = prizeSnapshot.data();
        const currentCount = prizeData.claimCount || 0;
        const maxClaims = prizeData.maxClaims || 100;

        if (currentCount >= maxClaims) {
          throw new Error('All prizes have been claimed');
        }

        if (!prizeData.isActive) {
          throw new Error('This prize is no longer active');
        }

        // Check if user already claimed (double check within transaction)
        const claimsRef = collection(db, 'prizeClaims');
        const existingClaimQuery = query(
          claimsRef,
          where('prizeId', '==', currentPrize.id),
          where('walletAddress', '==', walletAddress.toLowerCase())
        );
        const existingClaims = await getDocs(existingClaimQuery);

        if (!existingClaims.empty) {
          throw new Error('You have already claimed this prize');
        }

        // Increment claim count
        transaction.update(prizeRef, {
          claimCount: currentCount + 1
        });

        // Create claim record
        const newClaim = {
          prizeId: currentPrize.id,
          userId: user.id,
          walletAddress: walletAddress.toLowerCase(),
          claimedAt: serverTimestamp(),
          weekIdentifier: prizeData.weekIdentifier,
          // Denormalized data for easy display
          prizeName: prizeData.name,
          prizeModelPath: prizeData.collectibleModelPath || prizeData.modelPath,
          prizeVideoSrc: prizeData.videoSrc || null,
          prizeDescription: prizeData.description,
          prizeIcon: prizeData.previewConfig?.icon || null,
          prizeAccentColor: prizeData.previewConfig?.accentColor || '#00f5d4'
        };

        return newClaim;
      });

      // Add the claim document (outside transaction since we just need to write)
      const claimsRef = collection(db, 'prizeClaims');
      await addDoc(claimsRef, claimData);

      return claimData;
    } catch (err) {
      console.error('Error claiming prize:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsClaimLoading(false);
    }
  }, [currentPrize, user, walletAddress, claimStatus]);

  // Fetch all user's claimed prizes (for collection display)
  const fetchUserPrizes = useCallback(async () => {
    // ============================================
    // TEST MODE: Return mock collection
    // ============================================
    if (TEST_MODE) {
      console.log('[useWeeklyPrize] TEST MODE: Returning mock prize collection');
      // Return the current claim if it exists, plus some mock historical prizes
      const mockCollection = [];

      if (userClaim) {
        mockCollection.push(userClaim);
      }

      // Add some mock historical prizes for testing the collection view
      mockCollection.push({
        id: 'test_claim_historic_1',
        prizeId: MOCK_PRIZE.id,
        prizeName: MOCK_PRIZE.name,
        prizeDescription: MOCK_PRIZE.description,
        prizeModelPath: MOCK_PRIZE.collectibleModelPath,
        prizeVideoSrc: MOCK_PRIZE.videoSrc,
        prizeIcon: MOCK_PRIZE.previewConfig?.icon,
        prizeAccentColor: MOCK_PRIZE.previewConfig?.accentColor,
        claimedAt: { toDate: () => new Date('2026-01-27') },
        weekIdentifier: MOCK_PRIZE.weekIdentifier,
        claimNumber: 23,
        maxClaims: MOCK_PRIZE.maxClaims
      });

      return mockCollection;
    }

    // ============================================
    // PRODUCTION MODE: Fetch from Firebase
    // ============================================
    if (!db || !walletAddress) {
      return [];
    }

    try {
      const claimsRef = collection(db, 'prizeClaims');
      const userClaimsQuery = query(
        claimsRef,
        where('walletAddress', '==', walletAddress.toLowerCase()),
        orderBy('claimedAt', 'desc')
      );

      const snapshot = await getDocs(userClaimsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.error('Error fetching user prizes:', err);
      return [];
    }
  }, [walletAddress, userClaim]);

  return {
    // Prize data
    currentPrize,
    claimCount,
    remainingClaims: currentPrize ? Math.max(0, (currentPrize.maxClaims || 100) - claimCount) : 0,

    // Claim state
    claimStatus,
    userClaim,
    isClaimLoading,
    error,

    // Eligibility
    isEligible,
    eligibilityDetails: {
      isSignedIn,
      isWalletConnected,
      hasTokens
    },

    // Actions
    claimPrize,
    fetchUserPrizes,

    // Test mode indicator
    isTestMode: TEST_MODE
  };
}

export default useWeeklyPrize;
