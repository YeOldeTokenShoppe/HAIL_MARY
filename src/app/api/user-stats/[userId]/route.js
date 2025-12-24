import { NextResponse } from 'next/server';
import { db } from '@/utilities/firebaseServer';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { currentUser, clerkClient } from '@clerk/nextjs/server';

export async function GET(request, { params }) {
  try {
    const { userId } = params;
    
    // Verify the requesting user
    const user = await currentUser();
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data from Firestore
    const resultsRef = collection(db, 'results');
    const q = query(resultsRef, where('clerkUserId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    let userData = null;
    if (!querySnapshot.empty) {
      userData = querySnapshot.docs[0].data();
    } else {
      // Try alternative lookups
      const altQuery = query(resultsRef, where('userId', '==', userId));
      const altSnapshot = await getDocs(altQuery);
      if (!altSnapshot.empty) {
        userData = altSnapshot.docs[0].data();
      }
    }

    // Get user metadata from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);
    const joinDate = clerkUser.createdAt;
    
    // Get streak data
    const streakRef = doc(db, 'userStreaks', userId);
    const streakDoc = await getDoc(streakRef);
    let streakData = {
      currentStreak: 0,
      bestStreak: 0,
      lastCheckIn: null
    };
    
    if (streakDoc.exists()) {
      const data = streakDoc.data();
      streakData = {
        currentStreak: data.currentStreak || 0,
        bestStreak: data.bestStreak || 0,
        lastCheckIn: data.lastCheckIn?.toDate?.()?.toISOString() || null
      };
    }

    // Calculate stats
    const stats = {
      totalBurned: userData?.burnedAmount || 0,
      totalStaked: userData?.stakedAmount || 0,
      joinDate: joinDate,
      achievements: [],
      walletAddress: userData?.walletAddress || null,
      username: userData?.username || clerkUser.username || null,
      lastBurnDate: userData?.lastBurnDate || null,
      lastStakeDate: userData?.lastStakeDate || null,
      streak: streakData.currentStreak,
      bestStreak: streakData.bestStreak,
      lastCheckIn: streakData.lastCheckIn
    };

    // Check achievements
    const achievements = [];
    
    // Early adopter
    if (joinDate && new Date(joinDate) < new Date('2024-02-01')) {
      achievements.push('early_adopter');
    }
    
    // Whale status
    if (stats.totalBurned >= 1000000) {
      achievements.push('whale');
    }
    
    // Diamond hands
    if (stats.totalStaked > 0) {
      achievements.push('diamond_hands');
    }
    
    // Fire starter
    if (stats.totalBurned > 0) {
      achievements.push('fire_starter');
    }
    
    // Illumin80 member
    if (userData?.isIllumin80) {
      achievements.push('illumin80');
    }
    
    // Streak achievements
    if (streakData.currentStreak >= 7) {
      achievements.push('week_warrior');
    }
    if (streakData.currentStreak >= 30) {
      achievements.push('dedicated');
    }

    stats.achievements = achievements;

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}