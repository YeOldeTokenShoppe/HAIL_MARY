/**
 * Weekly Analysis System
 * 
 * System for ingesting YouTube transcripts and other weekly market analysis
 * to keep agent knowledge bases current and informed.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, where } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ============================================================================
// TRANSCRIPT PROCESSING SYSTEM
// ============================================================================

/**
 * Process and store weekly market analysis transcript
 * @param {Object} transcriptData - Raw transcript data
 * @param {string} source - Source identifier (e.g., 'real_vision', 'coin_bureau')
 * @returns {Object} - Processed analysis for agents
 */
export async function processWeeklyAnalysis(transcriptData, source = 'youtube') {
  try {
    // Extract key insights from transcript
    const processedAnalysis = await extractMarketInsights(transcriptData);
    
    // Categorize insights by agent domain
    const agentInsights = categorizeInsightsByAgent(processedAnalysis);
    
    // Store in Firebase for persistence
    await storeAnalysisInFirebase(agentInsights, source);
    
    // Update agent knowledge bases
    await updateAgentKnowledge(agentInsights);
    
    console.log('✅ Weekly analysis processed and distributed to agents');
    return agentInsights;
    
  } catch (error) {
    console.error('❌ Failed to process weekly analysis:', error);
    throw error;
  }
}

/**
 * Extract market insights from raw transcript
 */
async function extractMarketInsights(transcriptData) {
  const { title, transcript, publishDate, channel } = transcriptData;
  
  // Basic text processing to extract insights
  const insights = {
    title,
    publishDate: new Date(publishDate),
    channel,
    rawTranscript: transcript,
    
    // Extracted insights
    sentiment: extractSentimentInsights(transcript),
    technical: extractTechnicalInsights(transcript),
    macro: extractMacroInsights(transcript),
    trading: extractTradingInsights(transcript),
    
    // Key quotes and predictions
    keyQuotes: extractKeyQuotes(transcript),
    predictions: extractPredictions(transcript),
    warnings: extractWarnings(transcript)
  };
  
  return insights;
}

/**
 * Extract sentiment-related insights for EMO
 */
function extractSentimentInsights(transcript) {
  const text = transcript.toLowerCase();
  const insights = [];
  
  // Sentiment keywords and patterns
  const sentimentPatterns = [
    { pattern: /fear.{0,50}greed/gi, type: 'fear_greed' },
    { pattern: /retail.{0,50}(panic|capitulation|fomo)/gi, type: 'retail_behavior' },
    { pattern: /whale.{0,50}(accumulation|distribution)/gi, type: 'whale_activity' },
    { pattern: /funding.{0,50}(negative|positive|extreme)/gi, type: 'funding_rates' },
    { pattern: /social.{0,50}sentiment/gi, type: 'social_sentiment' }
  ];
  
  sentimentPatterns.forEach(({ pattern, type }) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        insights.push({
          type,
          content: match.trim(),
          context: extractContext(transcript, match, 100)
        });
      });
    }
  });
  
  return insights;
}

/**
 * Extract technical analysis insights for TEKNO
 */
function extractTechnicalInsights(transcript) {
  const text = transcript.toLowerCase();
  const insights = [];
  
  const technicalPatterns = [
    { pattern: /support.{0,50}\$?\d+[,\d]*/gi, type: 'support_levels' },
    { pattern: /resistance.{0,50}\$?\d+[,\d]*/gi, type: 'resistance_levels' },
    { pattern: /(rsi|macd|bollinger|fibonacci).{0,100}/gi, type: 'indicators' },
    { pattern: /(breakout|breakdown|consolidation).{0,50}/gi, type: 'patterns' },
    { pattern: /target.{0,50}\$?\d+[,\d]*/gi, type: 'targets' }
  ];
  
  technicalPatterns.forEach(({ pattern, type }) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        insights.push({
          type,
          content: match.trim(),
          context: extractContext(transcript, match, 100),
          priceLevel: extractPriceLevel(match)
        });
      });
    }
  });
  
  return insights;
}

/**
 * Extract macro insights for MACRO agent
 */
function extractMacroInsights(transcript) {
  const text = transcript.toLowerCase();
  const insights = [];
  
  const macroPatterns = [
    { pattern: /(fed|federal reserve).{0,100}/gi, type: 'fed_policy' },
    { pattern: /(inflation|cpi|pce).{0,100}/gi, type: 'inflation' },
    { pattern: /(dxy|dollar).{0,50}(strength|weakness)/gi, type: 'dollar' },
    { pattern: /(recession|growth).{0,100}/gi, type: 'economic_cycle' },
    { pattern: /(rate cuts?|rate hikes?).{0,50}/gi, type: 'interest_rates' }
  ];
  
  macroPatterns.forEach(({ pattern, type }) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        insights.push({
          type,
          content: match.trim(),
          context: extractContext(transcript, match, 150)
        });
      });
    }
  });
  
  return insights;
}

/**
 * Extract trading insights for RL80
 */
function extractTradingInsights(transcript) {
  const text = transcript.toLowerCase();
  const insights = [];
  
  const tradingPatterns = [
    { pattern: /(position siz|allocation).{0,100}/gi, type: 'position_sizing' },
    { pattern: /(stop loss|risk management).{0,100}/gi, type: 'risk_management' },
    { pattern: /(bull market|bear market).{0,100}/gi, type: 'market_regime' },
    { pattern: /(portfolio|diversification).{0,100}/gi, type: 'portfolio' },
    { pattern: /(entry|exit).{0,50}(strategy|point)/gi, type: 'execution' }
  ];
  
  tradingPatterns.forEach(({ pattern, type }) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        insights.push({
          type,
          content: match.trim(),
          context: extractContext(transcript, match, 150)
        });
      });
    }
  });
  
  return insights;
}

