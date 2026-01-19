// OHLC data API endpoint using CoinGecko public API
import { NextResponse } from 'next/server';

// Cache for storing fetched data
let cache = {
  data: {},
  timestamp: 0,
  ttl: 60000 // 1 minute cache
};

// Symbol mapping: our symbols to CoinGecko IDs
const symbolMap = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'XRP': 'ripple'
};

async function fetchOHLCData(symbol) {
  const coinId = symbolMap[symbol] || symbol.toLowerCase();

  try {
    // CoinGecko OHLC endpoint - returns 1/7/14/30/90/180/365 days based on days param
    // For 1h candles equivalent, we use 1 day which gives ~288 data points (5min intervals)
    // Or 7 days for better coverage
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=7`,
      {
        next: { revalidate: 60 },
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`CoinGecko OHLC error for ${symbol}:`, response.status);
      return null;
    }

    const ohlcData = await response.json();

    if (!Array.isArray(ohlcData) || ohlcData.length === 0) {
      console.error(`No OHLC data for ${symbol}`);
      return null;
    }

    // CoinGecko OHLC format: [timestamp, open, high, low, close]
    // Convert to our format with volume (estimated from price movement)
    return ohlcData.map((candle, i) => {
      const [timestamp, open, high, low, close] = candle;
      // Estimate volume based on price range (placeholder since CoinGecko OHLC doesn't include volume)
      const priceRange = high - low;
      const estimatedVolume = priceRange * 1000000; // Rough estimate

      return {
        time: Math.floor(timestamp / 1000), // Convert ms to seconds for lightweight-charts
        open: open,
        high: high,
        low: low,
        close: close,
        volume: estimatedVolume
      };
    });
  } catch (error) {
    console.error(`Error fetching OHLC for ${symbol}:`, error);
    return null;
  }
}

// Fetch current price data for more accurate current values
async function fetchCurrentPrices(symbols) {
  try {
    const ids = symbols.map(s => symbolMap[s] || s.toLowerCase()).join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) return {};
    return await response.json();
  } catch (error) {
    console.error('Error fetching current prices:', error);
    return {};
  }
}

// Calculate EMA
function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = data[0]?.close || 0;

  for (let i = 0; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({
      time: data[i].time,
      value: ema
    });
  }

  return result;
}

// Calculate SMA
function calculateSMA(data, period) {
  const result = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ time: data[i].time, value: null });
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time,
      value: sum / period
    });
  }

  return result;
}

// Calculate RSI
function calculateRSI(data, period = 14) {
  if (data.length < period + 1) {
    return data.map(d => ({ time: d.time, value: 50 }));
  }

  const result = [];
  let avgGain = 0;
  let avgLoss = 0;

  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI value
  for (let i = 0; i < period; i++) {
    result.push({ time: data[i].time, value: null });
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({ time: data[period].time, value: 100 - (100 / (1 + rs)) });

  // Calculate subsequent RSI values
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: data[i].time, value: 100 - (100 / (1 + rs)) });
  }

  return result;
}

// Calculate MACD
function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (data.length < slowPeriod) {
    return {
      macd: data.map(d => ({ time: d.time, value: 0 })),
      signal: data.map(d => ({ time: d.time, value: 0 })),
      histogram: data.map(d => ({ time: d.time, value: 0, color: '#26a69a' }))
    };
  }

  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const macdLine = [];
  for (let i = 0; i < data.length; i++) {
    macdLine.push({
      time: data[i].time,
      value: fastEMA[i].value - slowEMA[i].value
    });
  }

  // Calculate signal line (EMA of MACD)
  const k = 2 / (signalPeriod + 1);
  let signalEMA = macdLine[0].value;
  const signal = [];
  const histogram = [];

  for (let i = 0; i < macdLine.length; i++) {
    signalEMA = macdLine[i].value * k + signalEMA * (1 - k);
    signal.push({
      time: macdLine[i].time,
      value: signalEMA
    });
    const histValue = macdLine[i].value - signalEMA;
    histogram.push({
      time: macdLine[i].time,
      value: histValue,
      color: histValue >= 0 ? '#26a69a' : '#ef5350'
    });
  }

  return { macd: macdLine, signal, histogram };
}

// Calculate Bollinger Bands
function calculateBollingerBands(data, period = 20, stdDev = 2) {
  const sma = calculateSMA(data, period);
  const upper = [];
  const lower = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1 || sma[i].value === null) {
      upper.push({ time: data[i].time, value: null });
      lower.push({ time: data[i].time, value: null });
      continue;
    }

    // Calculate standard deviation
    let sumSquaredDiff = 0;
    for (let j = 0; j < period; j++) {
      const diff = data[i - j].close - sma[i].value;
      sumSquaredDiff += diff * diff;
    }
    const standardDeviation = Math.sqrt(sumSquaredDiff / period);

    upper.push({
      time: data[i].time,
      value: sma[i].value + (standardDeviation * stdDev)
    });
    lower.push({
      time: data[i].time,
      value: sma[i].value - (standardDeviation * stdDev)
    });
  }

  return { upper, middle: sma, lower };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get('symbols')?.split(',') || ['BTC', 'ETH', 'SOL', 'XRP'];

  // Check cache
  const cacheKey = symbols.join(',');
  if (cache.data[cacheKey] && Date.now() - cache.timestamp < cache.ttl) {
    return NextResponse.json({
      ...cache.data[cacheKey],
      cacheAge: Math.floor((Date.now() - cache.timestamp) / 1000)
    });
  }

  try {
    const results = {};

    // Fetch current prices for accurate current values
    const currentPrices = await fetchCurrentPrices(symbols);

    // Fetch OHLC data for each symbol
    await Promise.all(
      symbols.map(async (symbol) => {
        const ohlc = await fetchOHLCData(symbol);

        if (ohlc && ohlc.length > 0) {
          // Calculate all indicators
          const ema12 = calculateEMA(ohlc, 12);
          const ema26 = calculateEMA(ohlc, 26);
          const sma20 = calculateSMA(ohlc, 20);
          const sma50 = calculateSMA(ohlc, 50);
          const rsi = calculateRSI(ohlc, 14);
          const macd = calculateMACD(ohlc, 12, 26, 9);
          const bollinger = calculateBollingerBands(ohlc, 20, 2);

          // Get current values (last candle)
          const lastCandle = ohlc[ohlc.length - 1];
          const lastRSI = rsi[rsi.length - 1]?.value || 50;
          const lastMACD = macd.macd[macd.macd.length - 1]?.value || 0;
          const lastSignal = macd.signal[macd.signal.length - 1]?.value || 0;
          const lastHistogram = macd.histogram[macd.histogram.length - 1]?.value || 0;

          // Get real current price from simple/price endpoint
          const coinId = symbolMap[symbol] || symbol.toLowerCase();
          const realPrice = currentPrices[coinId]?.usd || lastCandle.close;

          // Determine trend
          const priceChange = ((lastCandle.close - ohlc[0].close) / ohlc[0].close) * 100;
          const trend = priceChange > 1 ? 'bullish' : priceChange < -1 ? 'bearish' : 'sideways';

          // Calculate support and resistance from recent highs/lows
          const recentCandles = ohlc.slice(-20);
          const support = Math.min(...recentCandles.map(c => c.low));
          const resistance = Math.max(...recentCandles.map(c => c.high));

          results[symbol] = {
            candles: ohlc,
            indicators: {
              ema12,
              ema26,
              sma20,
              sma50,
              rsi,
              macd: macd.macd,
              macdSignal: macd.signal,
              macdHistogram: macd.histogram,
              bollingerUpper: bollinger.upper,
              bollingerMiddle: bollinger.middle,
              bollingerLower: bollinger.lower
            },
            current: {
              price: realPrice,
              open: lastCandle.open,
              high: lastCandle.high,
              low: lastCandle.low,
              volume: lastCandle.volume,
              rsi: lastRSI,
              macd: lastMACD,
              macdSignal: lastSignal,
              macdHistogram: lastHistogram,
              trend,
              support,
              resistance
            }
          };
        }
      })
    );

    // If no results, return error
    if (Object.keys(results).length === 0) {
      console.error('No OHLC data fetched for any symbol');
      return NextResponse.json(
        { error: 'Failed to fetch OHLC data from CoinGecko', symbols },
        { status: 500 }
      );
    }

    // Update cache
    cache.data[cacheKey] = results;
    cache.timestamp = Date.now();

    return NextResponse.json({
      ...results,
      timestamp: new Date().toISOString(),
      cacheAge: 0
    });
  } catch (error) {
    console.error('OHLC API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch OHLC data', message: error.message },
      { status: 500 }
    );
  }
}
