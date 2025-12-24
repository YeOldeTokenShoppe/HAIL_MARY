// TradingView Technical Analyst
// Integrates TradingView's technical analysis for accurate indicators

class TradingViewAnalyst {
  constructor() {
    this.apiKey = process.env.TRADINGVIEW_API_KEY;
    this.secret = process.env.TRADINGVIEW_SECRET;
    this.cache = new Map();
    this.cacheTimeout = 60000; // Cache for 1 minute
  }

  // Get technical analysis from TradingView's public widget API
  // This works without authentication for major symbols
  async getPublicAnalysis(symbol) {
    try {
      // Convert symbol format (BTC-USD -> BTCUSD)
      const tvSymbol = symbol.replace('-', '').replace('/', '');
      
      // Check cache first
      const cached = this.getFromCache(tvSymbol);
      if (cached) return cached;
      
      // TradingView's technical analysis widget data endpoint
      // This is publicly accessible for major crypto pairs
      const response = await fetch(
        `https://scanner.features/tradingview.com/crypto/scan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbols: {
              tickers: [`BINANCE:${tvSymbol}`, `COINBASE:${tvSymbol}`, `BYBIT:${tvSymbol}PERP`],
            },
            columns: [
              'name',
              'close',
              'change',
              'change_abs',
              'volume',
              'Recommend.All',
              'Recommend.MA',
              'Recommend.Other',
              'RSI',
              'RSI[1]',
              'Stoch.K',
              'Stoch.D',
              'Stoch.K[1]',
              'Stoch.D[1]',
              'CCI20',
              'CCI20[1]',
              'ADX',
              'ADX+DI',
              'ADX-DI',
              'ADX+DI[1]',
              'ADX-DI[1]',
              'AO',
              'AO[1]',
              'Mom',
              'Mom[1]',
              'MACD.macd',
              'MACD.signal',
              'Rec.Stoch.RSI',
              'Rec.WR',
              'Rec.BBPower',
              'Rec.UO',
              'EMA10',
              'SMA10',
              'EMA20',
              'SMA20',
              'EMA30',
              'SMA30',
              'EMA50',
              'SMA50',
              'EMA100',
              'SMA100',
              'EMA200',
              'SMA200',
              'Rec.Ichimoku',
              'Rec.VWMA',
              'Rec.HullMA9',
              'Pivot.M.Classic.S3',
              'Pivot.M.Classic.S2',
              'Pivot.M.Classic.S1',
              'Pivot.M.Classic.Middle',
              'Pivot.M.Classic.R1',
              'Pivot.M.Classic.R2',
              'Pivot.M.Classic.R3'
            ]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`TradingView API error: ${response.status}`);
      }

      const data = await response.json();
      const symbolData = data.data?.[0]?.d;
      
      if (!symbolData) {
        return this.getFallbackAnalysis(symbol);
      }

      // Parse the response
      const analysis = this.parseAnalysisData(symbolData);
      
      // Cache the result
      this.addToCache(tvSymbol, analysis);
      
      return analysis;
      
    } catch (error) {
      console.error('TradingView public API error:', error);
      return this.getFallbackAnalysis(symbol);
    }
  }

  // Parse TradingView data into structured format
  parseAnalysisData(data) {
    // Map array indices to meaningful names
    const [
      name, close, change, changeAbs, volume,
      recommendAll, recommendMA, recommendOther,
      rsi, rsiPrev,
      stochK, stochD, stochKPrev, stochDPrev,
      cci20, cci20Prev,
      adx, adxPlus, adxMinus, adxPlusPrev, adxMinusPrev,
      ao, aoPrev,
      momentum, momentumPrev,
      macd, macdSignal,
      recStochRSI, recWR, recBBPower, recUO,
      ema10, sma10, ema20, sma20, ema30, sma30, ema50, sma50,
      ema100, sma100, ema200, sma200,
      recIchimoku, recVWMA, recHullMA,
      s3, s2, s1, pivotPoint, r1, r2, r3
    ] = data;

    // Convert recommendation values to readable format
    const getRecommendation = (value) => {
      if (value >= 0.5) return 'STRONG_BUY';
      if (value >= 0.1) return 'BUY';
      if (value <= -0.5) return 'STRONG_SELL';
      if (value <= -0.1) return 'SELL';
      return 'NEUTRAL';
    };

    // Determine trend based on moving averages
    const trend = this.determineTrend(close, ema20, ema50, ema200);

    return {
      symbol: name,
      price: close,
      change: change,
      changePercent: change,
      volume: volume,
      
      // Overall recommendations
      recommendation: {
        overall: getRecommendation(recommendAll),
        movingAverages: getRecommendation(recommendMA),
        oscillators: getRecommendation(recommendOther),
        summary: recommendAll > 0.1 ? 'BUY' : recommendAll < -0.1 ? 'SELL' : 'NEUTRAL',
        strength: Math.abs(recommendAll) // 0-1 scale
      },
      
      // Key indicators
      indicators: {
        rsi: rsi || 50,
        stochastic: { k: stochK, d: stochD },
        cci: cci20,
        adx: adx,
        macd: { value: macd, signal: macdSignal, histogram: macd - macdSignal },
        momentum: momentum,
        ao: ao // Awesome Oscillator
      },
      
      // Moving averages
      movingAverages: {
        ema10, sma10, ema20, sma20, ema30, sma30,
        ema50, sma50, ema100, sma100, ema200, sma200
      },
      
      // Support and Resistance (Pivot Points)
      levels: {
        resistance3: r3,
        resistance2: r2,
        resistance1: r1,
        pivot: pivotPoint,
        support1: s1,
        support2: s2,
        support3: s3
      },
      
      // Trend analysis
      trend: trend,
      
      // Trading signals
      signals: this.generateSignals({
        rsi, stochK, stochD, macd, macdSignal, 
        momentum, close, ema20, ema50, ema200,
        recommendAll
      })
    };
  }

  // Determine trend based on moving averages
  determineTrend(price, ema20, ema50, ema200) {
    if (!ema20 || !ema50) return 'NEUTRAL';
    
    const aboveShortTerm = price > ema20;
    const aboveMediumTerm = price > ema50;
    const aboveLongTerm = !ema200 || price > ema200;
    
    const shortAboveMedium = ema20 > ema50;
    const mediumAboveLong = !ema200 || ema50 > ema200;
    
    if (aboveShortTerm && aboveMediumTerm && aboveLongTerm && shortAboveMedium && mediumAboveLong) {
      return 'STRONG_BULLISH';
    } else if (aboveShortTerm && shortAboveMedium) {
      return 'BULLISH';
    } else if (!aboveShortTerm && !aboveMediumTerm && !shortAboveMedium) {
      return 'BEARISH';
    } else if (!aboveShortTerm && !aboveMediumTerm && !aboveLongTerm && !shortAboveMedium && !mediumAboveLong) {
      return 'STRONG_BEARISH';
    }
    
    return 'NEUTRAL';
  }

  // Generate features/trading signals based on indicators
  generateSignals(data) {
    const signals = [];
    const { rsi, stochK, stochD, macd, macdSignal, momentum, close, ema20, ema50, recommendAll } = data;
    
    // RSI signals
    if (rsi < 30) {
      signals.push({ type: 'RSI_OVERSOLD', message: `RSI oversold at ${rsi?.toFixed(1)}`, strength: 'STRONG' });
    } else if (rsi > 70) {
      signals.push({ type: 'RSI_OVERBOUGHT', message: `RSI overbought at ${rsi?.toFixed(1)}`, strength: 'STRONG' });
    }
    
    // Stochastic signals
    if (stochK < 20 && stochD < 20) {
      signals.push({ type: 'STOCH_OVERSOLD', message: 'Stochastic oversold', strength: 'MEDIUM' });
    } else if (stochK > 80 && stochD > 80) {
      signals.push({ type: 'STOCH_OVERBOUGHT', message: 'Stochastic overbought', strength: 'MEDIUM' });
    }
    
    // MACD signals
    if (macd > macdSignal && macd < 0) {
      signals.push({ type: 'MACD_BULLISH_CROSS', message: 'MACD bullish crossover', strength: 'STRONG' });
    } else if (macd < macdSignal && macd > 0) {
      signals.push({ type: 'MACD_BEARISH_CROSS', message: 'MACD bearish crossover', strength: 'STRONG' });
    }
    
    // Moving average signals
    if (close > ema20 && ema20 > ema50) {
      signals.push({ type: 'MA_BULLISH', message: 'Price above key moving averages', strength: 'MEDIUM' });
    } else if (close < ema20 && ema20 < ema50) {
      signals.push({ type: 'MA_BEARISH', message: 'Price below key moving averages', strength: 'MEDIUM' });
    }
    
    // Overall recommendation signal
    if (recommendAll > 0.5) {
      signals.push({ type: 'STRONG_BUY_SIGNAL', message: 'Strong buy signal from aggregated indicators', strength: 'STRONG' });
    } else if (recommendAll < -0.5) {
      signals.push({ type: 'STRONG_SELL_SIGNAL', message: 'Strong sell signal from aggregated indicators', strength: 'STRONG' });
    }
    
    return signals;
  }

  // Fallback analysis when API fails
  getFallbackAnalysis(symbol) {
    return {
      symbol,
      error: 'TradingView data temporarily unavailable',
      recommendation: {
        overall: 'NEUTRAL',
        summary: 'HOLD',
        strength: 0
      },
      indicators: {
        rsi: 50,
        macd: { value: 0, signal: 0, histogram: 0 }
      },
      trend: 'NEUTRAL',
      signals: []
    };
  }

  // Cache management
  addToCache(symbol, data) {
    this.cache.set(symbol, {
      data,
      timestamp: Date.now()
    });
  }

  getFromCache(symbol) {
    const cached = this.cache.get(symbol);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(symbol);
    return null;
  }

  // Format analysis for AI consumption
  formatForAI(analysis) {
    if (analysis.error) {
      return `Technical analysis unavailable for ${analysis.symbol}`;
    }

    const { recommendation, indicators, trend, levels, signals } = analysis;
    
    let summary = `${analysis.symbol}: ${trend} trend, ${recommendation.summary} (${(recommendation.strength * 100).toFixed(0)}% strength). `;
    summary += `RSI ${indicators.rsi?.toFixed(1)}, MACD ${indicators.macd?.histogram > 0 ? 'bullish' : 'bearish'}. `;
    
    if (levels?.support1 && levels?.resistance1) {
      summary += `Support at $${levels.support1?.toFixed(2)}, Resistance at $${levels.resistance1?.toFixed(2)}. `;
    }
    
    if (signals.length > 0) {
      const strongSignals = signals.filter(s => s.strength === 'STRONG');
      if (strongSignals.length > 0) {
        summary += `Key signals: ${strongSignals.map(s => s.message).join(', ')}.`;
      }
    }
    
    return summary;
  }

  // Get multiple symbols at once
  async analyzeMultiple(symbols) {
    const analyses = await Promise.all(
      symbols.map(symbol => this.getPublicAnalysis(symbol))
    );
    
    return symbols.reduce((acc, symbol, index) => {
      acc[symbol] = analyses[index];
      return acc;
    }, {});
  }
}

// Export singleton instance
let analystInstance = null;

export const getTradingViewAnalyst = () => {
  if (!analystInstance) {
    analystInstance = new TradingViewAnalyst();
  }
  return analystInstance;
};

export default TradingViewAnalyst;