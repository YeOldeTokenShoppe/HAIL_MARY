import { db } from '@/utilities/firebaseServer';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';

// Get the top 8% of token burners from Firestore
export async function getIllumin80Members() {
  try {
    // Query ALL results to calculate top 8%
    const resultsRef = collection(db, 'results');
    const q = query(
      resultsRef, 
      orderBy('burnedAmount', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const allMembers = [];
    
    // First, collect all members with burned amounts > 0
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.burnedAmount && data.burnedAmount > 0) {
        allMembers.push({
          id: doc.id,
          data: data
        });
      }
    });
    
    // Calculate the top 8% threshold with minimum thresholds for small user bases
    const totalUsers = allMembers.length;
    let top8PercentCount;
    
    // For small user bases, use more generous thresholds
    if (totalUsers <= 10) {
      top8PercentCount = Math.min(3, totalUsers); // Top 3 or all users if less than 3
    } else if (totalUsers <= 50) {
      top8PercentCount = Math.max(5, Math.ceil(totalUsers * 0.15)); // Top 15% with min of 5
    } else if (totalUsers <= 100) {
      top8PercentCount = Math.max(8, Math.ceil(totalUsers * 0.10)); // Top 10% with min of 8
    } else {
      top8PercentCount = Math.ceil(totalUsers * 0.08); // Top 8% for larger user bases
    }
    
    // console.log(`Illumin80: ${top8PercentCount} users qualify (top ${Math.round(top8PercentCount/totalUsers*100)}% of ${totalUsers} total users)`);
    
    // Take only the top 8% of users
    const illumin80Members = [];
    allMembers.slice(0, top8PercentCount).forEach((memberData, index) => {
      const data = memberData.data;
      const rank = index + 1;
      const member = {
        id: memberData.id,
        clerkUserId: data.clerkUserId,  // Secure Clerk user ID (if linked)
        userId: data.userId,           // Legacy field
        walletAddress: data.walletAddress,
        burnedAmount: data.burnedAmount,  // Keep as-is from Firestore
        username: data.username || data.userName,  // Check both username and userName
        email: data.email || data.clerkEmail,  // Email if stored
        rank: rank,
        title: getIllumin80Title(rank, top8PercentCount),
        totalQualifying: top8PercentCount,  // Total number in Illumin80
        percentile: ((totalUsers - rank + 1) / totalUsers * 100).toFixed(1) // User's percentile
      };
      
      illumin80Members.push(member);
    });
    
    return illumin80Members;
  } catch (error) {
    console.error('Error fetching Illumin80 members:', error);
    return [];
  }
}

// Check if a specific user is in the Illumin80
export async function checkUserIllumin80Status(userIdentifier, isClerkUserId = false) {
  try {
    const illumin80 = await getIllumin80Members();
    
    // If this is a Clerk userId, ONLY check the clerkUserId field for security
    if (isClerkUserId) {
      const member = illumin80.find(m => m.clerkUserId === userIdentifier);
      
      if (member) {
        // console.log('✅ Found Illumin80 member by secure Clerk ID:', member);
      }
      
      return {
        isIllumin80: !!member,
        rank: member?.rank || null,
        title: member?.title || null,
        burnedAmount: member?.burnedAmount || 0,
        percentile: member?.percentile || null,
        totalQualifying: member?.totalQualifying || null
      };
    }
    
    // For non-Clerk IDs (used in frontend only), do broader matching
    // This should only be used for display purposes, NOT for access control
    const normalizedId = userIdentifier?.toLowerCase?.()?.trim() || userIdentifier;
    
    const member = illumin80.find(m => {
      // More flexible email matching
      const emailMatch = normalizedId && normalizedId.includes('@') && (
        m.email?.toLowerCase() === normalizedId ||
        m.clerkEmail?.toLowerCase() === normalizedId ||
        // Check if any stored field contains the email
        Object.values(m).some(value => 
          typeof value === 'string' && 
          value.toLowerCase() === normalizedId
        )
      );
      
      return (
        m.userId === userIdentifier ||
        m.clerkUserId === userIdentifier ||
        m.walletAddress === userIdentifier ||
        m.username?.toLowerCase() === normalizedId ||
        m.userName?.toLowerCase() === normalizedId ||
        emailMatch ||
        (m.username && userIdentifier && typeof userIdentifier === 'string' && userIdentifier.includes('@') && 
         m.username.toLowerCase() === userIdentifier.split('@')[0].toLowerCase())
      );
    });
    
    // if (member) {
    //   console.log('✅ Found Illumin80 member:', {
    //     username: member.username,
    //     rank: member.rank,
    //     burnedAmount: member.burnedAmount,
    //     title: member.title
    //   });
    // } else {
    //   console.log('❌ No match found for identifier:', userIdentifier, '\nIllumin80 members:', illumin80.map(m => ({
    //     username: m.username || m.userName,
    //     email: m.email || m.clerkEmail,
    //     userId: m.userId,
    //     clerkUserId: m.clerkUserId
    //   })));
    // }
    
    return {
      isIllumin80: !!member,
      rank: member?.rank || null,
      title: member?.title || null,
      burnedAmount: member?.burnedAmount || 0,
      percentile: member?.percentile || null,
      totalQualifying: member?.totalQualifying || null
    };
  } catch (error) {
    console.error('Error checking Illumin80 status:', error);
    return { isIllumin80: false, rank: null, title: null, burnedAmount: 0, percentile: null, totalQualifying: null };
  }
}

// Update Firestore document with Illumin80 status
export async function updateIllumin80StatusInFirestore(docId, isIllumin80, rank) {
  try {
    const docRef = doc(db, 'results', docId);
    await updateDoc(docRef, {
      isIllumin80,
      illumin80Rank: rank,
      illumin80Title: rank ? getIllumin80Title(rank) : null,
      illumin80UpdatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error updating Illumin80 status in Firestore:', error);
    return false;
  }
}

// Sync Illumin80 status between Firestore and Clerk
export async function syncIllumin80WithClerk() {
  try {
    const illumin80Members = await getIllumin80Members();
    
    for (const member of illumin80Members) {
      if (member.userId) {
        // Update Clerk metadata for each Illumin80 member
        await fetch('/api/update-user-badge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: member.userId,
            isIllumin80: true,
            rank: member.rank,
            title: member.title,
            burnedAmount: member.burnedAmount
          })
        });
        
        // Also update Firestore with Illumin80 status
        await updateIllumin80StatusInFirestore(member.id, true, member.rank);
      }
    }
    
    // console.log(`✨ Synced ${illumin80Members.length} Illumin80 members`);
    return illumin80Members;
  } catch (error) {
    console.error('Error syncing Illumin80 with Clerk:', error);
    return [];
  }
}

// Medieval titles based on rank and percentile
function getIllumin80Title(rank, totalQualifying) {
  // Dynamic title assignment based on percentages within the Illumin80
  const percentWithinGroup = (rank / totalQualifying) * 100;
  
  if (rank === 1) return "Grand Master of the Eternal Flame";
  if (percentWithinGroup <= 5) return "Keeper of the Sacred Pyre";       // Top 5% of Illumin80
  if (percentWithinGroup <= 15) return "Knight of the Golden Ember";     // Top 15% of Illumin80
  if (percentWithinGroup <= 30) return "Guardian of the Inner Circle";   // Top 30% of Illumin80
  if (percentWithinGroup <= 60) return "Torch Bearer of the Order";      // Top 60% of Illumin80
  return "Initiate of the Illumin80";                                    // Everyone else in Illumin80
}