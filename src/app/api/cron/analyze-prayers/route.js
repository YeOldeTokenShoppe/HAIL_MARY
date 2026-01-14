import { NextResponse } from 'next/server';
import { analyzePrayerBatch, aggregateAnalyses } from '@/lib/prayerAnalysis';
import { db, collection, query, orderBy, limit, getDocs } from '@/lib/firebaseServer';
import { doc, setDoc } from 'firebase/firestore';

// This endpoint should be called by a cron job (e.g., Vercel Cron or external service)
// It analyzes prayers and stores the results in Firebase for all users to read

export async function GET(request) {
  try {
    console.log('[Prayer Analysis Cron] Starting scheduled analysis...');
    
    // Verify this is a legitimate cron request (optional security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Prayer Analysis Cron] Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[Prayer Analysis Cron] OpenAI API key not configured');
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        message: 'Cannot analyze prayers without OpenAI API key'
      }, { status: 500 });
    }
    
    // Fetch recent offerings from Firestore
    if (!db) {
      console.error('[Prayer Analysis Cron] Firestore not initialized');
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }
    
    const offeringsRef = collection(db, 'offerings');
    const q = query(
      offeringsRef,
      orderBy('createdAt', 'desc'),
      limit(200) // Analyze last 200 prayers
    );
    
    const snapshot = await getDocs(q);
    console.log('[Prayer Analysis Cron] Found', snapshot.size, 'offerings');
    
    if (snapshot.empty) {
      console.log('[Prayer Analysis Cron] No offerings to analyze');
      
      // Store empty state
      const emptyAnalysis = {
        overall: 0.5,
        label: 'Awaiting Prayers',
        emotions: [
          { name: 'Hope', value: 100, color: '#4ade80' }
        ],
        prayersPerHour: 0,
        trend: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        keywords: ['waiting', 'for', 'prayers'],
        lastUpdate: new Date().toISOString(),
        totalAnalyzed: 0,
        totalOfferings: 0
      };
      
      // Store in Firebase
      await setDoc(doc(db, 'sentiment_analysis', 'latest'), {
        ...emptyAnalysis,
        updatedAt: new Date()
      });
      
      return NextResponse.json(emptyAnalysis);
    }
    
    // Extract prayer texts
    const prayers = [];
    const hourAgo = Date.now() - (60 * 60 * 1000);
    let recentCount = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.message) {
        const timestamp = data.createdAt?.toMillis ? data.createdAt.toMillis() : 
                         data.timestamp || Date.now();
        
        prayers.push({
          id: doc.id,
          message: data.message,
          timestamp: timestamp,
          name: data.name || 'Anonymous'
        });
        
        if (timestamp > hourAgo) {
          recentCount++;
        }
      }
    });
    
    console.log('[Prayer Analysis Cron] Analyzing', prayers.length, 'prayers...');
    
    // Analyze prayers in batches
    const analyses = await analyzePrayerBatch(
      prayers.slice(0, 100).map(p => p.message), // Limit to 100 for cost control
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
    
    // Calculate actual prayers per hour
    aggregatedStats.prayersPerHour = recentCount;
    aggregatedStats.lastUpdate = new Date().toISOString();
    aggregatedStats.totalOfferings = snapshot.size;
    aggregatedStats.totalAnalyzed = analyses.length;
    
    console.log('[Prayer Analysis Cron] Analysis complete:', {
      sentiment: aggregatedStats.label,
      analyzed: aggregatedStats.totalAnalyzed,
      emotions: aggregatedStats.emotions.map(e => `${e.name}:${e.value}%`).join(', ')
    });
    
    // Store results in Firebase for all users to read
    const analysisDoc = {
      ...aggregatedStats,
      updatedAt: new Date(),
      nextUpdate: new Date(Date.now() + 30 * 60 * 1000) // Next update in 30 minutes
    };
    
    // Save to Firebase
    await setDoc(doc(db, 'sentiment_analysis', 'latest'), analysisDoc);
    
    // Also save historical data (optional)
    const historyDoc = {
      ...aggregatedStats,
      timestamp: new Date()
    };
    await setDoc(
      doc(db, 'sentiment_analysis_history', new Date().toISOString()),
      historyDoc
    );
    
    console.log('[Prayer Analysis Cron] Results saved to Firebase');
    
    return NextResponse.json({
      success: true,
      ...aggregatedStats
    });
    
  } catch (error) {
    console.error('[Prayer Analysis Cron] Error:', error);
    return NextResponse.json({
      error: 'Analysis failed',
      message: error.message
    }, { status: 500 });
  }
}

// POST endpoint for manual trigger (optional)
export async function POST(request) {
  return GET(request);
}