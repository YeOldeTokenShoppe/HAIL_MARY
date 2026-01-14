import { NextResponse } from 'next/server';
import { analyzePrayerBatch, aggregateAnalyses } from '@/lib/prayerAnalysis';
import { db, collection, query, orderBy, limit, getDocs } from '@/lib/firebaseClient';

// Fetch offerings from Firestore
async function fetchOfferingsFromFirestore() {
  try {
    console.log('[Prayer Analysis] Starting to fetch offerings from Firestore...');
    
    // If db is not initialized (dummy implementation), return empty array
    if (!db || !db.collection) {
      console.warn('[Prayer Analysis] Firestore not initialized, returning empty offerings');
      return [];
    }
    
    console.log('[Prayer Analysis] Firestore is initialized, querying offerings collection...');
    
    // Query the offerings collection
    // Try without orderBy first to see if we can get any data
    const offeringsRef = collection(db, 'offerings');
    
    // First try a simple query without ordering
    try {
      const simpleQuery = query(offeringsRef, limit(10));
      const testSnapshot = await getDocs(simpleQuery);
      console.log('[Prayer Analysis] Simple query test - found:', testSnapshot.size, 'documents');
      
      if (!testSnapshot.empty) {
        const firstDoc = testSnapshot.docs[0].data();
        console.log('[Prayer Analysis] Sample document fields:', Object.keys(firstDoc));
        console.log('[Prayer Analysis] Has timestamp?', 'timestamp' in firstDoc);
        console.log('[Prayer Analysis] Has createdAt?', 'createdAt' in firstDoc);
      }
    } catch (testError) {
      console.error('[Prayer Analysis] Simple query failed:', testError.message);
    }
    
    // Now try the ordered query - use createdAt if timestamp doesn't work
    let q;
    try {
      q = query(
        offeringsRef,
        orderBy('createdAt', 'desc'),
        limit(100)
      );
    } catch (orderError) {
      console.warn('[Prayer Analysis] OrderBy createdAt failed, trying without ordering:', orderError.message);
      q = query(offeringsRef, limit(100));
    }
    
    console.log('[Prayer Analysis] Executing query...');
    const snapshot = await getDocs(q);
    
    console.log('[Prayer Analysis] Query complete. Found documents:', snapshot.size);
    
    if (snapshot.empty) {
      console.log('[Prayer Analysis] No offerings found in Firestore');
      return [];
    }
    
    // Convert snapshot to array
    const offerings = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('[Prayer Analysis] Processing offering:', doc.id, 'has message:', !!data.message);
      offerings.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamp to milliseconds if it exists
        timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : data.timestamp || Date.now()
      });
    });
    
    console.log('[Prayer Analysis] Total offerings fetched:', offerings.length);
    console.log('[Prayer Analysis] Sample offering:', offerings[0] ? {
      id: offerings[0].id,
      hasMessage: !!offerings[0].message,
      messageLength: offerings[0].message?.length || 0,
      timestamp: offerings[0].timestamp
    } : 'No offerings');
    
    return offerings;
  } catch (error) {
    console.error('[Prayer Analysis] Error fetching offerings from Firestore:', error);
    console.error('[Prayer Analysis] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return [];
  }
}

