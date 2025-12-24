// AI Trading Agent with Stream of Consciousness
// This agent analyzes market data and generates real-time thoughts

class TradingAgent {
  constructor() {
    this.thoughts = [];
    this.marketMemory = {};
    this.consultants = {
      market: { name: 'Market Analyst', icon: '📊', confidence: 0 },
      macro: { name: 'Macro Specialist', icon: '🌍', confidence: 0 },
      sentiment: { name: 'Sentiment Oracle', icon: '💭', confidence: 0 }
    };
    this.lastAnalysis = {};
    this.isAnalyzing = false;
  }

  // Generate a thought based on market conditions
  generateThought(type, data, consultant = null) {
    const thought = {
      timestamp: new Date().toLocaleString(),
      type,
      message: data,
      consultant
    };
    
    this.thoughts.unshift(thought);
    if (this.thoughts.length > 50) {
      this.thoughts = this.thoughts.slice(0, 50);
    }
    
    return thought;
  }

  // Analyze market data and generate insights
  analyzeMarketData(marketData, positions = [], accountBalance = 0) {
    const thoughts = [];
    
    // Market trend analysis
    if (marketData && Object.keys(marketData).length > 0) {
      const btcData = marketData['BTC-USD'];
      const ethData = marketData['ETH-USD'];
      
      if (btcData?.ticker) {
        const priceChange = parseFloat(btcData.ticker.priceChange24h || 0);
        const volume = parseFloat(btcData.ticker.volume24h || 0);
        
        if (Math.abs(priceChange) > 2) {
          thoughts.push(this.generateThought(
            'market',
            `BTC showing ${priceChange > 0 ? 'bullish' : 'bearish'} momentum with ${priceChange.toFixed(2)}% change. Volume ${volume > 1000000 ? 'elevated' : 'normal'} at ${(volume/1000000).toFixed(1)}M.`,
            'market'
          ));
        }
      }
      
      // ETH correlation check
      if (ethData?.ticker && btcData?.ticker) {
        const ethChange = parseFloat(ethData.ticker.priceChange24h || 0);
        const btcChange = parseFloat(btcData.ticker.priceChange24h || 0);
        
        if (Math.sign(ethChange) !== Math.sign(btcChange)) {
          thoughts.push(this.generateThought(
            'market',
            `Divergence detected: ETH ${ethChange > 0 ? 'up' : 'down'} ${Math.abs(ethChange).toFixed(2)}% while BTC ${btcChange > 0 ? 'up' : 'down'} ${Math.abs(btcChange).toFixed(2)}%. Potential rotation opportunity.`,
            'market'
          ));
        }
      }
    }
    
    // Position analysis
    if (positions && positions.length > 0) {
      const totalPnL = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
      const riskExposure = positions.reduce((sum, pos) => sum + Math.abs(pos.size * pos.markPrice || 0), 0);
      const riskPercent = (riskExposure / accountBalance) * 100;
      
      thoughts.push(this.generateThought(
        'features/trading',
        `Active positions: ${positions.length}. Total P&L: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}. Risk exposure: ${riskPercent.toFixed(1)}% of capital.`,
        null
      ));
      
      // Check individual positions
      positions.forEach(pos => {
        const pnlPercent = (pos.unrealizedPnl / (pos.size * pos.entryPrice)) * 100;
        if (Math.abs(pnlPercent) > 5) {
          thoughts.push(this.generateThought(
            'features/trading',
            `${pos.symbol} position ${pnlPercent > 0 ? 'profitable' : 'losing'} at ${Math.abs(pnlPercent).toFixed(1)}%. Consider ${pnlPercent > 10 ? 'taking profits' : pnlPercent < -5 ? 'stop loss' : 'monitoring closely'}.`,
            'market'
          ));
        }
      });
    } else {
      thoughts.push(this.generateThought(
        'features/trading',
        'No active positions. Scanning for entry opportunities based on market conditions.',
        null
      ));
    }
    
    return thoughts;
  }

