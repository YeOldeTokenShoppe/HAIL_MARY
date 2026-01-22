import { NextResponse } from 'next/server';

// Cache for trending data (6 hour TTL to conserve API quotas)
let cache = {
  data: null,
  timestamp: 0,
  TTL: 6 * 60 * 60 * 1000 // 6 hours - drastically reduced to save CryptoPanic API calls
};

export async function GET() {
  try {
    // Return cached data if still valid
    const now = Date.now();
    if (cache.data && (now - cache.timestamp) < cache.TTL) {
      return NextResponse.json({ ...cache.data, source: 'cache', cached: true });
    }

    // Fetch from multiple FREE sources in parallel
    const [redditResult, coinGeckoResult, cryptoPanicResult, polymarketResult] = await Promise.allSettled([
      fetchRedditTrending(),
      fetchCoinGeckoTrending(),
      fetchCryptoPanicNews(),
      fetchPolymarketData()
    ]);

    // Combine topics from all sources, prioritizing BTC/ETH relevance
    let topics = [];

    // Add Reddit topics (most real-time social sentiment)
    if (redditResult.status === 'fulfilled' && redditResult.value?.length > 0) {
      topics.push(...redditResult.value);
    }

    // Add CoinGecko trending if we need more
    if (coinGeckoResult.status === 'fulfilled' && coinGeckoResult.value?.length > 0) {
      topics.push(...coinGeckoResult.value);
    }

    // Add CryptoPanic news
    if (cryptoPanicResult.status === 'fulfilled' && cryptoPanicResult.value?.length > 0) {
      topics.push(...cryptoPanicResult.value);
    }

    // Deduplicate and limit to top 3
    topics = deduplicateTopics(topics).slice(0, 3);

    const polymarket = polymarketResult.status === 'fulfilled' ? polymarketResult.value : null;

    // Determine source
    let source = 'free_apis';
    if (topics.length === 0) {
      source = 'unavailable';
    }

    const responseData = {
      topics,
      polymarket,
      source,
      timestamp: now
    };

    // Update cache
    cache.data = responseData;
    cache.timestamp = now;

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[Trending API] Error:', error);

    if (cache.data) {
      return NextResponse.json({ ...cache.data, source: 'cache', stale: true });
    }

    return NextResponse.json({
      topics: [],
      polymarket: null,
      source: 'error',
      error: 'Failed to fetch trending data'
    }, { status: 500 });
  }
}

// Fetch trending topics from Reddit (r/bitcoin and r/ethereum)
async function fetchRedditTrending() {
  const topics = [];

  try {
    // Fetch hot posts from crypto subreddits
    const subreddits = ['bitcoin', 'ethereum', 'cryptocurrency'];

    for (const sub of subreddits) {
      try {
        const response = await fetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=5`,
          {
            headers: {
              'User-Agent': 'TradingBot/1.0'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const posts = data.data?.children || [];

          for (const post of posts.slice(0, 2)) {
            const p = post.data;
            // Skip stickied posts and low engagement
            if (p.stickied || p.score < 100) continue;

            // Determine sentiment from title and score
            const title = p.title || '';
            const sentiment = analyzeSentiment(title, p.upvote_ratio);

            topics.push({
              topic: truncateTitle(title, 40),
              sentiment,
              mentions: p.num_comments || 0,
              source: `r/${sub}`,
              score: p.score
            });
          }
        }
      } catch (err) {
        console.log(`[Trending] Reddit r/${sub} failed:`, err.message);
      }
    }

    // Sort by engagement and return top items
    return topics
      .sort((a, b) => (b.score + b.mentions) - (a.score + a.mentions))
      .slice(0, 3);

  } catch (error) {
    console.error('[Trending] Reddit fetch failed:', error.message);
    return [];
  }
}

// Fetch trending coins from CoinGecko (free, no API key needed)
async function fetchCoinGeckoTrending() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/search/trending',
      { next: { revalidate: 1800 } }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const coins = data.coins || [];

    // Filter for BTC/ETH related or top trending
    const topics = [];

    for (const item of coins.slice(0, 5)) {
      const coin = item.item;
      const symbol = coin.symbol?.toUpperCase();

      // Prioritize BTC/ETH ecosystem coins
      const isBtcEth = ['BTC', 'ETH', 'WBTC', 'WETH', 'STETH', 'RETH', 'CBETH'].includes(symbol);

      topics.push({
        topic: `${coin.name} (${symbol}) trending #${coin.market_cap_rank || '?'}`,
        sentiment: coin.data?.price_change_percentage_24h?.usd > 0 ? 'bullish' :
                   coin.data?.price_change_percentage_24h?.usd < 0 ? 'bearish' : 'neutral',
        mentions: coin.score || 0,
        source: 'coingecko',
        priority: isBtcEth ? 1 : 0
      });
    }

    // Sort by priority (BTC/ETH first) then by score
    return topics
      .sort((a, b) => b.priority - a.priority || b.mentions - a.mentions)
      .slice(0, 2);

  } catch (error) {
    console.error('[Trending] CoinGecko fetch failed:', error.message);
    return [];
  }
}

