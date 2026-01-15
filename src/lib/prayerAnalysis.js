// AI Prayer Analysis Utilities
// Analyzes prayers/offerings for sentiment, emotions, and themes using OpenAI

import OpenAI from 'openai';

// Emotion categories we track
const EMOTION_CATEGORIES = {
  hope: ['hope', 'hopeful', 'optimistic', 'faith', 'believe', 'trust', 'confident'],
  gratitude: ['thank', 'grateful', 'blessed', 'appreciate', 'thankful', 'grace'],
  desperation: ['desperate', 'please', 'need', 'help', 'save', 'rescue', 'urgent'],
  confession: ['forgive', 'sorry', 'regret', 'mistake', 'wrong', 'confess', 'sin'],
  celebration: ['moon', 'lambo', 'rich', 'wealth', 'success', 'profit', 'gains'],
  fear: ['scared', 'afraid', 'worry', 'anxious', 'nervous', 'fear', 'panic'],
  greed: ['more', 'want', 'need', 'must have', 'gimme', 'mine', 'rich'],
  devotion: ['worship', 'praise', 'honor', 'serve', 'devoted', 'loyal', 'faithful']
};

// Common crypto prayer keywords
const CRYPTO_KEYWORDS = [
  'moon', 'lambo', 'diamond hands', 'hodl', 'pump', 'gains',
  'blessed', 'forgive', 'rug', 'liquidation', 'bear', 'bull',
  'whale', 'pleb', 'gm', 'wagmi', 'ngmi', 'ape', 'degen'
];

// Analyze a single prayer using OpenAI
export async function analyzePrayer(text, apiKey) {
  try {
    const openai = new OpenAI({ apiKey });
    
    const prompt = `Analyze this crypto prayer/offering for emotional content and sentiment.
    
Prayer: "${text}"

Provide a JSON response with:
1. overall_sentiment: number between -1 (negative) and 1 (positive)
2. emotions: object with scores (0-100) for: hope, gratitude, desperation, confession, celebration, fear, greed, devotion
3. main_theme: the primary emotional theme (one of the emotion categories)
4. keywords: array of 3-5 key words/phrases from the prayer
5. sentiment_label: one of "Despair", "Doubt", "Steady", "Hopeful", "Euphoric"

Respond ONLY with valid JSON, no additional text.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { 
          role: 'system', 
          content: 'You are a sentiment analysis expert specializing in crypto trading prayers and market psychology. Respond only with valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const response = completion.choices[0].message.content;
    
    // Parse the JSON response
    try {
      const analysis = JSON.parse(response);
      return {
        ...analysis,
        timestamp: Date.now(),
        text: text.substring(0, 100) // Store snippet for reference
      };
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response);
      // Fallback to basic analysis
      return basicAnalysis(text);
    }
  } catch (error) {
    console.error('OpenAI analysis failed:', error);
    // Fallback to basic keyword-based analysis
    return basicAnalysis(text);
  }
}

// Basic fallback analysis without AI
function basicAnalysis(text) {
  const lowerText = text.toLowerCase();
  const emotions = {};
  let totalScore = 0;
  
  // Count emotion keywords
  Object.entries(EMOTION_CATEGORIES).forEach(([emotion, keywords]) => {
    const count = keywords.reduce((sum, keyword) => {
      const regex = new RegExp(keyword, 'gi');
      const matches = lowerText.match(regex);
      return sum + (matches ? matches.length : 0);
    }, 0);
    emotions[emotion] = Math.min(count * 20, 100);
    totalScore += emotions[emotion];
  });
  
  // Normalize emotions to percentages
  if (totalScore > 0) {
    Object.keys(emotions).forEach(key => {
      emotions[key] = Math.round((emotions[key] / totalScore) * 100);
    });
  }
  
  // Calculate overall sentiment
  const positiveScore = (emotions.hope || 0) + (emotions.gratitude || 0) + (emotions.celebration || 0) + (emotions.devotion || 0);
  const negativeScore = (emotions.desperation || 0) + (emotions.fear || 0) + (emotions.confession || 0);
  const overall = (positiveScore - negativeScore) / 200; // Normalize to -1 to 1
  
  // Determine main theme
  const mainTheme = Object.entries(emotions).sort(([,a], [,b]) => b - a)[0]?.[0] || 'hope';
  
  // Extract keywords
  const keywords = CRYPTO_KEYWORDS.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  ).slice(0, 5);
  
  // Determine sentiment label
  let sentimentLabel = 'Steady';
  if (overall < -0.5) sentimentLabel = 'Despair';
  else if (overall < -0.2) sentimentLabel = 'Doubt';
  else if (overall > 0.5) sentimentLabel = 'Euphoric';
  else if (overall > 0.2) sentimentLabel = 'Hopeful';
  
  return {
    overall_sentiment: overall,
    emotions,
    main_theme: mainTheme,
    keywords: keywords.length > 0 ? keywords : ['pray', 'hope', 'blessed'],
    sentiment_label: sentimentLabel,
    timestamp: Date.now(),
    text: text.substring(0, 100),
    fallback: true // Mark as fallback analysis
  };
}

// Generate AI summary of prayer themes and sentiment
export async function generatePrayerSummary(prayers, apiKey) {
  try {
    const openai = new OpenAI({ apiKey });
    
    // Get a sample of prayers for summary (limit to avoid token limits)
    const samplePrayers = prayers.slice(0, 20).map(p => p.message || p.text || p);
    
    const prompt = `Analyze these recent prayers to 𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 𝔬𝔣 𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙 and write a 2-3 sentence summary of the congregation's spiritual temperature and common themes.

Recent prayers:
${samplePrayers.map((p, i) => `${i + 1}. "${p}"`).join('\n')}

Write a summary that captures:
- Overall mood/sentiment of the traders/congregation
- Common themes or concerns
- Spiritual atmosphere

Keep it mystical and trading-themed. Respond with ONLY the summary text, no additional formatting.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { 
          role: 'system', 
          content: 'You are a mystical analyst of trader prayers to Our Lady of Perpetual Profit. Write poetic but insightful summaries of the congregation\'s spiritual state.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Summary generation failed:', error);
    return null;
  }
}

