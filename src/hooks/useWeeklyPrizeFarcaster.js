'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReadContract, useWriteContract } from 'wagmi';
import { erc20Abi } from 'viem';
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

// RL80 Token on Base
const RL80_ADDRESS = '0x30D01555d88c76500a82754A1D53cAc082A6CB75';

// NFT Drop (DropERC721) on Base — 80 unique editions
const NFT_DROP_ADDRESS = '0xBF6f792075C5893DAF380D640B2f90296ea30C22';
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const CLAIM_ABI = [{
  inputs: [
    { name: '_receiver', type: 'address' },
    { name: '_quantity', type: 'uint256' },
    { name: '_currency', type: 'address' },
    { name: '_pricePerToken', type: 'uint256' },
    {
      name: '_allowlistProof', type: 'tuple',
      components: [
        { name: 'proof', type: 'bytes32[]' },
        { name: 'quantityLimitPerWallet', type: 'uint256' },
        { name: 'pricePerToken', type: 'uint256' },
        { name: 'currency', type: 'address' }
      ]
    },
    { name: '_data', type: 'bytes' }
  ],
  name: 'claim',
  outputs: [],
  stateMutability: 'payable',
  type: 'function'
}];

// ============================================
// TESTING MODE CONFIGURATION
// ============================================
const TEST_MODE = false;

const MOCK_PRIZE = {
  id: 'test_prize_001',
  modelPath: '/models/Collectible1.glb',
  collectibleModelPath: '/models/Collectible1.glb',
  capsuleModelPath: '/models/ipadMaryToy.glb',
  videoSrc: '/videos/neon80s.mp4',
  name: 'Trade Life RL80',
  description: 'Our Lady of Perpetual Profit',
  weekIdentifier: '2026-W05',
  isActive: true,
  maxClaims: 80,
  claimCount: 23,
  previewConfig: {
    icon: '/images/maryToy.webp',
    accentColor: '#00f5d4'
  }
};

const TEST_SCENARIO = 'available'; // 'available' | 'claimed' | 'sold_out' | 'no_prize'
// ============================================

/**
 * Farcaster-adapted hook for managing weekly prize claims.
 * Replaces Clerk/Thirdweb auth with Farcaster identity + wagmi.
 *
 * @param {Object} params
 * @param {string} params.farcasterFid - Farcaster user FID
 * @param {string} params.farcasterUsername - Farcaster username
 * @param {string} params.walletAddress - Connected wallet address (from wagmi)
 */
