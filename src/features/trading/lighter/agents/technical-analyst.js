// Technical Analyst Assistant
// Calculates indicators and provides technical analysis insights

class TechnicalAnalyst {
  constructor() {
    this.indicators = {};
    this.priceHistory = {};
    this.supportResistance = {};
  }

  // Calculate simple moving average
  calculateSMA(prices, period) {
    if (prices.length < period) return null;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  // Calculate RSI
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50; // Neutral if not enough data
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return Math.round(rsi);
  }

  // Calculate MACD
  calculateMACD(prices) {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
    
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([macd], 9) || 0;
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  // Calculate EMA
  calculateEMA(prices, period) {
    if (prices.length < period) return null;
    
    const k = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    
    return ema;
  }

  // Find support and resistance levels
  findSupportResistance(prices) {
    if (prices.length < 20) return { support: 0, resistance: 0 };
    
    const recentPrices = prices.slice(-50); // Last 50 candles
    const highs = [];
    const lows = [];
    
    // Find local highs and lows
    for (let i = 1; i < recentPrices.length - 1; i++) {
      if (recentPrices[i] > recentPrices[i-1] && recentPrices[i] > recentPrices[i+1]) {
        highs.push(recentPrices[i]);
      }
      if (recentPrices[i] < recentPrices[i-1] && recentPrices[i] < recentPrices[i+1]) {
        lows.push(recentPrices[i]);
      }
    }
    
    const currentPrice = prices[prices.length - 1];
    
    // Find nearest support (highest low below current price)
    const support = Math.max(...lows.filter(l => l < currentPrice), 0);
    
    // Find nearest resistance (lowest high above current price)
    const resistance = Math.min(...highs.filter(h => h > currentPrice), currentPrice * 1.1);
    
    return { support, resistance };
  }

  // Analyze trend
  analyzeTrend(prices) {
    if (prices.length < 20) return 'NEUTRAL';
    
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, Math.min(50, prices.length));
    const currentPrice = prices[prices.length - 1];
    
    if (currentPrice > sma20 && (!sma50 || sma20 > sma50)) {
      return 'BULLISH';
    } else if (currentPrice < sma20 && (!sma50 || sma20 < sma50)) {
      return 'BEARISH';
    }
    
    return 'NEUTRAL';
  }

  // Main analysis function
  analyze(marketData) {
    const analysis = {};
    
    // Process each market
    for (const [symbol, data] of Object.entries(marketData)) {
      if (!data?.ticker) continue;
      
      const currentPrice = parseFloat(data.ticker.lastPrice || 0);
      if (!currentPrice) continue;
      
      // Store price history (simplified - in production, fetch from API)
      if (!this.priceHistory[symbol]) {
        this.priceHistory[symbol] = [];
      }
      this.priceHistory[symbol].push(currentPrice);
      
      // Keep only last 100 prices
      if (this.priceHistory[symbol].length > 100) {
        this.priceHistory[symbol] = this.priceHistory[symbol].slice(-100);
      }
      
      const prices = this.priceHistory[symbol];
      
      // Calculate indicators
      const rsi = this.calculateRSI(prices);
      const macd = this.calculateMACD(prices);
      const sma20 = this.calculateSMA(prices, Math.min(20, prices.length));
      const sma50 = this.calculateSMA(prices, Math.min(50, prices.length));
      const { support, resistance } = this.findSupportResistance(prices);
      const trend = this.analyzeTrend(prices);
      
      analysis[symbol] = {
        price: currentPrice,
        trend,
        rsi,
        macd: macd.histogram,
        sma20,
        sma50,
        support,
        resistance,
        signal: this.generateSignal(rsi, macd, trend, currentPrice, support, resistance)
      };
    }
    
    return analysis;
  }

  // Generate features/trading signal based on indicators
  generateSignal(rsi, macd, trend, price, support, resistance) {
    let signal = 'NEUTRAL';
    let confidence = 0;
    
    // RSI signals
    if (rsi > 70) {
      signal = 'OVERBOUGHT';
      confidence += 20;
    } else if (rsi < 30) {
      signal = 'OVERSOLD';
      confidence += 20;
    }
    
    // MACD signals
    if (macd.histogram > 0) {
      if (signal === 'OVERSOLD') signal = 'BUY';
      confidence += 15;
    } else if (macd.histogram < 0) {
      if (signal === 'OVERBOUGHT') signal = 'SELL';
      confidence += 15;
    }
    
    // Trend confirmation
    if (trend === 'BULLISH' && signal !== 'SELL') {
      signal = signal === 'NEUTRAL' ? 'BUY' : signal;
      confidence += 25;
    } else if (trend === 'BEARISH' && signal !== 'BUY') {
      signal = signal === 'NEUTRAL' ? 'SELL' : signal;
      confidence += 25;
    }
    
    // Support/Resistance
    const priceToSupport = support ? ((price - support) / price) * 100 : 100;
    const priceToResistance = resistance ? ((resistance - price) / price) * 100 : 100;
    
    if (priceToSupport < 2) {
      signal = 'BUY'; // Near support
      confidence += 20;
    } else if (priceToResistance < 2) {
      signal = 'SELL'; // Near resistance
      confidence += 20;
    }
    
    return {
      action: signal,
      confidence: Math.min(confidence, 95),
      reasons: this.explainSignal(rsi, macd, trend, price, support, resistance)
    };
  }

  // Explain the signal in human-readable format
  explainSignal(rsi, macd, trend, price, support, resistance) {
    const reasons = [];
    
    if (rsi > 70) reasons.push(`RSI overbought at ${rsi}`);
    else if (rsi < 30) reasons.push(`RSI oversold at ${rsi}`);
    else reasons.push(`RSI neutral at ${rsi}`);
    
    if (macd.histogram > 0) reasons.push('MACD bullish crossover');
    else if (macd.histogram < 0) reasons.push('MACD bearish crossover');
    
    reasons.push(`${trend} trend`);
    
    if (support) reasons.push(`Support at $${support.toFixed(2)}`);
    if (resistance) reasons.push(`Resistance at $${resistance.toFixed(2)}`);
    
    return reasons.join(', ');
  }

  // Format analysis for AI interpretation
  formatForAI(analysis) {
    const summary = [];
    
    for (const [symbol, data] of Object.entries(analysis)) {
      summary.push(`${symbol}: ${data.trend} trend, RSI ${data.rsi}, ${data.signal.action} signal (${data.signal.confidence}% confidence). ${data.signal.reasons}`);
    }
    
    return summary.join(' | ');
  }
}

// Export singleton instance
let analystInstance = null;

export const getTechnicalAnalyst = () => {
  if (!analystInstance) {
    analystInstance = new TechnicalAnalyst();
  }
  return analystInstance;
};

export default TechnicalAnalyst;