// Analyze multiple prayers and aggregate results
export async function analyzePrayerBatch(prayers, apiKey) {
  const analyses = [];
  
  // Process in batches to avoid rate limits
  const BATCH_SIZE = 5;
  for (let i = 0; i < prayers.length; i += BATCH_SIZE) {
    const batch = prayers.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(prayer => analyzePrayer(prayer.message || prayer.text || prayer, apiKey))
    );
    analyses.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < prayers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return analyses;
}

// Aggregate multiple prayer analyses into overall stats
export function aggregateAnalyses(analyses) {
  if (!analyses || analyses.length === 0) {
    return getDefaultStats();
  }
  
  // Calculate average sentiment
  const avgSentiment = analyses.reduce((sum, a) => sum + a.overall_sentiment, 0) / analyses.length;
  
  // Aggregate emotions
  const emotionTotals = {};
  analyses.forEach(analysis => {
    Object.entries(analysis.emotions).forEach(([emotion, score]) => {
      emotionTotals[emotion] = (emotionTotals[emotion] || 0) + score;
    });
  });
  
  // Convert to percentages
  const totalEmotionScore = Object.values(emotionTotals).reduce((a, b) => a + b, 0);
  const emotionPercentages = {};
  Object.entries(emotionTotals).forEach(([emotion, total]) => {
    emotionPercentages[emotion] = Math.round((total / totalEmotionScore) * 100);
  });
  
  // Get top emotions for display
  const topEmotions = Object.entries(emotionPercentages)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: getEmotionColor(name)
    }));
  
  // Collect all keywords and find most common
  const keywordCounts = {};
  analyses.forEach(analysis => {
    (analysis.keywords || []).forEach(keyword => {
      keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
    });
  });
  
  const topKeywords = Object.entries(keywordCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 7)
    .map(([keyword]) => keyword);
  
  // Calculate trend (mock for now, would need historical data)
  const trend = generateTrend(avgSentiment);
  
  // Determine overall label
  let label = 'Steady';
  if (avgSentiment < -0.5) label = 'Despair';
  else if (avgSentiment < -0.2) label = 'Doubt';
  else if (avgSentiment > 0.5) label = 'Euphoric';
  else if (avgSentiment > 0.2) label = 'Hopeful';
  
  // Calculate prayers per hour (based on timestamps if available)
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  const recentPrayers = analyses.filter(a => a.timestamp > oneHourAgo).length;
  const prayersPerHour = recentPrayers || Math.round(analyses.length / 24); // Fallback estimate
  
  return {
    overall: (avgSentiment + 1) / 2, // Convert to 0-1 scale
    label,
    emotions: topEmotions,
    prayersPerHour,
    trend,
    keywords: topKeywords,
    lastUpdate: 'just now',
    totalAnalyzed: analyses.length
  };
}

// Get emotion color for visualization
function getEmotionColor(emotion) {
  const colors = {
    hope: '#4ade80',
    gratitude: '#a78bfa',
    desperation: '#f87171',
    confession: '#60a5fa',
    celebration: '#fbbf24',
    fear: '#ef4444',
    greed: '#f97316',
    devotion: '#e879f9'
  };
  return colors[emotion] || '#9ca3af';
}

// Generate a mock trend based on current sentiment
function generateTrend(currentSentiment) {
  const trend = [];
  let value = 0.5;
  
  // Generate 6 historical points
  for (let i = 0; i < 6; i++) {
    value += (Math.random() - 0.5) * 0.2;
    value = Math.max(0, Math.min(1, value));
    trend.push(value);
  }
  
  // Add current sentiment as final point
  trend.push((currentSentiment + 1) / 2);
  
  return trend;
}

// Get default stats when no data available
function getDefaultStats() {
  return {
    overall: 0.5,
    label: 'Steady',
    emotions: [
      { name: 'Hope', value: 30, color: '#4ade80' },
      { name: 'Gratitude', value: 25, color: '#a78bfa' },
      { name: 'Desperation', value: 20, color: '#f87171' },
      { name: 'Confession', value: 15, color: '#60a5fa' },
      { name: 'Celebration', value: 10, color: '#fbbf24' },
    ],
    prayersPerHour: 0,
    trend: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    keywords: ['waiting', 'for', 'prayers'],
    lastUpdate: 'no data',
    totalAnalyzed: 0
  };
}

export { EMOTION_CATEGORIES, CRYPTO_KEYWORDS };