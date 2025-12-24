import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { validateUserSequence, recordPuzzleAttempt } from '@/utilities/dailyPuzzleSequence';

export async function POST(request) {
  try {
    // Verify user is authenticated
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to play' },
        { status: 401 }
      );
    }
    
    // Parse the request body
    const body = await request.json();
    const { sequence } = body;
    
    if (!sequence || !Array.isArray(sequence) || sequence.length !== 3) {
      return NextResponse.json(
        { error: 'Invalid sequence', message: 'Please provide a valid 3-symbol sequence' },
        { status: 400 }
      );
    }
    
    // Validate the sequence server-side
    const validationResult = await validateUserSequence(userId, sequence);
    
    if (validationResult.valid) {
      // Award coins or other rewards here
      // You could integrate with your existing coin system
      const reward = 5000; // Base reward for completing daily puzzle
      
      return NextResponse.json({
        success: true,
        valid: true,
        reward,
        message: 'Congratulations! Daily puzzle completed!',
        attempts: validationResult.attempts
      });
    } else {
      // Handle different failure reasons
      let message = 'Incorrect sequence. Try again!';
      let statusCode = 200; // Still a valid request, just wrong answer
      
      if (validationResult.reason === 'already_completed') {
        message = validationResult.message || 'You have already completed today\'s puzzle!';
      } else if (validationResult.attempts >= 10) {
        message = 'Too many attempts today. Try again tomorrow!';
        statusCode = 429; // Too Many Requests
      }
      
      return NextResponse.json({
        success: false,
        valid: false,
        reason: validationResult.reason,
        message,
        attempts: validationResult.attempts
      }, { status: statusCode });
    }
  } catch (error) {
    console.error('Error validating puzzle sequence:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: 'An error occurred while validating your sequence'
      },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check if user has completed today's puzzle
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // This could return the user's puzzle status
    // You might want to implement a getUserPuzzleStatus function
    return NextResponse.json({
      userId,
      message: 'Use POST to validate your sequence'
    });
  } catch (error) {
    console.error('Error checking puzzle status:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}