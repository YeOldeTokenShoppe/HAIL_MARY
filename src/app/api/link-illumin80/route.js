import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/utilities/firebaseServer';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

// This API route links a Clerk user to their Firestore entry
// Only the user themselves can link their account
export async function POST(request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await currentUser();
    const { firestoreUsername } = await request.json();
    
    if (!firestoreUsername) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }
    
    // Find the Firestore document with this username
    const resultsRef = collection(db, 'results');
    const q = query(resultsRef, where('username', '==', firestoreUsername));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'Username not found in results' }, { status: 404 });
    }
    
    // Update the document with the Clerk userId
    const docToUpdate = querySnapshot.docs[0];
    await updateDoc(doc(db, 'results', docToUpdate.id), {
      clerkUserId: userId,
      clerkEmail: user.emailAddresses?.[0]?.emailAddress,
      linkedAt: new Date().toISOString()
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Account linked successfully',
      username: firestoreUsername 
    });
    
  } catch (error) {
    console.error('Error linking account:', error);
    return NextResponse.json({ error: 'Failed to link account' }, { status: 500 });
  }
}

// GET method to check if current user is already linked
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if this Clerk user is already linked to a Firestore entry
    const resultsRef = collection(db, 'results');
    const q = query(resultsRef, where('clerkUserId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return NextResponse.json({ 
        linked: true,
        username: data.username,
        burnedAmount: data.burnedAmount
      });
    }
    
    return NextResponse.json({ linked: false });
    
  } catch (error) {
    console.error('Error checking link status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}