import { NextResponse } from 'next/server';
import { db } from '@/utilities/firebaseServer';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(request) {
  try {
    const { userId } = await request.json();
    
    // Verify the requesting user
    const user = await currentUser();
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create user streak document
    const streakRef = doc(db, 'userStreaks', userId);
    const streakDoc = await getDoc(streakRef);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let streakData = {
      currentStreak: 0,
      bestStreak: 0,
      lastCheckIn: null,
      totalCheckIns: 0,
      streakStartDate: null
    };
    
    if (streakDoc.exists()) {
      streakData = streakDoc.data();
      const lastCheckIn = streakData.lastCheckIn ? new Date(streakData.lastCheckIn.toDate()) : null;
      
      if (lastCheckIn) {
        const lastCheckInDate = new Date(lastCheckIn.getFullYear(), lastCheckIn.getMonth(), lastCheckIn.getDate());
        
        // Check if this is a new day
        if (lastCheckInDate.getTime() < today.getTime()) {
          // Check if streak continues (checked in yesterday) or breaks
          if (lastCheckInDate.getTime() === yesterday.getTime()) {
            // Continue streak
            streakData.currentStreak += 1;
          } else {
            // Streak broken - start new
            streakData.currentStreak = 1;
            streakData.streakStartDate = today;
          }
          
          // Update best streak if needed
          if (streakData.currentStreak > streakData.bestStreak) {
            streakData.bestStreak = streakData.currentStreak;
          }
          
          // Update check-in data
          streakData.lastCheckIn = now;
          streakData.totalCheckIns += 1;
          
          // Save to Firestore
          await updateDoc(streakRef, streakData);
        }
        // else: Already checked in today, no update needed
      } else {
        // First check-in ever
        streakData = {
          currentStreak: 1,
          bestStreak: 1,
          lastCheckIn: now,
          totalCheckIns: 1,
          streakStartDate: today
        };
        await setDoc(streakRef, streakData);
      }
    } else {
      // Create new streak document
      streakData = {
        currentStreak: 1,
        bestStreak: 1,
        lastCheckIn: now,
        totalCheckIns: 1,
        streakStartDate: today
      };
      await setDoc(streakRef, streakData);
    }
    
    // Convert Firestore timestamps to strings for JSON response
    const response = {
      ...streakData,
      lastCheckIn: streakData.lastCheckIn instanceof Date 
        ? streakData.lastCheckIn.toISOString() 
        : streakData.lastCheckIn?.toDate?.()?.toISOString() || null,
      streakStartDate: streakData.streakStartDate instanceof Date
        ? streakData.streakStartDate.toISOString()
        : streakData.streakStartDate?.toDate?.()?.toISOString() || null
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error checking streak:', error);
    return NextResponse.json(
      { error: 'Failed to check streak' },
      { status: 500 }
    );
  }
}