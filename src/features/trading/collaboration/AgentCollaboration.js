// Agent Collaboration System
// Manages continuous discussion and learning between agents

import { collection, doc, setDoc, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/utilities/firebaseClient';
import { getKnowledgeBase } from '../knowledge/KnowledgeBase';
import { callSentimentOracle } from '../agents/sentiment-oracle';
import { callMarketAnalyst } from '../agents/market-analyst';
import { callMacroSpecialist } from '../agents/macro-specialist';
import { callRL80Trader } from '../agents/rl80-trader';

class AgentCollaboration {
  constructor() {
    // Use existing Firebase instance from firebaseClient
    this.db = db;
    this.knowledgeBase = getKnowledgeBase();
    
    // Collaboration settings - DEV MODE (reduced frequency)
    const isDev = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEV_MODE === 'true';
    
    // Development: 30 min discussions, Production: 5 min
    this.discussionInterval = isDev ? 30 * 60 * 1000 : 5 * 60 * 1000;
    // Development: 60 min learning, Production: 15 min
    this.learningInterval = isDev ? 60 * 60 * 1000 : 15 * 60 * 1000;
    this.maxChatHistory = isDev ? 50 : 100; // Fewer messages in dev
    
    // Dev mode flags
    this.isDevelopment = isDev;
    this.useMockResponses = process.env.NEXT_PUBLIC_USE_MOCK_AGENTS === 'true';
    
    // In mock mode, enable all agents (they won't make real API calls)
    // In real mode, check individual settings
    this.enabledAgents = this.useMockResponses ? {
      sentiment: true,  // Enabled in mock mode
      market: true,     // Enabled in mock mode
      macro: true,      // Enabled in mock mode
      rl80: true        // Always enabled
    } : {
      sentiment: process.env.NEXT_PUBLIC_ENABLE_SENTIMENT !== 'false',
      market: process.env.NEXT_PUBLIC_ENABLE_MARKET !== 'false',
      macro: process.env.NEXT_PUBLIC_ENABLE_MACRO !== 'false',
      rl80: true // Always enabled (no API cost)
    };
    
    // State
    this.isRunning = false;
    this.discussionTimer = null;
    this.learningTimer = null;
    this.chatHistory = [];
    this.currentTopic = null;
    
    // Collections - Firebase requires odd number of segments
    this.chatCol = collection(this.db, 'collaboration_messages');
    this.topicsCol = collection(this.db, 'collaboration_topics');
    
    // Agent states
    this.agentStates = {
      sentiment: { lastUpdate: null, confidence: 0.5, learningProgress: 0 },
      market: { lastUpdate: null, confidence: 0.5, learningProgress: 0 },
      macro: { lastUpdate: null, confidence: 0.5, learningProgress: 0 },
      rl80: { lastUpdate: null, confidence: 0.5, learningProgress: 0 }
    };
  }

  async start() {
    if (this.isRunning) return;
    
    console.log('[Collaboration] Starting agent collaboration system');
    if (this.isDevelopment) {
      console.log('[Dev Mode] Running with reduced API calls:');
      console.log(`- Discussions every ${this.discussionInterval / 60000} minutes`);
      console.log(`- Learning every ${this.learningInterval / 60000} minutes`);
      console.log(`- Mock responses: ${this.useMockResponses}`);
      console.log(`- Enabled agents:`, this.enabledAgents);
    }
    this.isRunning = true;
    
    // Load chat history
    await this.loadChatHistory();
    
    // Subscribe to real-time chat updates
    this.subscribeToChatUpdates();
    
    // Start discussion cycle
    this.startDiscussionCycle();
    
    // Start learning cycle
    this.startLearningCycle();
    
    // Initial discussion
    await this.initiateDiscussion('market_analysis');
  }

  async loadChatHistory() {
    try {
      const q = query(
        this.chatCol,
        orderBy('timestamp', 'desc'),
        limit(this.maxChatHistory)
      );
      
      const snapshot = await getDocs(q);
      this.chatHistory = [];
      
      snapshot.forEach(doc => {
        this.chatHistory.unshift(doc.data());
      });
      
      console.log(`[Collaboration] Loaded ${this.chatHistory.length} historical messages`);
    } catch (error) {
      console.log('[Collaboration] No chat history yet, starting fresh');
      this.chatHistory = [];
    }
  }

  subscribeToChatUpdates() {
    const q = query(
      this.chatCol,
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const message = change.doc.data();
          
          // Add to local history if not already present
          if (!this.chatHistory.find(m => m.id === message.id)) {
            this.chatHistory.push(message);
            
            // Trim history to max size
            if (this.chatHistory.length > this.maxChatHistory) {
              this.chatHistory.shift();
            }
            
            // Trigger UI update
            this.notifyUIUpdate(message);
          }
        }
      });
    });
  }

  startDiscussionCycle() {
    if (this.isDevelopment) {
      console.log(`[Dev Mode] Discussion cycle set to ${this.discussionInterval / 60000} minutes`);
    }
    
    this.discussionTimer = setInterval(async () => {
      // Select discussion topic based on market conditions
      const topic = await this.selectDiscussionTopic();
      await this.initiateDiscussion(topic);
    }, this.discussionInterval);
  }

  startLearningCycle() {
    this.learningTimer = setInterval(async () => {
      await this.performLearningCycle();
    }, this.learningInterval);
  }

  async selectDiscussionTopic() {
    // Get current market data
    const marketData = await this.getMarketData();
    
    // Topics based on market conditions
    const topics = [
      { name: 'market_analysis', weight: 1 },
      { name: 'risk_assessment', weight: marketData.volatility > 30 ? 2 : 0.5 },
      { name: 'entry_opportunities', weight: marketData.rsi < 40 ? 2 : 0.5 },
      { name: 'exit_strategies', weight: marketData.rsi > 70 ? 2 : 0.5 },
      { name: 'macro_outlook', weight: 1 },
      { name: 'sentiment_check', weight: 1 },
      { name: 'performance_review', weight: this.chatHistory.length % 20 === 0 ? 3 : 0.5 }
    ];
    
    // Weighted random selection
    const totalWeight = topics.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const topic of topics) {
      random -= topic.weight;
      if (random <= 0) {
        return topic.name;
      }
    }
    
    return 'market_analysis';
  }

  async initiateDiscussion(topic) {
    console.log(`[Collaboration] Starting discussion on: ${topic}`);
    this.currentTopic = topic;
    
    // Get relevant knowledge for context
    const knowledge = await this.knowledgeBase.getRelevantKnowledge({
      marketCondition: await this.getCurrentMarketCondition()
    });
    
    // Create discussion context
    const context = {
      topic,
      timestamp: Date.now(),
      marketData: await this.getMarketData(),
      recentHistory: this.chatHistory.slice(-10),
      knowledge: {
        patterns: knowledge.patterns.slice(0, 3),
        lessons: knowledge.lessons.slice(0, 3),
        rules: knowledge.rules.slice(0, 3)
      },
      agentStates: this.agentStates
    };
    
    // Agents discuss in sequence, building on each other's insights
    const messages = [];
    
    // 1. Sentiment Oracle starts with market vibe
    const sentimentResponse = await this.getAgentResponse('sentiment', topic, context, messages);
    if (sentimentResponse) {
      messages.push(sentimentResponse);
      await this.saveMessage(sentimentResponse);
    }
    
    // 2. Market Analyst adds technical perspective
    const marketResponse = await this.getAgentResponse('market', topic, context, messages);
    if (marketResponse) {
      messages.push(marketResponse);
      await this.saveMessage(marketResponse);
    }
    
    // 3. Macro Specialist provides big picture
    const macroResponse = await this.getAgentResponse('macro', topic, context, messages);
    if (macroResponse) {
      messages.push(macroResponse);
      await this.saveMessage(macroResponse);
    }
    
    // 4. RL80 Trader synthesizes and decides
    const rl80Response = await this.getAgentResponse('rl80', topic, context, messages);
    if (rl80Response) {
      messages.push(rl80Response);
      await this.saveMessage(rl80Response);
      
      // Extract features/trading decision if present
      await this.processTradingDecision(rl80Response);
    }
    
    // Record discussion outcome for learning
    await this.recordDiscussionOutcome(topic, messages);
  }

  async getAgentResponse(agentName, topic, context, previousMessages) {
    try {
      // Skip disabled agents in dev mode
      if (!this.enabledAgents[agentName]) {
        console.log(`[Dev Mode] Skipping disabled agent: ${agentName}`);
        return null;
      }
      
      // Use mock responses in development to save API costs
      if (this.useMockResponses && agentName !== 'rl80') {
        return this.getMockAgentResponse(agentName, topic);
      }
      
      // Build agent-specific prompt
      const prompt = this.buildAgentPrompt(agentName, topic, context, previousMessages);
      
      let response;
      switch (agentName) {
        case 'sentiment':
          response = await callSentimentOracle({ prompt, context });
          break;
        case 'market':
          response = await callMarketAnalyst({ prompt, context });
          break;
        case 'macro':
          response = await callMacroSpecialist({ prompt, context });
          break;
        case 'rl80':
          response = await callRL80Trader({ prompt, context, teamMessages: previousMessages });
          break;
      }
      
      if (response && response.message) {
        // Update agent state
        this.agentStates[agentName].lastUpdate = Date.now();
        this.agentStates[agentName].confidence = response.confidence || 0.5;
        
        return {
          id: `msg_${Date.now()}_${agentName}`,
          timestamp: Date.now(),
          agent: agentName,
          topic,
          message: response.message,
          confidence: response.confidence,
          data: response.data || {}
        };
      }
    } catch (error) {
      console.error(`[Collaboration] Error getting ${agentName} response:`, error);
    }
    
    return null;
  }

  buildAgentPrompt(agentName, topic, context, previousMessages) {
    const basePrompt = `Current topic: ${topic}\n`;
    
    // Add market context
    let prompt = basePrompt + `\nMarket Data:\n`;
    prompt += `- BTC Price: $${context.marketData.btcPrice}\n`;
    prompt += `- RSI: ${context.marketData.rsi}\n`;
    prompt += `- Volume: ${context.marketData.volume}\n`;
    
    // Add previous messages in discussion
    if (previousMessages.length > 0) {
      prompt += `\n\nTeam Discussion So Far:\n`;
      previousMessages.forEach(msg => {
        prompt += `${msg.agent}: ${msg.message.substring(0, 200)}...\n`;
      });
    }
    
    // Add relevant knowledge
    if (context.knowledge.lessons.length > 0) {
      prompt += `\n\nRelevant Lessons Learned:\n`;
      context.knowledge.lessons.forEach(lesson => {
        prompt += `- ${lesson.insight}\n`;
      });
    }
    
    // Add agent-specific context
    switch (agentName) {
      case 'sentiment':
        prompt += `\n\nAnalyze crowd sentiment and social signals for this ${topic} discussion.`;
        break;
      case 'market':
        prompt += `\n\nProvide technical analysis perspective on ${topic}.`;
        break;
      case 'macro':
        prompt += `\n\nShare macro economic insights relevant to ${topic}.`;
        break;
      case 'rl80':
        prompt += `\n\nSynthesize team insights and provide features/trading decision for ${topic}.`;
        break;
    }
    
    return prompt;
  }

  async performLearningCycle() {
    console.log('[Collaboration] Performing learning cycle');
    
    // Analyze recent performance
    const recentTrades = await this.getRecentTrades();
    const performance = this.calculatePerformance(recentTrades);
    
    // Record performance metrics
    await this.knowledgeBase.recordPerformanceMetric({
      period: 'learning_cycle',
      trades: recentTrades.length,
      winRate: performance.winRate,
      pnl: performance.totalPnl,
      sharpeRatio: performance.sharpeRatio,
      maxDrawdown: performance.maxDrawdown,
      marketRegime: await this.getCurrentMarketCondition(),
      volatility: performance.volatility,
      trend: performance.trend,
      agentMetrics: this.calculateAgentMetrics(recentTrades)
    });
    
    // Identify patterns from successful trades
    for (const trade of recentTrades.filter(t => t.pnl > 0)) {
      await this.knowledgeBase.recordTradingPattern({
        market: trade.market,
        price: trade.entryPrice,
        volume: trade.volume,
        rsi: trade.indicators?.rsi,
        type: trade.patternType,
        setup: trade.setup,
        outcome: 'success',
        pnl: trade.pnl,
        duration: trade.duration,
        agentAnalysis: trade.agentAnalysis,
        confidence: trade.confidence
      });
    }
    
    // Extract lessons from failures
    for (const trade of recentTrades.filter(t => t.pnl < 0)) {
      const lesson = await this.extractLessonFromFailure(trade);
      if (lesson) {
        await this.knowledgeBase.recordLesson(lesson);
      }
    }
    
    // Update agent learning progress
    this.updateAgentLearningProgress(performance);
  }

  updateAgentLearningProgress(performance) {
    // Increase learning progress based on performance
    const learningRate = 0.05;
    
    Object.keys(this.agentStates).forEach(agent => {
      const currentProgress = this.agentStates[agent].learningProgress;
      const performanceBoost = performance.winRate > 0.5 ? learningRate : -learningRate / 2;
      
      this.agentStates[agent].learningProgress = Math.max(0, Math.min(1, 
        currentProgress + performanceBoost
      ));
    });
  }

  async saveMessage(message) {
    const messageDoc = doc(this.chatCol, message.id);
    await setDoc(messageDoc, message);
  }

  async getMarketData() {
    // Get from Lighter WebSocket Manager or fallback
    // This would integrate with your existing market data feeds
    return {
      btcPrice: 95000,
      ethPrice: 3200,
      rsi: 55,
      volume: 1000000,
      volatility: 25,
      fundingRate: 0.01
    };
  }

  async getCurrentMarketCondition() {
    const marketData = await this.getMarketData();
    
    if (marketData.volatility > 40) return 'high_volatility';
    if (marketData.rsi > 70) return 'overbought';
    if (marketData.rsi < 30) return 'oversold';
    if (marketData.volatility < 15) return 'low_volatility';
    
    return 'neutral';
  }
  
  getMockAgentResponse(agentName, topic) {
    const timestamp = Date.now();
    const mockResponses = {
      sentiment: {
        market_analysis: 'Crowd sentiment is cautiously optimistic. Seeing moderate FOMO building.',
        risk_assessment: 'Fear index showing neutral levels. No extreme greed or panic.',
        entry_opportunities: 'Social chatter picking up on dip buying opportunities.',
        exit_strategies: 'Sentiment getting frothy, might be time to take some profits.',
        macro_outlook: 'Crowd focusing on Fed pivot narrative.',
        sentiment_check: 'Overall vibe: neutral with slight bullish tilt.',
        performance_review: 'My sentiment calls have been on point lately!'
      },
      market: {
        market_analysis: 'BTC holding above 95k support. RSI at 55, neutral zone.',
        risk_assessment: 'Technical indicators mixed. Volatility within normal range.',
        entry_opportunities: 'Watching for bounce off 94k support level.',
        exit_strategies: 'Resistance at 98k. Consider scaling out there.',
        macro_outlook: 'Charts showing consolidation pattern.',
        sentiment_check: 'Price action suggests accumulation phase.',
        performance_review: 'Technical levels holding as predicted.'
      },
      macro: {
        market_analysis: 'DXY stable at 104. Macro conditions neutral for risk.',
        risk_assessment: 'No major central bank events this week.',
        entry_opportunities: 'Liquidity conditions supportive for risk-on.',
        exit_strategies: 'Watch for DXY breakout above 105.',
        macro_outlook: 'Fed likely to hold rates steady.',
        sentiment_check: 'Global liquidity remains ample.',
        performance_review: 'Macro calls aligned with market moves.'
      }
    };
    
    const message = mockResponses[agentName]?.[topic] || `${agentName} analyzing ${topic}...`;
    
    return {
      id: `mock_msg_${timestamp}_${agentName}`,
      timestamp,
      agent: agentName,
      topic,
      message: `[MOCK] ${message}`,
      confidence: 0.5 + Math.random() * 0.3,
      data: { mock: true }
    };
  }

  notifyUIUpdate(message) {
    // Emit event for UI to update
    if (typeof window !== 'undefined') {
      // Send to both the AgentChatDisplay and the existing TradingOverlay chat
      window.dispatchEvent(new CustomEvent('agentMessage', { detail: message }));
      
      // Also send to TradingOverlay's chat system
      window.dispatchEvent(new CustomEvent('features/tradingTeamMessage', { 
        detail: {
          type: message.agent,
          consultant: message.agent,
          message: message.message,
          timestamp: message.timestamp,
          confidence: message.confidence
        }
      }));
    }
  }
  
  // Helper methods for testing
  async getRecentTrades() {
    // Placeholder - would fetch from your trades collection
    return [];
  }
  
  calculatePerformance(trades) {
    // Basic performance calculation
    const wins = trades.filter(t => t.pnl > 0).length;
    const losses = trades.filter(t => t.pnl < 0).length;
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    return {
      winRate: trades.length > 0 ? wins / trades.length : 0,
      totalPnl,
      sharpeRatio: 0,
      maxDrawdown: 0,
      volatility: 20,
      trend: 'neutral'
    };
  }
  
  calculateAgentMetrics(trades) {
    // Placeholder for agent performance metrics
    return {
      sentiment: { accuracy: 0.5, contribution: 0.25 },
      market: { accuracy: 0.5, contribution: 0.25 },
      macro: { accuracy: 0.5, contribution: 0.25 },
      rl80: { accuracy: 0.5, contribution: 0.25 }
    };
  }
  
  async extractLessonFromFailure(trade) {
    // Basic lesson extraction
    return {
      title: `Loss Analysis`,
      description: `Trade resulted in ${trade.pnl} loss`,
      category: 'trade_failure',
      marketCondition: 'neutral',
      triggeringEvent: 'unknown',
      impact: 'negative',
      severity: Math.abs(trade.pnl) > 100 ? 8 : 5,
      actionableInsight: 'Review entry criteria',
      preventativeMeasure: 'Tighten stop loss',
      agentContributions: {}
    };
  }
  
  async recordDiscussionOutcome(topic, messages) {
    // Record the discussion for learning
    console.log(`[Collaboration] Discussion on ${topic} completed with ${messages.length} messages`);
  }
  
  async processTradingDecision(response) {
    // Process any features/trading decision from RL80
    if (response && response.data && response.data.decision) {
      console.log('[Collaboration] Trading decision:', response.data.decision);
      // Would execute trade here
    }
  }

  stop() {
    this.isRunning = false;
    
    if (this.discussionTimer) {
      clearInterval(this.discussionTimer);
    }
    
    if (this.learningTimer) {
      clearInterval(this.learningTimer);
    }
    
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Singleton instance
let instance = null;

export const getAgentCollaboration = () => {
  if (!instance) {
    instance = new AgentCollaboration();
  }
  return instance;
};

export default AgentCollaboration;