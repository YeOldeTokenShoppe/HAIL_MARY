// Prayer Analysis Utilities for Firebase Functions
// Simplified version of the prayer analysis logic for server-side use

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

// Basic sentiment analysis without external API calls
function analyzeBasicSentiment(text) {
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
  } else {
    // Default distribution if no keywords found
    emotions.hope = 40;
    emotions.gratitude = 30;
    emotions.desperation = 20;
    emotions.celebration = 10;
  }
  
  // Calculate overall sentiment
  const positiveScore = (emotions.hope || 0) + (emotions.gratitude || 0) + (emotions.celebration || 0) + (emotions.devotion || 0);
  const negativeScore = (emotions.desperation || 0) + (emotions.fear || 0) + (emotions.confession || 0);
  const overall = (positiveScore - negativeScore) / 200; // Normalize to -1 to 1
  
  // Extract keywords
  const keywords = CRYPTO_KEYWORDS.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  ).slice(0, 5);
  
  return {
    overall_sentiment: overall,
    emotions,
    keywords: keywords.length > 0 ? keywords : ['prayer', 'hope', 'blessing'],
    timestamp: Date.now()
  };
}

// Analyze multiple prayers and aggregate results
async function analyzePrayers(prayers, apiKey) {
  // For now, use basic analysis since OpenAI calls from Firebase functions
  // require additional setup. We can enhance this later.
  const analyses = prayers.map(prayer => {
    const message = prayer.message || prayer.text || prayer;
    return analyzeBasicSentiment(message);
  });
  
  // Aggregate results
  if (analyses.length === 0) {
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
  
  // Collect all keywords
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
  
  // Generate trend (mock for now)
  const trend = generateTrend(avgSentiment);
  
  // Determine overall label
  let label = 'Steady';
  if (avgSentiment < -0.5) label = 'Despair';
  else if (avgSentiment < -0.2) label = 'Doubt';
  else if (avgSentiment > 0.5) label = 'Euphoric';
  else if (avgSentiment > 0.2) label = 'Hopeful';
  
  return {
    overall: (avgSentiment + 1) / 2, // Convert to 0-1 scale
    label,
    emotions: topEmotions,
    trend,
    keywords: topKeywords,
    totalAnalyzed: analyses.length
  };
}

// Generate AI summary (simplified for now)
async function generateSummary(prayers, apiKey) {
  // For now, generate a basic summary based on sentiment
  // We can add OpenAI integration later if needed
  
  const messages = prayers.map(p => p.message || p.text || p);
  const sampleMessage = messages[0] || '';
  
  // Basic sentiment-based summary
  const commonThemes = [];
  const lowerMessages = messages.map(m => m.toLowerCase()).join(' ');
  
  if (lowerMessages.includes('moon') || lowerMessages.includes('pump')) {
    commonThemes.push('celestial ascension');
  }
  if (lowerMessages.includes('help') || lowerMessages.includes('please')) {
    commonThemes.push('desperate supplication');
  }
  if (lowerMessages.includes('thank') || lowerMessages.includes('blessed')) {
    commonThemes.push('grateful devotion');
  }
  if (lowerMessages.includes('forgive') || lowerMessages.includes('sorry')) {
    commonThemes.push('penitent confessions');
  }
  
  const themes = commonThemes.length > 0 ? commonThemes.join(' and ') : 'hopeful prayers';
  
  return `The faithful congregation's prayers reveal ${themes} flowing through the digital sanctuary. ` +
         `Their offerings to Our Lady of Perpetual Profit echo with the eternal rhythms of market devotion, ` +
         `where spiritual yearning meets financial aspiration.`;
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

// Generate a trend based on current sentiment
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
    trend: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    keywords: ['waiting', 'for', 'prayers'],
    totalAnalyzed: 0
  };
}

module.exports = {
  analyzePrayers,
  generateSummary,
  EMOTION_CATEGORIES,
  CRYPTO_KEYWORDS
};