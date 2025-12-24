import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/utilities/firebaseServer';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

export async function GET() {
  try {
    const { userId } = await auth();
    const user = await currentUser();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Get all results sorted by burnedAmount
    const resultsRef = collection(db, 'results');
    const q = query(resultsRef, orderBy('burnedAmount', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const allMembers = [];
    let userRank = null;
    let userEntry = null;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const member = {
        username: data.username || data.userName,
        burnedAmount: parseInt(data.burnedAmount) || 0,  // Convert to number
        burnedAmountRaw: data.burnedAmount,  // Keep original for debugging
        email: data.email,
        clerkUserId: data.clerkUserId,
        docId: doc.id
      };
      
      allMembers.push(member);
    });
    
    // Sort by burnedAmount (as numbers) in descending order
    allMembers.sort((a, b) => b.burnedAmount - a.burnedAmount);
    
    // Assign ranks after sorting
    allMembers.forEach((member, index) => {
      member.rank = index + 1;
      
      // Check if this is the current user
      if (
        member.clerkUserId === userId ||
        member.email === user.emailAddresses?.[0]?.emailAddress ||
        member.username === user.firstName ||
        member.username === 'Michelle'
      ) {
        userRank = member.rank;
        userEntry = member;
      }
    });
    
    return NextResponse.json({
      currentUser: {
        clerkId: userId,
        email: user.emailAddresses?.[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username
      },
      totalMembers: allMembers.length,
      allMembers,
      yourRank: userRank,
      yourEntry: userEntry,
      message: userRank 
        ? `You are rank #${userRank} out of ${allMembers.length} members`
        : 'Could not find your entry in the results collection'
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}