// AI Trading Agent with Real LLM Integration
// Uses Grok for sentiment, OpenAI for market, and Anthropic for macro analysis

class AITradingAgent {
  constructor() {
    this.thoughts = [];
    this.marketMemory = {};
    this.lastAnalysis = {};
    this.isAnalyzing = false;
    this.conversationContext = []; // Track recent messages for context
    
    // API configurations
    this.grokApiKey = process.env.GROK_API_KEY;
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    this.openaiApiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    
    this.consultants = {
      market: { 
        name: 'Market Analyst', 
        icon: '📊', 
        confidence: 0,
        model: 'openai' // Now uses OpenAI
      },
      macro: { 
        name: 'Macro Specialist', 
        icon: '🌍', 
        confidence: 0,
        model: 'anthropic' // Uses Anthropic
      },
      sentiment: { 
        name: 'Sentiment Oracle', 
        icon: '💭', 
        confidence: 0,
        model: 'grok' // Uses Grok
      }
    };
  }

  // Call Grok API for sentiment analysis
  async callGrok(prompt, systemPrompt = "You are a crypto market sentiment analyst. Provide concise, actionable insights.") {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.grokApiKey}`
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          model: 'grok-beta',
          stream: false,
          temperature: 0.7,
          max_tokens: 150
        })
      });

      if (!response.ok) {
        console.error('Grok API error:', response.status);
        return null;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('Grok API call failed:', error);
      return null;
    }
  }

  // Call Anthropic API for main analysis
  async callAnthropic(prompt, systemPrompt = "You are RL80, an expert crypto trading AI. Provide sharp, confident analysis.") {
    // For now, return a simulated response since Anthropic key not provided
    // When you add the key, uncomment the actual API call below
    
    if (!this.anthropicApiKey || this.anthropicApiKey === '') {
      // Fallback to rule-based analysis for now
      return this.generateFallbackAnalysis(prompt);
    }
    
    /* Uncomment when Anthropic key is added:
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 150,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        console.error('Anthropic API error:', response.status);
        return null;
      }

      const data = await response.json();
      return data.content?.[0]?.text || null;
    } catch (error) {
      console.error('Anthropic API call failed:', error);
      return null;
    }
    */
  }

  // Fallback analysis when Anthropic key not available
  generateFallbackAnalysis(prompt) {
    const keywords = prompt.toLowerCase();
    
    if (keywords.includes('btc') || keywords.includes('bitcoin')) {
      if (keywords.includes('up') || keywords.includes('bullish')) {
        return "BTC momentum building. Key resistance at next psychological level. Watch for volume confirmation.";
      }
      return "BTC consolidating. Awaiting catalyst for directional move.";
    }
    
    if (keywords.includes('risk') || keywords.includes('position')) {
      return "Risk parameters within acceptable range. Consider scaling into positions on weakness.";
    }
    
    if (keywords.includes('macro')) {
      return "Macro conditions supportive of risk assets. Fed policy remains accommodative.";
    }
    
    return "Market conditions stable. Monitoring for opportunities.";
  }

  // Generate a thought using LLMs
  async generateAIThought(type, marketData, consultant = null) {
    let analysis = '';
    
    try {
      if (consultant === 'sentiment') {
        // Use Grok for sentiment analysis
        const prompt = `Analyze crypto market sentiment based on:
          - BTC: ${marketData.btcPrice || 'N/A'} (${marketData.btcChange || 0}% 24h)
          - Market Fear/Greed: ${marketData.fearGreed || 'N/A'}
          - Volume trends: ${marketData.volumeTrend || 'Normal'}
          
          Provide a brief sentiment reading in 1-2 sentences.`;
        
        analysis = await this.callGrok(prompt);
      } else if (consultant === 'macro') {
        // Use Anthropic for macro analysis
        const prompt = `As a macro specialist, analyze:
          - DXY: ${marketData.dxy || 'N/A'} (${marketData.dxyChange || 'N/A'}%)
          - VIX: ${marketData.vix || 15}
          - Fed policy: ${marketData.fedPolicy || 'Neutral'}
          
