import { NextResponse } from 'next/server';
import { db, doc, setDoc } from '@/lib/firebaseServer';

// This endpoint should be called by a cron job (e.g., Vercel Cron)
// It fetches sentiment data and stores in Firestore for all clients to read

export async function GET(request) {
  try {
    console.log('[Sentiment Cron] Starting scheduled update...');

    // Verify this is a legitimate cron request (optional security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Sentiment Cron] Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!db) {
      console.error('[Sentiment Cron] Firestore not initialized');
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Fetch all data sources in parallel
    const [fearGreedData, trendingData, whaleData, fundingData] = await Promise.allSettled([
      fetchFearGreed(),
      fetchTrendingTopics(),
      fetchWhaleActivity(),
      fetchFundingRates()
    ]);

    // Process Fear & Greed
    let fearGreed = { value: 0, label: 'Unavailable' };
    if (fearGreedData.status === 'fulfilled' && fearGreedData.value) {
      fearGreed = fearGreedData.value;
    }

    // Process Trending Topics & Polymarket
    let trendingTopics = [];
    let polymarket = null;
    if (trendingData.status === 'fulfilled' && trendingData.value) {
      trendingTopics = trendingData.value.topics || [];
      polymarket = trendingData.value.polymarket || null;
    }

    // Process Whale Activity
    let whaleActivity = { activity: 'Unknown', confidence: 0 };
    if (whaleData.status === 'fulfilled' && whaleData.value) {
      whaleActivity = whaleData.value;
    }

    // Process Funding Rates
    let fundingRates = { btc: null, eth: null };
    if (fundingData.status === 'fulfilled' && fundingData.value) {
      fundingRates = fundingData.value;
    }

    // Build the sentiment document
    const sentimentDoc = {
      fearGreed,
      trendingTopics,
      polymarket,
      whaleActivity,
      fundingRates,
      dataStatus: {
        fearGreed: fearGreedData.status === 'fulfilled' && fearGreed.value > 0 ? 'live' : 'unavailable',
        trending: trendingTopics.length > 0 ? 'live' : 'unavailable',
        whale: whaleActivity.activity !== 'Unknown' ? 'live' : 'unavailable',
        funding: fundingRates.btc !== null ? 'live' : 'unavailable'
      },
      updatedAt: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 30 * 60 * 1000).toISOString() // Next update in 30 min
    };

    // Save to Firestore
    await setDoc(doc(db, 'sentimentData', 'latest'), sentimentDoc);

    console.log('[Sentiment Cron] Data saved to Firestore:', {
      fearGreed: fearGreed.value,
      trendingCount: trendingTopics.length,
      whaleActivity: whaleActivity.activity,
      hasFunding: fundingRates.btc !== null
    });

    return NextResponse.json({
      success: true,
      ...sentimentDoc
    });

  } catch (error) {
    console.error('[Sentiment Cron] Error:', error);
    return NextResponse.json({
      error: 'Update failed',
      message: error.message
    }, { status: 500 });
  }
}

// POST endpoint for manual trigger
export async function POST(request) {
  return GET(request);
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

async function fetchFearGreed() {
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=1');
    const data = await response.json();

    if (data.data?.[0]) {
      return {
        value: parseInt(data.data[0].value || 0),
        label: data.data[0].value_classification || 'Unknown'
      };
    }
    return null;
  } catch (error) {
    console.error('[Sentiment Cron] Fear & Greed fetch failed:', error.message);
    return null;
  }
}

