import { db, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, where } from '@/lib/firebaseServer';

export async function POST(request) {
  try {
    if (!db) {
      console.error('[Race API] Firestore not initialized');
      return Response.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await request.json();
    const { time, position, track, userId, userName, userImage } = body;

    if (!time || !position) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const docRef = await addDoc(collection(db, 'race_times'), {
      time: parseFloat(time),
      position: parseInt(position),
      track: track || 'loop_track',
      userId: userId || 'anonymous',
      userName: userName || 'Anonymous Racer',
      userImage: userImage || null,
      createdAt: serverTimestamp(),
    });

    return Response.json({ id: docRef.id, success: true });
  } catch (error) {
    console.error('[Race API] Failed to save race time:', error.message, error.code);
    return Response.json({ error: error.message || 'Failed to save' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    if (!db) {
      return Response.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const track = searchParams.get('track') || 'loop_track';
    const count = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Get top times for the track
    const q = query(
      collection(db, 'race_times'),
      where('track', '==', track),
      orderBy('time', 'asc'),
      limit(count)
    );

    const snapshot = await getDocs(q);
    const times = snapshot.docs.map((doc, index) => ({
      id: doc.id,
      rank: index + 1,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return Response.json({ times });
  } catch (error) {
    console.error('[Race API] Failed to fetch leaderboard:', error.message, error.code);
    return Response.json({ error: error.message || 'Failed to fetch' }, { status: 500 });
  }
}