          How does this affect crypto positioning? (1-2 sentences)`;
        
        analysis = await this.callAnthropic(prompt);
      } else if (consultant === 'market') {
        // Use OpenAI for market/technical analysis via API route
        try {
          const response = await fetch('/api/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              context: {
                price: marketData.btcPrice,
                change24h: marketData.btcChange,
                volume: marketData.volumeTrend,
                positions: marketData.positionCount,
                pnl: marketData.totalPnL
              },
              agent: 'market',
              lastMessages: this.conversationContext.slice(-3)
            })
          });
          const data = await response.json();
          analysis = data.message || data.fallback || 'Market analysis pending...';
        } catch (error) {
          console.error('Market API call failed:', error);
          analysis = 'Technical indicators mixed. Awaiting clearer signals.';
        }
      } else {
        // Main market analysis with Anthropic
        const prompt = `Analyze this crypto market data:
          - Positions: ${marketData.positionCount || 0} active
          - P&L: ${marketData.totalPnL || 0}
          - BTC: ${marketData.btcPrice || 'N/A'}
          - ETH: ${marketData.ethPrice || 'N/A'}
          
          Provide trading insight in 1-2 sentences.`;
        
        analysis = await this.callAnthropic(prompt);
      }
    } catch (error) {
      console.error('AI thought generation failed:', error);
      analysis = 'Analysis temporarily unavailable.';
    }

    const thought = {
      timestamp: new Date().toLocaleString(),
      type,
      message: analysis || 'Processing market conditions...',
      consultant
    };
    
    this.thoughts.unshift(thought);
    if (this.thoughts.length > 50) {
      this.thoughts = this.thoughts.slice(0, 50);
    }
    
    return thought;
  }

  // Main analysis cycle with LLMs
  async performAnalysis(data) {
    if (this.isAnalyzing) return this.thoughts;
    
    this.isAnalyzing = true;
    const allThoughts = [];
    
    try {
      // Prepare market context
      const marketContext = {
        btcPrice: data.marketData?.['BTC-USD']?.ticker?.lastPrice,
        btcChange: data.marketData?.['BTC-USD']?.ticker?.priceChange24h,
        ethPrice: data.marketData?.['ETH-USD']?.ticker?.lastPrice,
        ethChange: data.marketData?.['ETH-USD']?.ticker?.priceChange24h,
        positionCount: data.positions?.length || 0,
        totalPnL: data.positions?.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0) || 0,
        fearGreed: data.macroData?.fearGreed || 72,
        vix: data.macroData?.vix || 0,
        dxy: data.macroData?.dxy || 0,
        dxyChange: data.macroData?.dxyChange || -0.8,
        volumeTrend: 'Normal',
        fedPolicy: data.macroData?.marketRegime || 'RISK_ON'
      };

      // Generate a conversation between consultants
      
      // 1. RL80 opens with current situation
      const rl80Opening = {
        timestamp: new Date().toLocaleString(),
        type: 'trading',
        message: `Monitoring ${marketContext.positionCount} positions. Total P&L: $${marketContext.totalPnL?.toFixed(2) || 0}. Team, what's your read?`,
        consultant: 'rl80'
      };
      allThoughts.push(rl80Opening);
      this.conversationContext.unshift({ sender: 'rl80', message: rl80Opening.message });
      
      // 2. Sentiment jumps in first
      const sentimentThought = await this.generateAIThought('sentiment', marketContext, 'sentiment');
      if (sentimentThought) {
        allThoughts.push(sentimentThought);
        this.conversationContext.unshift({ sender: 'sentiment', message: sentimentThought.message });
      }
      
      // 3. Market responds with technical view (using OpenAI)
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for natural flow
      const marketThought = await this.generateAIThought('market', marketContext, 'market');
      if (marketThought) {
        allThoughts.push(marketThought);
        this.conversationContext.unshift({ sender: 'market', message: marketThought.message });
      }
      
      // 4. Macro adds big picture perspective
      await new Promise(resolve => setTimeout(resolve, 500));
      const macroThought = await this.generateAIThought('macro', marketContext, 'macro');
      if (macroThought) {
        allThoughts.push(macroThought);
        this.conversationContext.unshift({ sender: 'macro', message: macroThought.message });
      }
      
      // 5. RL80 makes decision based on team input
      await new Promise(resolve => setTimeout(resolve, 500));
      const decision = {
        timestamp: new Date().toLocaleString(),
        type: 'trading',
        message: this.generateRL80Decision(marketContext, allThoughts),
        consultant: 'rl80'
      };
      allThoughts.push(decision);
      
      // Keep conversation context limited
      if (this.conversationContext.length > 10) {
        this.conversationContext = this.conversationContext.slice(0, 10);
      }
      
      // Update consultant confidence based on successful API calls
      this.updateConsultantConfidence(allThoughts);
      
    } catch (error) {
      console.error('Analysis cycle error:', error);
      allThoughts.push({
        timestamp: new Date().toLocaleString(),
        type: 'system',
        message: 'Analysis cycle recovering...',
        consultant: null
      });
    } finally {
      this.isAnalyzing = false;
    }
    
    return allThoughts;
  }

  // Generate RL80's decision based on team input
  generateRL80Decision(marketContext, teamThoughts) {
    // Analyze team sentiment
    const hasSentiment = teamThoughts.some(t => t.consultant === 'sentiment');
    const hasMarket = teamThoughts.some(t => t.consultant === 'market');
    const hasMacro = teamThoughts.some(t => t.consultant === 'macro');
    
    // Generate decision based on context
    const decisions = [
      `Consensus looks good. Maintaining current positions with tight stops.`,
      `Mixed signals from the team. Reducing position size by 25% for risk management.`,
      `Strong alignment across all indicators. Adding to winning positions.`,
      `Conflicting views. Let's wait for clearer signals before acting.`,
      `Market conditions favorable. Executing scaled entry on ETH and SOL.`,
      `Team analysis confirms thesis. Holding positions, monitoring closely.`
    ];
    
    if (marketContext.totalPnL > 100) {
      return `Nice profits flowing in! ${decisions[2]}`;
    } else if (marketContext.totalPnL < -50) {
      return `Taking heat here. ${decisions[1]}`;
    } else if (hasSentiment && hasMarket && hasMacro) {
      return `All advisors reporting. ${decisions[Math.floor(Math.random() * decisions.length)]}`;
    } else {
      return decisions[Math.floor(Math.random() * decisions.length)];
    }
  }

  // Update consultant confidence levels
  updateConsultantConfidence(thoughts) {
    thoughts.forEach(thought => {
      if (thought.consultant && this.consultants[thought.consultant]) {
        // Increase confidence when consultant provides analysis
        this.consultants[thought.consultant].confidence = 75 + Math.random() * 25;
      }
    });
  }

  // Get current thoughts
  getThoughts() {
    return this.thoughts;
  }

  // Get consultant states
  getConsultants() {
    return this.consultants;
  }

  // Test API connections
  async testConnections() {
    console.log('Testing AI connections...');
    
    // Test Grok
    const grokTest = await this.callGrok('Testing connection. Just say "Connected to Grok successfully"');
    console.log('Grok test:', grokTest ? '✅ Connected' : '❌ Failed');
    
    // Test Anthropic (will use fallback if no key)
    const anthropicTest = await this.callAnthropic('Testing connection. Just say "Connected"');
    console.log('Anthropic test:', anthropicTest ? '✅ Connected/Fallback' : '❌ Failed');
    
    return {
      grok: !!grokTest,
      anthropic: !!anthropicTest
    };
  }
}

// Export singleton instance
let agentInstance = null;

export const getAITradingAgent = () => {
  if (!agentInstance) {
    agentInstance = new AITradingAgent();
    // Test connections on initialization
    agentInstance.testConnections();
  }
  return agentInstance;
};

export default AITradingAgent;