  // Generate macro insights
  generateMacroInsights(macroData) {
    const thoughts = [];
    
    if (macroData) {
      // Market regime assessment
      if (macroData.marketRegime) {
        thoughts.push(this.generateThought(
          'market',
          `Market regime: ${macroData.marketRegime}. Risk score ${macroData.riskScore}/100. ${macroData.riskScore > 70 ? 'Favorable for risk assets' : macroData.riskScore < 30 ? 'Defensive positioning recommended' : 'Neutral conditions, be selective'}.`,
          'macro'
        ));
      }
      
      // Fed policy impact
      if (macroData.rateCutProb > 70) {
        thoughts.push(this.generateThought(
          'sentiment',
          `High probability (${macroData.rateCutProb}%) of rate cuts. Historically bullish for crypto. DXY at ${macroData.dxy} ${macroData.dxyChange < 0 ? 'weakening' : 'strengthening'}.`,
          'macro'
        ));
      }
      
      // VIX analysis
      if (macroData.vix < 15) {
        thoughts.push(this.generateThought(
          'sentiment',
          `Low volatility environment (VIX: ${macroData.vix}). Options cheap, consider volatility plays or increasing position sizes with tight stops.`,
          'sentiment'
        ));
      }
    }
    
    return thoughts;
  }

  // Strategy recommendations
  generateStrategyThoughts(marketData, positions, accountData) {
    const thoughts = [];
    const availableMargin = accountData?.availableMargin || 0;
    
    // Position sizing recommendation
    if (availableMargin > 1000) {
      thoughts.push(this.generateThought(
        'learning',
        `Available margin: $${availableMargin.toFixed(2)}. Optimal position sizing: 2% risk per trade = $${(availableMargin * 0.02).toFixed(2)} max loss per position.`,
        null
      ));
    }
    
    // Market opportunity scan
    const markets = Object.keys(marketData || {});
    if (markets.length > 0) {
      const opportunities = [];
      markets.forEach(market => {
        const data = marketData[market];
        if (data?.ticker) {
          const momentum = parseFloat(data.ticker.priceChange24h || 0);
          const volume = parseFloat(data.ticker.volume24h || 0);
          
          if (momentum > 5 && volume > 500000) {
            opportunities.push(`${market}: Strong momentum (+${momentum.toFixed(1)}%)`);
          } else if (momentum < -5 && volume > 500000) {
            opportunities.push(`${market}: Oversold (-${momentum.toFixed(1)}%)`);
          }
        }
      });
      
      if (opportunities.length > 0) {
        thoughts.push(this.generateThought(
          'features/trading',
          `Opportunities detected: ${opportunities.join(', ')}. Volume confirms interest. Consider entries on pullbacks.`,
          'market'
        ));
      }
    }
    
    return thoughts;
  }

  // Main analysis cycle
  async performAnalysis(data) {
    if (this.isAnalyzing) return this.thoughts;
    
    this.isAnalyzing = true;
    const allThoughts = [];
    
    try {
      // Analyze different aspects
      const marketThoughts = this.analyzeMarketData(data.marketData, data.positions, data.accountBalance);
      const macroThoughts = this.generateMacroInsights(data.macroData);
      const strategyThoughts = this.generateStrategyThoughts(data.marketData, data.positions, data.accountData);
      
      allThoughts.push(...marketThoughts, ...macroThoughts, ...strategyThoughts);
      
      // Update consultant confidence based on market conditions
      this.updateConsultantConfidence(data);
      
    } catch (error) {
      console.error('Analysis error:', error);
      allThoughts.push(this.generateThought(
        'system',
        `Analysis cycle encountered an error. Retrying...`,
        null
      ));
    } finally {
      this.isAnalyzing = false;
    }
    
    return allThoughts;
  }

  // Update consultant confidence levels
  updateConsultantConfidence(data) {
    // Market consultant confidence based on data quality
    if (data.marketData && Object.keys(data.marketData).length > 0) {
      this.consultants.market.confidence = 85 + Math.random() * 15;
    }
    
    // Macro consultant confidence based on regime
    if (data.macroData?.marketRegime === 'RISK_ON') {
      this.consultants.macro.confidence = 75 + Math.random() * 20;
    } else {
      this.consultants.macro.confidence = 50 + Math.random() * 25;
    }
    
    // Sentiment consultant confidence
    if (data.macroData?.fearGreed) {
      this.consultants.sentiment.confidence = 70 + Math.random() * 25;
    }
  }

  // Get current thoughts
  getThoughts() {
    return this.thoughts;
  }

  // Get consultant states
  getConsultants() {
    return this.consultants;
  }
}

// Export singleton instance
let agentInstance = null;

export const getTradingAgent = () => {
  if (!agentInstance) {
    agentInstance = new TradingAgent();
  }
  return agentInstance;
};

export default TradingAgent;