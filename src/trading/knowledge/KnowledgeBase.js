// Knowledge Base System for Agent Learning
// Stores trading patterns, lessons learned, and performance metrics

import { collection, doc, setDoc, getDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { db } from '@/utilities/firebaseClient';

class KnowledgeBase {
  constructor() {
    // Use existing Firebase instance from firebaseClient
    this.db = db;
    this.storage = getStorage();
    
    // Collections - Firebase requires odd number of segments
    this.tradingPatternsCol = collection(this.db, 'knowledge_patterns');
    this.lessonsLearnedCol = collection(this.db, 'knowledge_lessons');
    this.marketConditionsCol = collection(this.db, 'market_conditions');
    this.performanceMetricsCol = collection(this.db, 'performance_metrics');
    
    // In-memory cache for fast access
    this.cache = {
      patterns: new Map(),
      lessons: new Map(),
      conditions: new Map(),
      metrics: new Map()
    };
    
    // Learning parameters
    this.learningRate = 0.1;
    this.confidenceThreshold = 0.7;
  }

  // ============= PATTERN LEARNING =============
  
  async recordTradingPattern(pattern) {
    const patternDoc = {
      id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      
      // Market context
      market: pattern.market || 'BTC-PERP',
      price: pattern.price,
      volume: pattern.volume,
      
      // Technical indicators at time
      indicators: {
        rsi: pattern.rsi,
        macd: pattern.macd,
        bb: pattern.bollingerBands,
        volume: pattern.volumeProfile
      },
      
      // Pattern details
      type: pattern.type, // 'breakout', 'reversal', 'continuation', etc.
      setup: pattern.setup,
      
      // Outcome
      outcome: pattern.outcome, // 'success', 'failure', 'partial'
      pnl: pattern.pnl,
      duration: pattern.duration,
      
      // Agent insights
      agentAnalysis: pattern.agentAnalysis || {},
      confidence: pattern.confidence || 0.5,
      
      // Learning metadata
      reinforced: false,
      reinforcementCount: 0,
      successRate: pattern.outcome === 'success' ? 1 : 0
    };
    
    // Store in Firestore
    await setDoc(doc(this.tradingPatternsCol, patternDoc.id), patternDoc);
    
    // Update cache
    this.cache.patterns.set(patternDoc.id, patternDoc);
    
    // Trigger pattern recognition learning
    await this.reinforcePatternLearning(patternDoc);
    
    return patternDoc.id;
  }
  
  async reinforcePatternLearning(newPattern) {
    // Find similar patterns
    const similarPatterns = await this.findSimilarPatterns(newPattern);
    
    if (similarPatterns.length > 0) {
      // Calculate success rate of similar patterns
      const successCount = similarPatterns.filter(p => p.outcome === 'success').length;
      const successRate = successCount / similarPatterns.length;
      
      // Update confidence based on historical performance
      const updatedConfidence = this.calculateConfidence(successRate, similarPatterns.length);
      
      // Store pattern relationship
      await this.storePatternRelationship(newPattern, similarPatterns, updatedConfidence);
      
      // If high confidence pattern, add to quick-access rules
      if (updatedConfidence > this.confidenceThreshold) {
        await this.addToTradingRules(newPattern, updatedConfidence);
      }
    }
  }
  
  async findSimilarPatterns(pattern, threshold = 0.8) {
    try {
      // Simplified query to avoid index requirement
      const q = query(
        this.tradingPatternsCol,
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const patterns = [];
      
      // Filter in memory
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Check if pattern matches criteria
        if ((!pattern.type || data.type === pattern.type) &&
            (!pattern.market || data.market === pattern.market)) {
          const similarity = this.calculateSimilarity(pattern, data);
          
          if (similarity > threshold) {
            patterns.push({ ...data, similarity });
          }
        }
      });
      
      // Sort and limit
      return patterns
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 50);
    } catch (error) {
      console.log('[KnowledgeBase] Patterns query skipped (no data yet)');
      return [];
    }
  }
  
  calculateSimilarity(pattern1, pattern2) {
    let score = 0;
    let weights = 0;
    
    // RSI similarity (weight: 0.2)
    if (pattern1.indicators?.rsi && pattern2.indicators?.rsi) {
      const rsiDiff = Math.abs(pattern1.indicators.rsi - pattern2.indicators.rsi);
      score += (1 - rsiDiff / 100) * 0.2;
      weights += 0.2;
    }
    
    // Price action similarity (weight: 0.3)
    if (pattern1.price && pattern2.price) {
      const priceDiff = Math.abs((pattern1.price - pattern2.price) / pattern1.price);
      score += Math.max(0, 1 - priceDiff * 10) * 0.3;
      weights += 0.3;
    }
    
    // Volume profile similarity (weight: 0.2)
    if (pattern1.volume && pattern2.volume) {
      const volumeDiff = Math.abs((pattern1.volume - pattern2.volume) / pattern1.volume);
      score += Math.max(0, 1 - volumeDiff * 5) * 0.2;
      weights += 0.2;
    }
    
    // Setup similarity (weight: 0.3)
    if (pattern1.setup === pattern2.setup) {
      score += 0.3;
      weights += 0.3;
    }
    
    return weights > 0 ? score / weights : 0;
  }
  
  calculateConfidence(successRate, sampleSize) {
    // Wilson score confidence interval for binomial proportion
    const z = 1.96; // 95% confidence
    const n = sampleSize;
    const p = successRate;
    
    if (n === 0) return 0.5;
    
    const denominator = 1 + z * z / n;
    const centre = (p + z * z / (2 * n)) / denominator;
    const offset = z * Math.sqrt((p * (1 - p) / n + z * z / (4 * n * n))) / denominator;
    
    // Return lower bound of confidence interval
    return Math.max(0, Math.min(1, centre - offset));
  }
  
  // ============= LESSON LEARNING =============
  
  async recordLesson(lesson) {
    const lessonDoc = {
      id: `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      
      // Lesson details
      title: lesson.title,
      description: lesson.description,
      category: lesson.category, // 'risk_management', 'entry_timing', 'exit_strategy', etc.
      
      // Context
      marketCondition: lesson.marketCondition,
      triggeringEvent: lesson.triggeringEvent,
      
      // Impact
      impact: lesson.impact, // 'positive', 'negative', 'neutral'
      severity: lesson.severity, // 1-10
      
      // Application
      actionableInsight: lesson.actionableInsight,
      preventativeMeasure: lesson.preventativeMeasure,
      
      // Agent contributions
      agentContributions: lesson.agentContributions || {},
      
      // Validation
      validated: false,
      applicationCount: 0,
      successfulApplications: 0
    };
    
    await setDoc(doc(this.lessonsLearnedCol, lessonDoc.id), lessonDoc);
    this.cache.lessons.set(lessonDoc.id, lessonDoc);
    
    // Integrate lesson into decision-making
    await this.integrateLessonIntoStrategy(lessonDoc);
    
    return lessonDoc.id;
  }
  
  async integrateLessonIntoStrategy(lesson) {
    // Create or update trading rule based on lesson
    if (lesson.actionableInsight) {
      const rule = {
        id: `rule_${lesson.id}`,
        source: 'lesson',
        sourceId: lesson.id,
        condition: lesson.triggeringEvent,
        action: lesson.actionableInsight,
        priority: lesson.severity,
        active: true,
        created: Date.now()
      };
      
      await this.addToTradingRules(rule);
    }
  }
  
  // ============= PERFORMANCE TRACKING =============
  
  async recordPerformanceMetric(metric) {
    const metricDoc = {
      id: `metric_${Date.now()}`,
      timestamp: Date.now(),
      
      // Performance data
      period: metric.period, // 'hourly', 'daily', 'weekly'
      trades: metric.trades,
      winRate: metric.winRate,
      pnl: metric.pnl,
      sharpeRatio: metric.sharpeRatio,
      maxDrawdown: metric.maxDrawdown,
      
      // Market context
      marketRegime: metric.marketRegime,
      volatility: metric.volatility,
      trend: metric.trend,
      
      // Agent performance
      agentMetrics: metric.agentMetrics || {},
      
      // Learning insights
      strengths: metric.strengths || [],
      weaknesses: metric.weaknesses || [],
      improvements: metric.improvements || []
    };
    
    await setDoc(doc(this.performanceMetricsCol, metricDoc.id), metricDoc);
    this.cache.metrics.set(metricDoc.id, metricDoc);
    
    // Trigger performance-based learning
    await this.analyzePerformanceForLearning(metricDoc);
    
    return metricDoc.id;
  }
  
  async analyzePerformanceForLearning(metric) {
    // Identify patterns in wins vs losses
    if (metric.winRate < 0.4) {
      // Poor performance - identify what went wrong
      const lesson = {
        title: 'Low Win Rate Period Analysis',
        description: `Win rate dropped to ${metric.winRate} during ${metric.marketRegime} market`,
        category: 'performance_analysis',
        marketCondition: metric.marketRegime,
        impact: 'negative',
        severity: 8,
        actionableInsight: 'Reduce position size in similar market conditions',
        agentContributions: metric.agentMetrics
      };
      
      await this.recordLesson(lesson);
    } else if (metric.winRate > 0.7) {
      // Excellent performance - identify what worked
      const lesson = {
        title: 'High Performance Period Analysis',
        description: `Achieved ${metric.winRate} win rate during ${metric.marketRegime} market`,
        category: 'performance_analysis',
        marketCondition: metric.marketRegime,
        impact: 'positive',
        severity: 9,
        actionableInsight: 'Increase confidence in similar market conditions',
        agentContributions: metric.agentMetrics
      };
      
      await this.recordLesson(lesson);
    }
  }
  
  // ============= KNOWLEDGE RETRIEVAL =============
  
  async getRelevantKnowledge(context) {
    const knowledge = {
      patterns: [],
      lessons: [],
      rules: [],
      metrics: []
    };
    
    // Get relevant patterns
    if (context.market && context.indicators) {
      knowledge.patterns = await this.findSimilarPatterns(context, 0.6);
    }
    
    // Get applicable lessons - simplified query to avoid index requirement
    if (context.marketCondition) {
      try {
        const lessonsQuery = query(
          this.lessonsLearnedCol,
          orderBy('severity', 'desc'),
          limit(10)
        );
        
        const lessonsSnapshot = await getDocs(lessonsQuery);
        
        // Filter in memory to avoid complex index
        lessonsSnapshot.forEach(doc => {
          const lesson = doc.data();
          if (lesson.marketCondition === context.marketCondition) {
            knowledge.lessons.push(lesson);
          }
        });
        
        // Limit to top 5 after filtering
        knowledge.lessons = knowledge.lessons.slice(0, 5);
      } catch (error) {
        console.log('[KnowledgeBase] Lessons query skipped (no data yet)');
        // No lessons yet, that's fine for initial setup
      }
    }
    
    // Get active trading rules
    knowledge.rules = await this.getActiveTradingRules();
    
    // Get recent performance metrics
    try {
      const metricsQuery = query(
        this.performanceMetricsCol,
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      
      const metricsSnapshot = await getDocs(metricsQuery);
      metricsSnapshot.forEach(doc => {
        knowledge.metrics.push(doc.data());
      });
    } catch (error) {
      console.log('[KnowledgeBase] Metrics query skipped (no data yet)');
      // No metrics yet, that's fine
    }
    
    return knowledge;
  }
  
  // ============= TRADING RULES =============
  
  async addToTradingRules(rule, confidence = null) {
    const rulesDoc = doc(this.db, 'trading_rules', rule.id || `rule_${Date.now()}`);
    
    const ruleData = {
      ...rule,
      confidence: confidence || rule.confidence || 0.5,
      active: true,
      created: Date.now(),
      lastUsed: null,
      useCount: 0,
      successCount: 0
    };
    
    await setDoc(rulesDoc, ruleData);
    return ruleData;
  }
  
  async getActiveTradingRules() {
    try {
      // Simplified query to avoid index requirement
      const rulesQuery = query(
        collection(this.db, 'trading_rules'),
        orderBy('confidence', 'desc'),
        limit(20)
      );
      
      const snapshot = await getDocs(rulesQuery);
      const rules = [];
      
      // Filter in memory
      snapshot.forEach(doc => {
        const rule = doc.data();
        if (rule.active !== false && rule.confidence > this.confidenceThreshold) {
          rules.push(rule);
        }
      });
      
      return rules;
    } catch (error) {
      console.log('[KnowledgeBase] Rules query skipped (no data yet)');
      return [];
    }
  }
  
  // ============= KNOWLEDGE EXPORT =============
  
  async exportKnowledgeForAgent(agentName) {
    const knowledge = await this.getRelevantKnowledge({});
    
    // Format for agent consumption
    const agentKnowledge = {
      timestamp: Date.now(),
      agent: agentName,
      
      // Summarized insights
      topPatterns: knowledge.patterns.slice(0, 10).map(p => ({
        type: p.type,
        setup: p.setup,
        successRate: p.successRate,
        confidence: p.confidence
      })),
      
      keyLessons: knowledge.lessons.map(l => ({
        insight: l.actionableInsight,
        condition: l.marketCondition,
        severity: l.severity
      })),
      
      activeRules: knowledge.rules.map(r => ({
        condition: r.condition,
        action: r.action,
        confidence: r.confidence
      })),
      
      recentPerformance: {
        avgWinRate: knowledge.metrics.reduce((acc, m) => acc + m.winRate, 0) / knowledge.metrics.length,
        bestConditions: knowledge.metrics.sort((a, b) => b.winRate - a.winRate)[0]?.marketRegime,
        worstConditions: knowledge.metrics.sort((a, b) => a.winRate - b.winRate)[0]?.marketRegime
      }
    };
    
    return agentKnowledge;
  }
}

// Singleton instance
let instance = null;

export const getKnowledgeBase = () => {
  if (!instance) {
    instance = new KnowledgeBase();
  }
  return instance;
};

export default KnowledgeBase;