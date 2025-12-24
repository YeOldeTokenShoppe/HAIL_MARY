import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  doc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  increment, 
  serverTimestamp,
  runTransaction 
} from 'firebase/firestore';
import { db } from '@/utilities/firebaseServer';

export async function POST(request) {
  try {
    // Check if database is initialized
    if (!db) {
      console.error('Database not initialized in candle-likes API route');
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Get the authenticated user
    const { userId } = await auth();
    
    console.log('Clerk userId:', userId); // Debug log
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - must be logged in to like candles' },
        { status: 401 }
      );
    }

    const { candleId, action } = await request.json();

    if (!candleId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: candleId and action' },
        { status: 400 }
      );
    }

    if (!['like', 'unlike'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "like" or "unlike"' },
        { status: 400 }
      );
    }

    // Check if the candle exists and allows likes
    const candleRef = doc(db, 'results', candleId);
    
    if (action === 'like') {
      // Check if user already liked this candle
      const likesQuery = query(
        collection(db, 'candle_likes'),
        where('userId', '==', userId),
        where('candleId', '==', candleId)
      );
      const existingLikes = await getDocs(likesQuery);
      
      if (!existingLikes.empty) {
        return NextResponse.json(
          { error: 'You have already appreciated this candle' },
          { status: 400 }
        );
      }

      // Use a transaction to add like and update counter
      const result = await runTransaction(db, async (transaction) => {
        const candleDoc = await transaction.get(candleRef);
        
        if (!candleDoc.exists()) {
          throw new Error('Candle not found');
        }

        const candleData = candleDoc.data();
        
        // Check if candle allows likes
        if (candleData.allowLikes === false) {
          throw new Error('This candle does not allow appreciation');
        }

        // Increment likes counter
        transaction.update(candleRef, {
          likes: increment(1)
        });

        return {
          success: true,
          action: 'liked',
          newLikeCount: (candleData.likes || 0) + 1
        };
      });

      // Add the like record outside the transaction
      await addDoc(collection(db, 'candle_likes'), {
        userId,
        candleId,
        createdAt: serverTimestamp()
      });

      return NextResponse.json(result);

    } else if (action === 'unlike') {
      // Check if user has liked this candle
      const likesQuery = query(
        collection(db, 'candle_likes'),
        where('userId', '==', userId),
        where('candleId', '==', candleId)
      );
      const existingLikes = await getDocs(likesQuery);
      
      if (existingLikes.empty) {
        return NextResponse.json(
          { error: 'You have not appreciated this candle yet' },
          { status: 400 }
        );
      }

      // Use a transaction to decrement counter
      const result = await runTransaction(db, async (transaction) => {
        const candleDoc = await transaction.get(candleRef);
        
        if (!candleDoc.exists()) {
          throw new Error('Candle not found');
        }

        const candleData = candleDoc.data();
        const currentLikes = candleData.likes || 0;
        
        if (currentLikes > 0) {
          transaction.update(candleRef, {
            likes: increment(-1)
          });
        }

        return {
          success: true,
          action: 'unliked',
          newLikeCount: Math.max(0, currentLikes - 1)
        };
      });

      // Delete the like record outside the transaction
      const likeDocRef = existingLikes.docs[0].ref;
      await deleteDoc(likeDocRef);

      return NextResponse.json(result);
    }

  } catch (error) {
    console.error('Error handling candle like:', error);
    
    // Return appropriate error messages
    if (error.message === 'Candle not found') {
      return NextResponse.json(
        { error: 'Candle not found' },
        { status: 404 }
      );
    }
    
    if (error.message === 'This candle does not allow appreciation') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    if (error.message.includes('already appreciated') || error.message.includes('not appreciated')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process like action' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if user has liked a candle
export async function GET(request) {
  try {
    // Check if database is initialized
    if (!db) {
      console.error('Database not initialized in candle-likes GET route');
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const candleId = searchParams.get('candleId');

    if (!candleId) {
      return NextResponse.json(
        { error: 'Missing candleId parameter' },
        { status: 400 }
      );
    }

    // Check if user has liked this candle
    const likesQuery = query(
      collection(db, 'candle_likes'),
      where('userId', '==', userId),
      where('candleId', '==', candleId)
    );
    
    const querySnapshot = await getDocs(likesQuery);
    const hasLiked = !querySnapshot.empty;

    return NextResponse.json({ 
      hasLiked,
      candleId,
      userId 
    });

  } catch (error) {
    console.error('Error checking like status:', error);
    return NextResponse.json(
      { error: 'Failed to check like status' },
      { status: 500 }
    );
  }
}