// Cache for analysis results
let analysisCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request) {
  try {
    console.log('[Prayer Analysis API] GET request received');
    
    // Check cache first
    const now = Date.now();
    if (analysisCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('[Prayer Analysis API] Returning cached results');
      return NextResponse.json({
        ...analysisCache,
        fromCache: true,
        cacheAge: Math.round((now - cacheTimestamp) / 1000)
      });
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('[Prayer Analysis API] OpenAI API key configured:', !!apiKey);
    if (!apiKey) {
      console.warn('[Prayer Analysis API] OpenAI API key not configured, will use fallback analysis');
    }

    // Fetch recent offerings
    console.log('[Prayer Analysis API] Fetching offerings from Firestore...');
    const offerings = await fetchOfferingsFromFirestore();
    console.log('[Prayer Analysis API] Offerings fetched:', offerings.length);
    
    if (offerings.length === 0) {
      return NextResponse.json({
        overall: 0.5,
        label: 'Awaiting Prayers',
        emotions: [
          { name: 'Hope', value: 100, color: '#4ade80' }
        ],
        prayersPerHour: 0,
        trend: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        keywords: ['waiting', 'for', 'prayers'],
        lastUpdate: 'no offerings yet',
        totalAnalyzed: 0
      });
    }

    // Extract prayer texts
    const prayers = offerings
      .filter(offering => offering.message || offering.prayer || offering.text)
      .map(offering => ({
        id: offering.id,
        message: offering.message || offering.prayer || offering.text,
        timestamp: offering.timestamp || Date.now(),
        name: offering.name || 'Anonymous'
      }))
      .slice(0, 100); // Limit to 100 most recent

    // Analyze prayers in batches
    const analyses = await analyzePrayerBatch(
      prayers.map(p => p.message),
      apiKey
    );

    // Add timestamps from original prayers
    analyses.forEach((analysis, index) => {
      if (prayers[index]) {
        analysis.timestamp = prayers[index].timestamp;
      }
    });

    // Aggregate results
    const aggregatedStats = aggregateAnalyses(analyses);

    // Add metadata
    aggregatedStats.lastUpdate = new Date().toLocaleTimeString();
    aggregatedStats.totalOfferings = offerings.length;
    
    // Update cache
    analysisCache = aggregatedStats;
    cacheTimestamp = now;

    return NextResponse.json(aggregatedStats);

  } catch (error) {
    console.error('Prayer analysis error:', error);
    
    // Return mock data as fallback
    return NextResponse.json({
      overall: 0.72,
      label: 'Hopeful',
      emotions: [
        { name: 'Hope', value: 34, color: '#4ade80' },
        { name: 'Gratitude', value: 28, color: '#a78bfa' },
        { name: 'Desperation', value: 18, color: '#f87171' },
        { name: 'Confession', value: 12, color: '#60a5fa' },
        { name: 'Celebration', value: 8, color: '#fbbf24' },
      ],
      prayersPerHour: 47,
      trend: [0.45, 0.52, 0.48, 0.61, 0.58, 0.65, 0.72],
      keywords: ['moon', 'lambo', 'blessed', 'diamond hands', 'forgive me', 'hold', 'believe'],
      lastUpdate: '2 min ago',
      error: 'Using fallback data',
      errorDetails: error.message
    });
  }
}

// POST endpoint for analyzing specific prayers
export async function POST(request) {
  try {
    const { prayers, limit = 50 } = await request.json();
    
    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'OpenAI API key not configured',
        fallback: true
      }, { status: 503 });
    }

    // If specific prayers provided, analyze those
    if (prayers && prayers.length > 0) {
      const analyses = await analyzePrayerBatch(prayers.slice(0, limit), apiKey);
      const aggregatedStats = aggregateAnalyses(analyses);
      
      return NextResponse.json({
        ...aggregatedStats,
        totalAnalyzed: analyses.length
      });
    }

    // Otherwise fetch from Firebase
    const offerings = await fetchOfferingsFromFirestore();
    
    const prayerTexts = offerings
      .filter(offering => offering.message || offering.prayer || offering.text)
      .slice(0, limit)
      .map(offering => offering.message || offering.prayer || offering.text);

    const analyses = await analyzePrayerBatch(prayerTexts, apiKey);
    const aggregatedStats = aggregateAnalyses(analyses);

    return NextResponse.json({
      ...aggregatedStats,
      totalOfferings: offerings.length,
      totalAnalyzed: analyses.length
    });

  } catch (error) {
    console.error('Prayer analysis POST error:', error);
    return NextResponse.json({
      error: 'Analysis failed',
      message: error.message
    }, { status: 500 });
  }
}