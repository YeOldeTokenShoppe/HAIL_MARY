// API endpoint to archive fountain coins when the count reaches 200
import { NextResponse } from 'next/server';
import { db, collection, getDocs, addDoc, doc, serverTimestamp, writeBatch } from '@/lib/firebaseServer';

export async function POST(request) {
  try {
    console.log('Archive API called - checking database...');
    
    if (!db) {
      console.error('Database not initialized in API route');
      return NextResponse.json({ 
        error: 'Database not initialized',
        message: 'Firebase connection failed' 
      }, { status: 500 });
    }

    // Get all coins from fountain_coins collection
    console.log('Fetching coins from fountain_coins collection...');
    const coinsCollection = collection(db, 'fountain_coins');
    const snapshot = await getDocs(coinsCollection);
    
    const coinCount = snapshot.size;
    console.log('Found', coinCount, 'coins in fountain');
    
    if (coinCount < 200) {
      return NextResponse.json({ 
        message: 'Not enough coins to archive', 
        currentCount: coinCount 
      }, { status: 400 });
    }

    // Create archive entry
    const archiveCollection = collection(db, 'fountain_archives');
    const archiveDoc = await addDoc(archiveCollection, {
      date: serverTimestamp(),
      coinCount: coinCount,
      archivedAt: new Date().toISOString()
    });

    // Use batch delete for better performance
    const batch = writeBatch(db);
    snapshot.forEach((coinDoc) => {
      batch.delete(doc(db, 'fountain_coins', coinDoc.id));
    });
    
    await batch.commit();

    // Get the new cumulative total
    const archiveSnapshot = await getDocs(archiveCollection);
    let cumulativeTotal = 0;
    archiveSnapshot.forEach((archiveDoc) => {
      const data = archiveDoc.data();
      cumulativeTotal += (data.coinCount || 0);
    });

    return NextResponse.json({
      success: true,
      archivedCount: coinCount,
      cumulativeTotal: cumulativeTotal,
      archiveId: archiveDoc.id
    });

  } catch (error) {
    console.error('Error archiving coins:', error);
    return NextResponse.json({ 
      error: 'Failed to archive coins', 
      details: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to retrieve cumulative total
export async function GET() {
  try {
    if (!db) {
      console.error('Database not initialized for GET request');
      // Return 0 instead of error to allow page to load
      return NextResponse.json({
        cumulativeTotal: 0,
        archiveCount: 0,
        error: 'Database not initialized'
      });
    }

    const archiveCollection = collection(db, 'fountain_archives');
    const snapshot = await getDocs(archiveCollection);
    
    let cumulativeTotal = 0;
    let archiveCount = 0;
    
    snapshot.forEach((archiveDoc) => {
      const data = archiveDoc.data();
      cumulativeTotal += (data.coinCount || 0);
      archiveCount++;
    });

    return NextResponse.json({
      cumulativeTotal: cumulativeTotal,
      archiveCount: archiveCount
    });

  } catch (error) {
    console.error('Error getting cumulative total:', error);
    return NextResponse.json({ 
      error: 'Failed to get cumulative total', 
      details: error.message 
    }, { status: 500 });
  }
}