/**
 * Categorize insights by agent
 */
function categorizeInsightsByAgent(processedAnalysis) {
  return {
    EMO: {
      type: 'sentiment_analysis',
      source: processedAnalysis.channel,
      date: processedAnalysis.publishDate,
      insights: processedAnalysis.sentiment,
      keyQuotes: processedAnalysis.keyQuotes.filter(q => 
        q.toLowerCase().includes('sentiment') || 
        q.toLowerCase().includes('fear') || 
        q.toLowerCase().includes('greed')
      )
    },
    
    TEKNO: {
      type: 'technical_analysis',
      source: processedAnalysis.channel,
      date: processedAnalysis.publishDate,
      insights: processedAnalysis.technical,
      keyQuotes: processedAnalysis.keyQuotes.filter(q =>
        q.toLowerCase().includes('support') ||
        q.toLowerCase().includes('resistance') ||
        q.toLowerCase().includes('breakout')
      )
    },
    
    MACRO: {
      type: 'macro_analysis',
      source: processedAnalysis.channel,
      date: processedAnalysis.publishDate,
      insights: processedAnalysis.macro,
      keyQuotes: processedAnalysis.keyQuotes.filter(q =>
        q.toLowerCase().includes('fed') ||
        q.toLowerCase().includes('inflation') ||
        q.toLowerCase().includes('policy')
      )
    },
    
    RL80: {
      type: 'trading_strategy',
      source: processedAnalysis.channel,
      date: processedAnalysis.publishDate,
      insights: processedAnalysis.trading,
      riskWarnings: processedAnalysis.warnings,
      tradingTargets: processedAnalysis.predictions
    }
  };
}

// ============================================================================
// STORAGE AND RETRIEVAL
// ============================================================================

/**
 * Store analysis in Firebase for persistence
 */
async function storeAnalysisInFirebase(agentInsights, source) {
  try {
    // Get Firebase instance
    let db;
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
      db = getFirestore(app);
    } catch (error) {
      console.error('Firebase not available for storing analysis:', error);
      throw new Error('Firebase initialization failed: ' + error.message);
    }

    // Store each agent's insights
    for (const [agent, data] of Object.entries(agentInsights)) {
      await addDoc(collection(db, 'weeklyAnalysis'), {
        agent,
        source,
        timestamp: new Date(),
        ...data
      });
    }
    
    console.log('📁 Weekly analysis stored in Firebase');
  } catch (error) {
    console.error('Failed to store analysis:', error);
  }
}

/**
 * Retrieve recent analysis for agent
 */
export async function getRecentAnalysisForAgent(agentName, daysBack = 7) {
  try {
    let db;
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
      db = getFirestore(app);
    } catch (error) {
      return []; // Return empty if Firebase not available
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const q = query(
      collection(db, 'weeklyAnalysis'),
      where('agent', '==', agentName),
      where('timestamp', '>=', cutoffDate),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
    
  } catch (error) {
    console.error('Failed to retrieve analysis:', error);
    return [];
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractContext(fullText, match, contextLength = 100) {
  const index = fullText.toLowerCase().indexOf(match.toLowerCase());
  if (index === -1) return match;
  
  const start = Math.max(0, index - contextLength);
  const end = Math.min(fullText.length, index + match.length + contextLength);
  
  return fullText.substring(start, end).trim();
}

function extractPriceLevel(text) {
  const priceMatch = text.match(/\$?\d+[,\d]*/);
  return priceMatch ? priceMatch[0].replace(/[,$]/g, '') : null;
}

function extractKeyQuotes(transcript) {
  // Simple implementation - look for sentences with strong language
  const sentences = transcript.split(/[.!?]+/);
  
  return sentences
    .filter(sentence => {
      const s = sentence.toLowerCase();
      return s.includes('bullish') || 
             s.includes('bearish') || 
             s.includes('target') ||
             s.includes('expect') ||
             s.includes('predict');
    })
    .map(s => s.trim())
    .slice(0, 10); // Limit to 10 key quotes
}

function extractPredictions(transcript) {
  const predictions = [];
  const lines = transcript.split('\n');
  
  lines.forEach(line => {
    if (line.toLowerCase().includes('target') || 
        line.toLowerCase().includes('expect') ||
        line.toLowerCase().includes('predict')) {
      predictions.push(line.trim());
    }
  });
  
  return predictions.slice(0, 5);
}

function extractWarnings(transcript) {
  const warnings = [];
  const lines = transcript.split('\n');
  
  lines.forEach(line => {
    if (line.toLowerCase().includes('warning') || 
        line.toLowerCase().includes('risk') ||
        line.toLowerCase().includes('danger') ||
        line.toLowerCase().includes('careful')) {
      warnings.push(line.trim());
    }
  });
  
  return warnings.slice(0, 5);
}

// ============================================================================
// KNOWLEDGE BASE UPDATE
// ============================================================================

/**
 * Update agent knowledge bases with new insights
 */
async function updateAgentKnowledge(agentInsights) {
  // This would integrate with your existing knowledge system
  // For now, we'll store the insights for retrieval during prompt building
  
  for (const [agent, insights] of Object.entries(agentInsights)) {
    console.log(`📈 Updated ${agent} knowledge with ${insights.insights?.length || 0} new insights`);
  }
}

export default {
  processWeeklyAnalysis,
  getRecentAnalysisForAgent,
  extractMarketInsights
};