// Fetch crypto news from CryptoPanic RSS (no API quota usage)
async function fetchCryptoPanicNews() {
  // Always use RSS to conserve API quota - RSS is free and unlimited
  return await fetchCryptoPanicRSS();
}

// Fallback: Parse CryptoPanic RSS feed
async function fetchCryptoPanicRSS() {
  try {
    const response = await fetch(
      'https://cryptopanic.com/news/rss/',
      {
        headers: {
          'User-Agent': 'TradingBot/1.0'
        }
      }
    );

    if (!response.ok) return [];

    const text = await response.text();

    // Simple RSS parsing for titles
    const titles = [];
    const titleMatches = text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g);

    for (const match of titleMatches) {
      const title = match[1];
      // Filter for BTC/ETH relevant news
      if (title && (
        title.toLowerCase().includes('bitcoin') ||
        title.toLowerCase().includes('btc') ||
        title.toLowerCase().includes('ethereum') ||
        title.toLowerCase().includes('eth') ||
        title.toLowerCase().includes('crypto')
      )) {
        titles.push(title);
      }
    }

    return titles.slice(0, 2).map(title => ({
      topic: truncateTitle(title, 40),
      sentiment: analyzeSentiment(title),
      mentions: 0,
      source: 'news'
    }));

  } catch (error) {
    console.error('[Trending] RSS fetch failed:', error.message);
    return [];
  }
}

// Fetch prediction market data from Polymarket API
async function fetchPolymarketData() {
  try {
    // Polymarket's gamma API for crypto-related markets
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?closed=false&limit=20',
      {
        headers: {
          'Accept': 'application/json'
        },
        next: { revalidate: 3600 }
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const markets = await response.json();

    if (!Array.isArray(markets) || markets.length === 0) {
      return null;
    }

    // Filter for crypto-related markets (BTC, ETH, crypto keywords)
    const cryptoMarkets = markets.filter(market => {
      const q = (market.question || '').toLowerCase();
      return q.includes('bitcoin') || q.includes('btc') ||
             q.includes('ethereum') || q.includes('eth') ||
             q.includes('crypto') || q.includes('solana') ||
             q.includes('coinbase') || q.includes('binance');
    });

    if (cryptoMarkets.length === 0) {
      // If no crypto markets, return top markets
      return formatPolymarkets(markets.slice(0, 5));
    }

    return formatPolymarkets(cryptoMarkets.slice(0, 5));

  } catch (error) {
    console.error('[Trending API] Polymarket fetch failed:', error.message);
    return null;
  }
}

function formatPolymarkets(markets) {
  const formattedMarkets = markets.map(market => {
    const prices = market.outcomePrices || [];
    const yesPrice = prices[0] ? Math.round(parseFloat(prices[0]) * 100) : 50;
    const noPrice = prices[1] ? Math.round(parseFloat(prices[1]) * 100) : 50;

    return {
      title: market.question || market.title || 'Unknown Market',
      yes: yesPrice,
      no: noPrice,
      volume: formatVolume(market.volume || market.volumeNum || 0),
      endDate: market.endDate || null
    };
  });

  return {
    markets: formattedMarkets,
    source: 'polymarket_real'
  };
}

// Helper: Analyze sentiment from text
function analyzeSentiment(text, upvoteRatio = 0.5) {
  const lower = text.toLowerCase();

  // Bullish keywords
  const bullish = ['surge', 'soar', 'rally', 'bullish', 'ath', 'all-time high', 'moon',
    'pump', 'gains', 'breakout', 'buy', 'accumulate', 'adoption', 'approved', 'etf approved'];

  // Bearish keywords
  const bearish = ['crash', 'dump', 'plunge', 'bearish', 'fear', 'sell', 'drop',
    'decline', 'loss', 'hack', 'scam', 'ban', 'rejected', 'sec', 'lawsuit'];

  const hasBullish = bullish.some(word => lower.includes(word));
  const hasBearish = bearish.some(word => lower.includes(word));

  if (hasBullish && !hasBearish) return 'bullish';
  if (hasBearish && !hasBullish) return 'bearish';
  if (upvoteRatio > 0.7) return 'bullish';
  if (upvoteRatio < 0.4) return 'bearish';
  return 'neutral';
}

// Helper: Truncate title
function truncateTitle(title, maxLen) {
  if (!title) return 'Unknown';
  if (title.length <= maxLen) return title;
  return title.substring(0, maxLen - 2) + '..';
}

// Helper: Deduplicate topics by similarity
function deduplicateTopics(topics) {
  const seen = new Set();
  return topics.filter(t => {
    const key = t.topic.toLowerCase().substring(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Helper: Format volume for display
function formatVolume(volume) {
  const num = parseFloat(volume) || 0;
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `$${(num / 1000).toFixed(0)}K`;
  }
  return `$${num.toFixed(0)}`;
}
