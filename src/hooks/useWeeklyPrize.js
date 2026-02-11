'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWalletAuth } from '@/components/WalletAuthProvider';
import { getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { client, chain } from '@/lib/contract';
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

// NFT Drop (DropERC721) on Base — 80 unique editions
const NFT_DROP_ADDRESS = '0xBF6f792075C5893DAF380D640B2f90296ea30C22';
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// ============================================
// TESTING MODE CONFIGURATION
// ============================================
// Set to true to use mock data instead of Firebase
const TEST_MODE = false;

// Mock prize data for testing
const MOCK_PRIZE = {
  id: 'test_prize_001',
  modelPath: '/models/Collectible1.glb',           // Vending machine display (with capsule)
  collectibleModelPath: '/models/Collectible1.glb', // Toy only (for full preview)
  capsuleModelPath: '/models/ipadMaryToy.glb',     // Toy in capsule (for collection grid)
  videoSrc: '/videos/neon80s.mp4',                 // Video texture for 3D model screen
  name: 'Trade Life RL80',
  description: 'Our Lady of Perpetual Profit',
  weekIdentifier: '2026-W05',
  isActive: true,
  maxClaims: 80,
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
  const { walletAddress, isWalletConnected, tokenBalance, activeAccount } = useWalletAuth();

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
          prizeModelPath: MOCK_PRIZE.collectibleModelPath, // Toy only (for full preview)
          prizeCapsuleModelPath: MOCK_PRIZE.capsuleModelPath, // Toy in capsule (for grid)
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

    if (claimCount >= (currentPrize.maxClaims || 80)) {
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
        prizeModelPath: currentPrize.collectibleModelPath || currentPrize.modelPath, // Toy only
        prizeCapsuleModelPath: currentPrize.capsuleModelPath, // Toy in capsule
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

      // Step 1: Validate eligibility (read-only, no writes yet)
      const { getDoc: fetchDoc } = await import('firebase/firestore');
      const prizeSnapshot = await fetchDoc(prizeRef);

      if (!prizeSnapshot.exists()) {
        throw new Error('Prize no longer exists');
      }

      const prizeData = prizeSnapshot.data();
      const currentCount = prizeData.claimCount || 0;
      const maxClaims = prizeData.maxClaims || 80;

      if (currentCount >= maxClaims) {
        throw new Error('All prizes have been claimed');
      }

      if (!prizeData.isActive) {
        throw new Error('This prize is no longer active');
      }

      // Dedup check
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

      // Step 2: Mint NFT on-chain FIRST (before any Firebase writes)
      const nftContract = getContract({ client, chain, address: NFT_DROP_ADDRESS });
      const tx = prepareContractCall({
        contract: nftContract,
        method: 'function claim(address _receiver, uint256 _quantity, address _currency, uint256 _pricePerToken, (bytes32[] proof, uint256 quantityLimitPerWallet, uint256 pricePerToken, address currency) _allowlistProof, bytes _data) payable',
        params: [
          walletAddress,
          1n,
          NATIVE_TOKEN,
          0n,
          {
            proof: [],
            quantityLimitPerWallet: 0n,
            pricePerToken: 0n,
            currency: NATIVE_TOKEN
          },
          '0x'
        ],
      });
      const result = await sendTransaction({ account: activeAccount, transaction: tx });
      const txHash = result.transactionHash;

      // Step 3: Mint succeeded — now write to Firebase
      const claimData = await runTransaction(db, async (transaction) => {
        const freshSnapshot = await transaction.get(prizeRef);
        const freshData = freshSnapshot.data();
        const freshCount = freshData.claimCount || 0;

        transaction.update(prizeRef, {
          claimCount: freshCount + 1
        });

        return {
          prizeId: currentPrize.id,
          userId: user.id,
          walletAddress: walletAddress.toLowerCase(),
          claimedAt: serverTimestamp(),
          weekIdentifier: freshData.weekIdentifier,
          prizeName: freshData.name,
          prizeModelPath: freshData.collectibleModelPath || freshData.modelPath,
          prizeVideoSrc: freshData.videoSrc || null,
          prizeDescription: freshData.description,
          prizeIcon: freshData.previewConfig?.icon || null,
          prizeAccentColor: freshData.previewConfig?.accentColor || '#00f5d4',
          claimNumber: freshCount + 1,
          mintStatus: 'success',
          txHash,
        };
      });

      await addDoc(claimsRef, claimData);

      return { ...claimData, mintStatus: 'success', txHash };
    } catch (err) {
      console.error('Error claiming prize:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsClaimLoading(false);
    }
  }, [currentPrize, user, walletAddress, claimStatus, activeAccount]);

  // Fetch all user's claimed prizes (for collection display)
  const fetchUserPrizes = useCallback(async () => {
    // ============================================
    // TEST MODE: Return mock collection
    // ============================================
    if (TEST_MODE) {
      // console.log('[useWeeklyPrize] TEST MODE: Returning mock prize collection');
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
        prizeModelPath: MOCK_PRIZE.collectibleModelPath, // Toy only
        prizeCapsuleModelPath: MOCK_PRIZE.capsuleModelPath, // Toy in capsule
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
    remainingClaims: currentPrize ? Math.max(0, (currentPrize.maxClaims || 80) - claimCount) : 0,

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
