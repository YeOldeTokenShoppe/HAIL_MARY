// Utility to check if user qualifies for Illumin80 (top 8%)
// This connects to the Firestore implementation

import { checkUserIllumin80Status } from './firestore-illumin80';

export async function checkIllumin80Status(userId, walletAddress) {
  try {
    // Use the Firestore implementation which now checks top 8%
    const status = await checkUserIllumin80Status(userId || walletAddress);
    
    // Update user's Clerk metadata if they're in Illumin80
    if (status.isIllumin80) {
      await fetch('/api/update-user-badge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          isIllumin80: true,
          rank: status.rank,
          percentile: status.percentile,
          title: status.title
        })
      });
    }
    
    return status.isIllumin80;
  } catch (error) {
    console.error('Error checking Illumin80 status:', error);
    return false;
  }
}

// Medieval titles for different tiers within Illumin80 (top 8%)
export const ILLUMIN80_TITLES = {
  1: "Grand Master of the Eternal Flame",      // #1 burner
  2: "Keeper of the Sacred Pyre",              // Top 5% of Illumin80
  3: "Knight of the Golden Ember",             // Top 15% of Illumin80
  4: "Guardian of the Inner Circle",           // Top 30% of Illumin80
  5: "Torch Bearer of the Order",              // Top 60% of Illumin80
  6: "Initiate of the Illumin80"               // Everyone else in top 8%
};

export function getIllumin80Title(rank, totalQualifying) {
  // If no totalQualifying provided, use legacy logic
  if (!totalQualifying) {
    if (rank === 1) return ILLUMIN80_TITLES[1];
    if (rank <= 5) return ILLUMIN80_TITLES[2];
    if (rank <= 10) return ILLUMIN80_TITLES[3];
    if (rank <= 20) return ILLUMIN80_TITLES[4];
    if (rank <= 40) return ILLUMIN80_TITLES[5];
    return ILLUMIN80_TITLES[6];
  }
  
  // Dynamic title assignment based on percentages within the Illumin80
  const percentWithinGroup = (rank / totalQualifying) * 100;
  
  if (rank === 1) return ILLUMIN80_TITLES[1];
  if (percentWithinGroup <= 5) return ILLUMIN80_TITLES[2];
  if (percentWithinGroup <= 15) return ILLUMIN80_TITLES[3];
  if (percentWithinGroup <= 30) return ILLUMIN80_TITLES[4];
  if (percentWithinGroup <= 60) return ILLUMIN80_TITLES[5];
  return ILLUMIN80_TITLES[6];
}