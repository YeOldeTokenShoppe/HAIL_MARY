'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWriteContract } from 'wagmi';
import { useWalletAuth } from '@/components/WalletAuthProvider';
import { NFT_DROP_ADDRESS, NATIVE_TOKEN } from '@/lib/contracts';
import { nftDropClaimAbi } from '@/lib/abis/nftDropClaimAbi';
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
  limit,
} from '@/lib/firebaseClient';

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
  previewConfig: { icon: '/images/maryToy.webp', accentColor: '#00f5d4' },
};

const TEST_SCENARIO = 'available';

export function useWeeklyPrize() {
  const { user, isSignedIn } = useUser();
  const { walletAddress, isWalletConnected, tokenBalance } = useWalletAuth();
  const { writeContractAsync } = useWriteContract();

  const [currentPrize, setCurrentPrize] = useState(null);
  const [claimStatus, setClaimStatus] = useState('loading');
  const [claimCount, setClaimCount] = useState(0);
  const [userClaim, setUserClaim] = useState(null);
  const [isClaimLoading, setIsClaimLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasTokens = tokenBalance && parseInt(tokenBalance) > 0;
  const isEligible = isSignedIn && isWalletConnected && hasTokens;

  // TEST MODE LOGIC
  useEffect(() => {
    if (!TEST_MODE) return;
    if (TEST_SCENARIO === 'no_prize') {
      setCurrentPrize(null); setClaimCount(0);
    } else if (TEST_SCENARIO === 'sold_out') {
      setCurrentPrize({ ...MOCK_PRIZE, claimCount: MOCK_PRIZE.maxClaims });
      setClaimCount(MOCK_PRIZE.maxClaims);
    } else {
      setCurrentPrize(MOCK_PRIZE); setClaimCount(MOCK_PRIZE.claimCount);
    }
    if (TEST_SCENARIO === 'claimed') {
      setUserClaim({
        id: 'test_claim_001', prizeId: MOCK_PRIZE.id, prizeName: MOCK_PRIZE.name,
        prizeDescription: MOCK_PRIZE.description,
        prizeModelPath: MOCK_PRIZE.collectibleModelPath,
        prizeCapsuleModelPath: MOCK_PRIZE.capsuleModelPath,
        prizeVideoSrc: MOCK_PRIZE.videoSrc,
        prizeIcon: MOCK_PRIZE.previewConfig?.icon,
        prizeAccentColor: MOCK_PRIZE.previewConfig?.accentColor,
        claimedAt: { toDate: () => new Date() },
        weekIdentifier: MOCK_PRIZE.weekIdentifier,
        claimNumber: MOCK_PRIZE.claimCount, maxClaims: MOCK_PRIZE.maxClaims,
      });
    } else { setUserClaim(null); }
  }, []);

  // PRODUCTION: Subscribe to active prize
  useEffect(() => {
    if (TEST_MODE || !db) { if (!TEST_MODE) setClaimStatus('no_prize'); return; }
    const prizesRef = collection(db, 'weeklyPrizes');
    const activeQuery = query(prizesRef, where('isActive', '==', true), limit(1));
    const unsubscribe = onSnapshot(activeQuery, (snapshot) => {
      if (snapshot.empty) { setCurrentPrize(null); setClaimStatus('no_prize'); setClaimCount(0); return; }
      const prizeDoc = snapshot.docs[0];
      const prizeData = { id: prizeDoc.id, ...prizeDoc.data() };
      setCurrentPrize(prizeData); setClaimCount(prizeData.claimCount || 0);
    }, (err) => { console.error('Error fetching active prize:', err); setError(err.message); setClaimStatus('no_prize'); });
    return () => unsubscribe();
  }, []);

  // Subscribe to user's claim
  useEffect(() => {
    if (TEST_MODE || !db || !currentPrize || !walletAddress) { setUserClaim(null); return; }
    const claimsRef = collection(db, 'prizeClaims');
    const userClaimQuery = query(claimsRef, where('prizeId', '==', currentPrize.id), where('walletAddress', '==', walletAddress.toLowerCase()));
    const unsubscribe = onSnapshot(userClaimQuery, (snapshot) => {
      if (snapshot.empty) { setUserClaim(null); } else {
        const claimDoc = snapshot.docs[0]; setUserClaim({ id: claimDoc.id, ...claimDoc.data() });
      }
    }, (err) => { console.error('Error fetching user claim:', err); });
    return () => unsubscribe();
  }, [currentPrize?.id, walletAddress]);

  // Update claim status
  useEffect(() => {
    if (!currentPrize) { setClaimStatus('no_prize'); return; }
    if (userClaim) { setClaimStatus('claimed'); return; }
    if (claimCount >= (currentPrize.maxClaims || 80)) { setClaimStatus('sold_out'); return; }
    if (!isEligible) { setClaimStatus('ineligible'); return; }
    setClaimStatus('available');
  }, [currentPrize, userClaim, claimCount, isEligible]);

  const claimPrize = useCallback(async () => {
    // TEST MODE
    if (TEST_MODE) {
      setIsClaimLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockClaim = {
        id: 'test_claim_' + Date.now(), prizeId: currentPrize.id,
        userId: user?.id || 'test_user', walletAddress: walletAddress?.toLowerCase() || 'test_wallet',
        claimedAt: { toDate: () => new Date() }, weekIdentifier: currentPrize.weekIdentifier,
        prizeName: currentPrize.name, prizeModelPath: currentPrize.collectibleModelPath || currentPrize.modelPath,
        prizeCapsuleModelPath: currentPrize.capsuleModelPath, prizeVideoSrc: currentPrize.videoSrc,
        prizeDescription: currentPrize.description, prizeIcon: currentPrize.previewConfig?.icon,
        prizeAccentColor: currentPrize.previewConfig?.accentColor,
        claimNumber: claimCount + 1, maxClaims: currentPrize.maxClaims,
      };
      setUserClaim(mockClaim); setClaimCount(prev => prev + 1); setIsClaimLoading(false);
      return mockClaim;
    }

    // PRODUCTION
    if (!db || !currentPrize || !user || !walletAddress) throw new Error('Cannot claim: missing requirements');
    if (claimStatus !== 'available') throw new Error(`Cannot claim: status is ${claimStatus}`);

    setIsClaimLoading(true); setError(null);

    try {
      const prizeRef = doc(db, 'weeklyPrizes', currentPrize.id);
      const { getDoc: fetchDoc } = await import('firebase/firestore');
      const prizeSnapshot = await fetchDoc(prizeRef);

      if (!prizeSnapshot.exists()) throw new Error('Prize no longer exists');
      const prizeData = prizeSnapshot.data();
      const currentCount = prizeData.claimCount || 0;
      const maxClaims = prizeData.maxClaims || 80;
      if (currentCount >= maxClaims) throw new Error('All prizes have been claimed');
      if (!prizeData.isActive) throw new Error('This prize is no longer active');

      // Dedup check
      const claimsRef = collection(db, 'prizeClaims');
      const existingClaimQuery = query(claimsRef, where('prizeId', '==', currentPrize.id), where('walletAddress', '==', walletAddress.toLowerCase()));
      const existingClaims = await getDocs(existingClaimQuery);
      if (!existingClaims.empty) throw new Error('You have already claimed this prize');

      // Mint NFT on-chain FIRST
      const txHash = await writeContractAsync({
        address: NFT_DROP_ADDRESS,
        abi: nftDropClaimAbi,
        functionName: 'claim',
        args: [
          walletAddress,
          1n,
          NATIVE_TOKEN,
          0n,
          { proof: [], quantityLimitPerWallet: 0n, pricePerToken: 0n, currency: NATIVE_TOKEN },
          '0x',
        ],
      });

      // Mint succeeded — write to Firebase
      const claimData = await runTransaction(db, async (transaction) => {
        const freshSnapshot = await transaction.get(prizeRef);
        const freshData = freshSnapshot.data();
        const freshCount = freshData.claimCount || 0;
        transaction.update(prizeRef, { claimCount: freshCount + 1 });
        return {
          prizeId: currentPrize.id, userId: user.id, walletAddress: walletAddress.toLowerCase(),
          claimedAt: serverTimestamp(), weekIdentifier: freshData.weekIdentifier,
          prizeName: freshData.name, prizeModelPath: freshData.collectibleModelPath || freshData.modelPath,
          prizeVideoSrc: freshData.videoSrc || null, prizeDescription: freshData.description,
          prizeIcon: freshData.previewConfig?.icon || null, prizeAccentColor: freshData.previewConfig?.accentColor || '#00f5d4',
          claimNumber: freshCount + 1, mintStatus: 'success', txHash,
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
  }, [currentPrize, user, walletAddress, claimStatus, writeContractAsync]);

  const fetchUserPrizes = useCallback(async () => {
    if (TEST_MODE) {
      const mockCollection = [];
      if (userClaim) mockCollection.push(userClaim);
      mockCollection.push({
        id: 'test_claim_historic_1', prizeId: MOCK_PRIZE.id, prizeName: MOCK_PRIZE.name,
        prizeDescription: MOCK_PRIZE.description, prizeModelPath: MOCK_PRIZE.collectibleModelPath,
        prizeCapsuleModelPath: MOCK_PRIZE.capsuleModelPath, prizeVideoSrc: MOCK_PRIZE.videoSrc,
        prizeIcon: MOCK_PRIZE.previewConfig?.icon, prizeAccentColor: MOCK_PRIZE.previewConfig?.accentColor,
        claimedAt: { toDate: () => new Date('2026-01-27') }, weekIdentifier: MOCK_PRIZE.weekIdentifier,
        claimNumber: 23, maxClaims: MOCK_PRIZE.maxClaims,
      });
      return mockCollection;
    }

    if (!db || !walletAddress) return [];
    try {
      const claimsRef = collection(db, 'prizeClaims');
      const userClaimsQuery = query(claimsRef, where('walletAddress', '==', walletAddress.toLowerCase()), orderBy('claimedAt', 'desc'));
      const snapshot = await getDocs(userClaimsQuery);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching user prizes:', err);
      return [];
    }
  }, [walletAddress, userClaim]);

  return {
    currentPrize, claimCount,
    remainingClaims: currentPrize ? Math.max(0, (currentPrize.maxClaims || 80) - claimCount) : 0,
    claimStatus, userClaim, isClaimLoading, error,
    isEligible,
    eligibilityDetails: { isSignedIn, isWalletConnected, hasTokens },
    claimPrize, fetchUserPrizes,
    isTestMode: TEST_MODE,
  };
}

export default useWeeklyPrize;
