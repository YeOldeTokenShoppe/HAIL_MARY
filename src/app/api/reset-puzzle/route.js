import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/utilities/firebaseServer';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Development-only endpoint to reset daily puzzle
export async function POST(request) {
  try {
    console.log('Reset puzzle endpoint called');
    
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development' },
        { status: 403 }
      );
    }
    
    // Try to get the auth info from the request
    const authResult = await auth();
    console.log('Auth result:', authResult);
    
    // Extract userId from the auth result
    const userId = authResult?.userId;
    
    if (!userId) {
      // Try getting current user as fallback
      const user = await currentUser();
      
      if (!user) {
        console.log('Reset puzzle: No authenticated user found');
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Please sign in' },
          { status: 401 }
        );
      }
      
      // Use the user ID from currentUser
      const userIdFallback = user.id;
      
      // Reset using the fallback user ID
      const userPuzzleRef = doc(db, 'userPuzzles', userIdFallback);
      
      // Get current date in UTC
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      await setDoc(userPuzzleRef, {
        completedToday: false,
        attempts: 0,
        lastAttempt: null,
        completedAt: null,
        date: dateString,
        resetAt: serverTimestamp()
      }, { merge: true });
      
      return NextResponse.json({
        success: true,
        message: 'Puzzle reset successfully! You can play again.',
        date: dateString,
        method: 'currentUser'
      });
    }
    
    // Reset the puzzle by setting completedToday to false
    const userPuzzleRef = doc(db, 'userPuzzles', userId);
    
    // Get current date in UTC
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    await setDoc(userPuzzleRef, {
      completedToday: false,
      attempts: 0,
      lastAttempt: null,
      completedAt: null,
      date: dateString,
      resetAt: serverTimestamp()
    }, { merge: true });
    
    return NextResponse.json({
      success: true,
      message: 'Puzzle reset successfully! You can play again.',
      date: dateString
    });
    
  } catch (error) {
    console.error('Error resetting puzzle:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: 'Failed to reset puzzle'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check if reset is available
export async function GET() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  return NextResponse.json({
    available: isDevelopment,
    message: isDevelopment 
      ? 'Reset endpoint is available' 
      : 'Reset is only available in development'
  });
}