async function fetchTrendingTopics() {
  const topics = [];

  // Fetch from Reddit (free)
  try {
    const subreddits = ['bitcoin', 'ethereum', 'cryptocurrency'];

    for (const sub of subreddits) {
      try {
        const response = await fetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=5`,
          { headers: { 'User-Agent': 'SentimentBot/1.0' } }
        );

        if (response.ok) {
          const data = await response.json();
          const posts = data.data?.children || [];

          for (const post of posts.slice(0, 2)) {
            const p = post.data;
            if (p.stickied || p.score < 100) continue;

            topics.push({
              topic: truncateTitle(p.title, 40),
              sentiment: analyzeSentiment(p.title, p.upvote_ratio),
              mentions: p.num_comments || 0,
              source: `r/${sub}`,
              score: p.score
            });
          }
        }
      } catch (err) {
        console.log(`[Sentiment Cron] Reddit r/${sub} failed:`, err.message);
      }
    }
  } catch (error) {
    console.error('[Sentiment Cron] Reddit fetch failed:', error.message);
  }

  // Fetch from CoinGecko trending (free)
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/search/trending');

    if (response.ok) {
      const data = await response.json();
      const coins = data.coins || [];

      for (const item of coins.slice(0, 3)) {
        const coin = item.item;
        const symbol = coin.symbol?.toUpperCase();
        const isBtcEth = ['BTC', 'ETH', 'WBTC', 'WETH', 'STETH'].includes(symbol);

        topics.push({
          topic: `${coin.name} (${symbol}) trending`,
          sentiment: coin.data?.price_change_percentage_24h?.usd > 0 ? 'bullish' :
                     coin.data?.price_change_percentage_24h?.usd < 0 ? 'bearish' : 'neutral',
          mentions: coin.score || 0,
          source: 'coingecko',
          priority: isBtcEth ? 1 : 0
        });
      }
    }
  } catch (error) {
    console.error('[Sentiment Cron] CoinGecko fetch failed:', error.message);
  }

  // Fetch Polymarket data
  let polymarket = null;
  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?closed=false&limit=20',
      { headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const markets = await response.json();

      if (Array.isArray(markets) && markets.length > 0) {
        // Filter for crypto-related markets
        const cryptoMarkets = markets.filter(m => {
          const q = (m.question || '').toLowerCase();
          return q.includes('bitcoin') || q.includes('btc') ||
                 q.includes('ethereum') || q.includes('eth') ||
                 q.includes('crypto');
        });

        const marketsToUse = cryptoMarkets.length > 0 ? cryptoMarkets : markets;

        polymarket = {
          markets: marketsToUse.slice(0, 5).map(market => {
            const prices = market.outcomePrices || [];
            return {
              title: market.question || 'Unknown',
              yes: prices[0] ? Math.round(parseFloat(prices[0]) * 100) : 50,
              no: prices[1] ? Math.round(parseFloat(prices[1]) * 100) : 50,
              volume: formatVolume(market.volume || 0)
            };
          }),
          source: 'polymarket_real'
        };
      }
    }
  } catch (error) {
    console.error('[Sentiment Cron] Polymarket fetch failed:', error.message);
  }

  // Deduplicate and sort topics
  const uniqueTopics = deduplicateTopics(topics)
    .sort((a, b) => (b.score || 0) + (b.mentions || 0) - (a.score || 0) - (a.mentions || 0))
    .slice(0, 3);

  return { topics: uniqueTopics, polymarket };
}

async function fetchWhaleActivity() {
  // Try CoinGlass public API
  try {
    const response = await fetch(
      'https://open-api.coinglass.com/public/v2/indicator/exchange_netflow?symbol=BTC&interval=h1',
      { headers: { 'accept': 'application/json' } }
    );

    if (response.ok) {
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const recentData = data.data.slice(-24);
        const totalNetFlow = recentData.reduce((sum, item) => sum + (item.netflow || 0), 0);

        let activity = 'Normal';
        let confidence = 50;

        if (totalNetFlow < -1000) {
          activity = 'Accumulating';
          confidence = Math.min(100, Math.abs(totalNetFlow) / 50);
        } else if (totalNetFlow > 1000) {
          activity = 'Distributing';
          confidence = Math.min(100, totalNetFlow / 50);
        }

        return { activity, confidence: Math.round(confidence) };
      }
    }
  } catch (error) {
    console.log('[Sentiment Cron] CoinGlass fetch failed:', error.message);
  }

  // Fallback: Analyze Binance large trades
  try {
    const response = await fetch(
      'https://fapi.binance.com/fapi/v1/aggTrades?symbol=BTCUSDT&limit=100'
    );

    if (response.ok) {
      const trades = await response.json();

      let buyVolume = 0;
      let sellVolume = 0;

      trades.forEach(trade => {
        const value = parseFloat(trade.p) * parseFloat(trade.q);
        if (value > 100000) {
          if (trade.m) {
            sellVolume += value;
          } else {
            buyVolume += value;
          }
        }
      });

      const ratio = buyVolume / (sellVolume || 1);

      if (ratio > 1.3) {
        return { activity: 'Accumulating', confidence: Math.min(100, Math.round((ratio - 1) * 50)) };
      } else if (ratio < 0.7) {
        return { activity: 'Distributing', confidence: Math.min(100, Math.round((1 - ratio) * 50)) };
      }
      return { activity: 'Normal', confidence: 50 };
    }
  } catch (error) {
    console.log('[Sentiment Cron] Binance trades fetch failed:', error.message);
  }

  return { activity: 'Unknown', confidence: 0 };
}

async function fetchFundingRates() {
  try {
    // Fetch BTC and ETH funding rates from Binance
    const [btcRes, ethRes] = await Promise.all([
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT'),
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=ETHUSDT')
    ]);

    const btcData = await btcRes.json();
    const ethData = await ethRes.json();

    return {
      btc: btcData.lastFundingRate ? (parseFloat(btcData.lastFundingRate) * 100).toFixed(4) : null,
      eth: ethData.lastFundingRate ? (parseFloat(ethData.lastFundingRate) * 100).toFixed(4) : null
    };
  } catch (error) {
    console.error('[Sentiment Cron] Funding rates fetch failed:', error.message);
    return { btc: null, eth: null };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function analyzeSentiment(text, upvoteRatio = 0.5) {
  const lower = text.toLowerCase();

  const bullish = ['surge', 'soar', 'rally', 'bullish', 'ath', 'moon', 'pump', 'gains', 'breakout', 'approved'];
  const bearish = ['crash', 'dump', 'plunge', 'bearish', 'fear', 'sell', 'drop', 'hack', 'scam', 'ban'];

  const hasBullish = bullish.some(word => lower.includes(word));
  const hasBearish = bearish.some(word => lower.includes(word));

  if (hasBullish && !hasBearish) return 'bullish';
  if (hasBearish && !hasBullish) return 'bearish';
  if (upvoteRatio > 0.7) return 'bullish';
  if (upvoteRatio < 0.4) return 'bearish';
  return 'neutral';
}

function truncateTitle(title, maxLen) {
  if (!title) return 'Unknown';
  if (title.length <= maxLen) return title;
  return title.substring(0, maxLen - 2) + '..';
}

function deduplicateTopics(topics) {
  const seen = new Set();
  return topics.filter(t => {
    const key = t.topic.toLowerCase().substring(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatVolume(volume) {
  const num = parseFloat(volume) || 0;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}