export function useWeeklyPrizeFarcaster({ farcasterFid, farcasterUsername, walletAddress } = {}) {
  // State
  const [currentPrize, setCurrentPrize] = useState(null);
  const [claimStatus, setClaimStatus] = useState('loading');
  const [claimCount, setClaimCount] = useState(0);
  const [userClaim, setUserClaim] = useState(null);
  const [isClaimLoading, setIsClaimLoading] = useState(false);
  const [error, setError] = useState(null);

  // NFT claim via wagmi
  const { writeContractAsync } = useWriteContract();

  // Read RL80 balance via wagmi (works without Thirdweb)
  const { data: tokenBalanceRaw } = useReadContract({
    address: RL80_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress },
  });

  const hasTokens = tokenBalanceRaw ? tokenBalanceRaw > 0n : false;
  const isWalletConnected = !!walletAddress;
  const isSignedIn = !!farcasterFid;

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

      if (TEST_SCENARIO === 'claimed') {
        setUserClaim({
          id: 'test_claim_001',
          prizeId: MOCK_PRIZE.id,
          prizeName: MOCK_PRIZE.name,
          prizeDescription: MOCK_PRIZE.description,
          prizeModelPath: MOCK_PRIZE.collectibleModelPath,
          prizeCapsuleModelPath: MOCK_PRIZE.capsuleModelPath,
          prizeVideoSrc: MOCK_PRIZE.videoSrc,
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
    if (TEST_MODE) return;

    if (!db) {
      console.error('[useWeeklyPrizeFarcaster] Firebase db is null — cannot fetch prizes');
      setClaimStatus('no_prize');
      return;
    }

    console.log('[useWeeklyPrizeFarcaster] Subscribing to weeklyPrizes...');
    const prizesRef = collection(db, 'weeklyPrizes');
    const activeQuery = query(
      prizesRef,
      where('isActive', '==', true),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      activeQuery,
      (snapshot) => {
        console.log('[useWeeklyPrizeFarcaster] Snapshot received, empty:', snapshot.empty, 'size:', snapshot.size);
        if (snapshot.empty) {
          setCurrentPrize(null);
          setClaimStatus('no_prize');
          setClaimCount(0);
          return;
        }

        const prizeDoc = snapshot.docs[0];
        const prizeData = { id: prizeDoc.id, ...prizeDoc.data() };
        console.log('[useWeeklyPrizeFarcaster] Prize found:', prizeData.name, 'active:', prizeData.isActive);
        setCurrentPrize(prizeData);
        setClaimCount(prizeData.claimCount || 0);
      },
      (err) => {
        console.error('[useWeeklyPrizeFarcaster] Error fetching active prize:', err);
        setError(err.message);
        setClaimStatus('no_prize');
      }
    );

    return () => unsubscribe();
  }, []);

  // Subscribe to user's claim for current prize
  useEffect(() => {
    if (TEST_MODE) return;

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
      console.log('[useWeeklyPrizeFarcaster] TEST MODE: Simulating prize claim...');
      setIsClaimLoading(true);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockClaim = {
        id: 'test_claim_' + Date.now(),
        prizeId: currentPrize.id,
        farcasterFid: farcasterFid || 'test_fid',
        farcasterUsername: farcasterUsername || 'test_user',
        walletAddress: walletAddress?.toLowerCase() || 'test_wallet',
        source: 'farcaster_miniapp',
        claimedAt: { toDate: () => new Date() },
        weekIdentifier: currentPrize.weekIdentifier,
        prizeName: currentPrize.name,
        prizeModelPath: currentPrize.collectibleModelPath || currentPrize.modelPath,
        prizeCapsuleModelPath: currentPrize.capsuleModelPath,
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

      console.log('[useWeeklyPrizeFarcaster] TEST MODE: Claim successful!', mockClaim);
      return mockClaim;
    }

    // ============================================
    // PRODUCTION MODE: Real Firebase claim
    // ============================================
    if (!db || !currentPrize || !farcasterFid || !walletAddress) {
      throw new Error('Cannot claim: missing requirements');
    }

    if (claimStatus !== 'available') {
      throw new Error(`Cannot claim: status is ${claimStatus}`);
    }

    setIsClaimLoading(true);
    setError(null);

    try {
      const prizeRef = doc(db, 'weeklyPrizes', currentPrize.id);

      const claimData = await runTransaction(db, async (transaction) => {
        const prizeSnapshot = await transaction.get(prizeRef);

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

        // Dedup by wallet address (same wallet can't claim twice regardless of entry point)
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

        transaction.update(prizeRef, {
          claimCount: currentCount + 1
        });

        const newClaim = {
          prizeId: currentPrize.id,
          farcasterFid,
          farcasterUsername,
          walletAddress: walletAddress.toLowerCase(),
          source: 'farcaster_miniapp',
          claimedAt: serverTimestamp(),
          weekIdentifier: prizeData.weekIdentifier,
          prizeName: prizeData.name,
          prizeModelPath: prizeData.collectibleModelPath || prizeData.modelPath,
          prizeVideoSrc: prizeData.videoSrc || null,
          prizeDescription: prizeData.description,
          prizeIcon: prizeData.previewConfig?.icon || null,
          prizeAccentColor: prizeData.previewConfig?.accentColor || '#00f5d4',
          mintStatus: 'pending'
        };

        return newClaim;
      });

      // Save claim to Firebase
      const claimsRef = collection(db, 'prizeClaims');
      const claimDocRef = await addDoc(claimsRef, claimData);

      // Mint NFT on-chain via DropERC721.claim()
      let mintStatus = 'pending';
      let txHash = null;
      try {
        txHash = await writeContractAsync({
          address: NFT_DROP_ADDRESS,
          abi: CLAIM_ABI,
          functionName: 'claim',
          args: [
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
        mintStatus = 'success';
      } catch (mintErr) {
        console.error('NFT mint failed (claim saved with pending status):', mintErr);
      }

      // Update Firebase doc with mint result
      if (mintStatus === 'success' && txHash) {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(claimDocRef, { mintStatus: 'success', txHash });
      }

      return { ...claimData, mintStatus, txHash };
    } catch (err) {
      console.error('Error claiming prize:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsClaimLoading(false);
    }
  }, [currentPrize, farcasterFid, farcasterUsername, walletAddress, claimStatus, claimCount, writeContractAsync]);

  // Fetch all user's claimed prizes (for collection display)
  const fetchUserPrizes = useCallback(async () => {
    if (TEST_MODE) {
      const mockCollection = [];

      if (userClaim) {
        mockCollection.push(userClaim);
      }

      mockCollection.push({
        id: 'test_claim_historic_1',
        prizeId: MOCK_PRIZE.id,
        prizeName: MOCK_PRIZE.name,
        prizeDescription: MOCK_PRIZE.description,
        prizeModelPath: MOCK_PRIZE.collectibleModelPath,
        prizeCapsuleModelPath: MOCK_PRIZE.capsuleModelPath,
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
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching user prizes:', err);
      return [];
    }
  }, [walletAddress, userClaim]);

  return {
    currentPrize,
    claimCount,
    remainingClaims: currentPrize ? Math.max(0, (currentPrize.maxClaims || 80) - claimCount) : 0,

    claimStatus,
    userClaim,
    isClaimLoading,
    error,

    isEligible,
    eligibilityDetails: {
      isSignedIn,
      isWalletConnected,
      hasTokens
    },

    claimPrize,
    fetchUserPrizes,

    isTestMode: TEST_MODE
  };
}

export default useWeeklyPrizeFarcaster;
