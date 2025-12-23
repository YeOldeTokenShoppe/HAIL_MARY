// Comprehensive Market Data API
// Fetches VIX, DXY, Treasury yields, and crypto metrics

export default async function handler(req, res) {
  try {
    const results = await Promise.allSettled([
      fetchYahooFinance(),
      fetchCryptoMetrics(),
      fetchFundingRates(),
      fetchOpenInterest()
    ]);

    const marketData = results[0].status === 'fulfilled' ? results[0].value : {};
    const cryptoMetrics = results[1].status === 'fulfilled' ? results[1].value : {};
    const fundingData = results[2].status === 'fulfilled' ? results[2].value : {};
    const oiData = results[3].status === 'fulfilled' ? results[3].value : {};

    // Check if request is from TickerDisplay3 (expects array format)
    // or from useLighterAPI (expects object format)
    const format = req.query.format;
    
    if (format === 'ticker' || !format) {
      // Return array format for TickerDisplay3 (default for backward compatibility)
      const tickerData = [];
      
      // Add market indices
      if (marketData.sp500) {
        tickerData.push({
          name: "S&P 500",
          symbol: "^GSPC",
          price: marketData.sp500.value,
          changePercent: marketData.sp500.changePercent
        });
      }
      if (marketData.nasdaq) {
        tickerData.push({
          name: "Nasdaq",
          symbol: "^IXIC",
          price: marketData.nasdaq.value,
          changePercent: marketData.nasdaq.changePercent
        });
      }
      if (marketData.vix) {
        tickerData.push({
          name: "VIX",
          symbol: "^VIX",
          price: marketData.vix.value,
          changePercent: marketData.vix.changePercent
        });
      }
      if (marketData.dxy) {
        tickerData.push({
          name: "Dollar Index",
          symbol: "DX-Y.NYB",
          price: marketData.dxy.value,
          changePercent: marketData.dxy.changePercent
        });
      }
      if (marketData.gold) {
        tickerData.push({
          name: "Gold",
          symbol: "GC=F",
          price: marketData.gold.value,
          changePercent: marketData.gold.changePercent
        });
      }
      if (marketData.treasury10Y) {
        tickerData.push({
          name: "10Y Treasury Yield",
          symbol: "^TNX",
          price: marketData.treasury10Y.value,
          changePercent: marketData.treasury10Y.changePercent
        });
      }
      
      res.status(200).json(tickerData);
    } else {
      // Return object format for useLighterAPI
      res.status(200).json({
        success: true,
        data: {
          ...marketData,
          ...cryptoMetrics,
          ...fundingData,
          ...oiData,
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('Market data API error:', error);
    
    // Return fallback in appropriate format
    const format = req.query.format;
    if (format === 'ticker' || !format) {
      res.status(200).json([
        { name: "S&P 500", symbol: "^GSPC", price: 5231.3, changePercent: 0.5 },
        { name: "Nasdaq", symbol: "^IXIC", price: 16423.5, changePercent: 0.7 },
        { name: "VIX", symbol: "^VIX", price: 14.2, changePercent: -2.4 },
        { name: "Gold", symbol: "GC=F", price: 2328.7, changePercent: -0.3 }
      ]);
    } else {
      res.status(200).json({
        success: false,
        data: getFallbackData()
      });
    }
  }
}

// Fetch traditional market data from Yahoo Finance
async function fetchYahooFinance() {
  try {
    // Using RapidAPI Yahoo Finance (you may need to add your key)
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    
    if (!rapidApiKey) {
      // If no API key, try free Yahoo Finance v8 API
      const symbols = ['^VIX', '^DJI', '^GSPC', '^IXIC', 'DX-Y.NYB', 'GC=F', '^TNX'];
      const data = {};
      
      // Yahoo Finance free API (may have CORS issues server-side)
      for (const symbol of symbols) {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            const quote = result.chart.result[0].meta;
            const prevClose = quote.previousClose || quote.regularMarketPrice;
            const currentPrice = quote.regularMarketPrice;
            
            // Map symbols to friendly names
            const nameMap = {
              '^VIX': 'vix',
              '^DJI': 'dowJones', 
              '^GSPC': 'sp500',
              '^IXIC': 'nasdaq',
              'DX-Y.NYB': 'dxy',
              'GC=F': 'gold',
              '^TNX': 'treasury10Y'
            };
            
            data[nameMap[symbol]] = {
              value: currentPrice,
              change: currentPrice - prevClose,
              changePercent: ((currentPrice - prevClose) / prevClose) * 100
            };
          }
        } catch (err) {
          console.error(`Failed to fetch ${symbol}:`, err.message);
        }
      }
      
      // Try to fetch Fed Funds Rate (30-Day Fed Funds Futures)
      try {
        const fedResponse = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/ZQ=F', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (fedResponse.ok) {
          const fedResult = await fedResponse.json();
          const fedQuote = fedResult.chart.result[0].meta;
          const fedPrice = fedQuote.regularMarketPrice;
          
          // Fed Funds futures price needs to be converted to rate
          // The price is typically 100 - rate, so rate = 100 - price
          // But for more accurate Fed Funds rate, we'd need FRED API
          data.fedRate = 100 - fedPrice;
          data.fedRateChange = -fedQuote.regularMarketChange;
        }
      } catch (err) {
        console.log('Fed rate fetch failed, will use fallback');
      }
      
      return data;
    }
    
    // If RapidAPI key exists, use it for more reliable data
    const options = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'yahoo-finance15.p.rapidapi.com'
      }
    };
    
    const vixResponse = await fetch(
      'https://yahoo-finance15.p.rapidapi.com/api/yahoo/qu/quote/^VIX',
      options
    );
    const vixData = await vixResponse.json();
    
    return {
      vix: {
        value: vixData[0]?.regularMarketPrice || 20,
        change: vixData[0]?.regularMarketChange || 0,
        changePercent: vixData[0]?.regularMarketChangePercent || 0
      }
    };
  } catch (error) {
    console.error('Yahoo Finance fetch error:', error);
    return {
      vix: { value: 20, change: 0, changePercent: 0 },
      dxy: { value: 100, change: 0, changePercent: 0 },
      fedRate: 5.0,
      fedRateChange: 0
    };
  }
}

// Fetch crypto market metrics
async function fetchCryptoMetrics() {
  try {
    // Use CoinGecko for market dominance and total market cap
    const coinGeckoKey = process.env.COINGECKO_API_KEY;
    const baseUrl = coinGeckoKey 
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
    
    const headers = coinGeckoKey ? { 'x-cg-pro-api-key': coinGeckoKey } : {};
    
    // Fetch global data for dominance and market caps
    const globalResponse = await fetch(`${baseUrl}/global`, { headers });
    const globalData = await globalResponse.json();
    
    const btcDominance = globalData.data?.market_cap_percentage?.btc || 50;
    const totalMarketCap = globalData.data?.total_market_cap?.usd || 2e12;
    const totalVolume = globalData.data?.total_volume?.usd || 100e9;
    
    // Fetch top coins for individual market caps
    const coinsResponse = await fetch(
      `${baseUrl}/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&order=market_cap_desc`,
      { headers }
    );
    const coinsData = await coinsResponse.json();
    
    return {
      btcDominance: {
        value: btcDominance,
        change: globalData.data?.market_cap_change_percentage_24h_usd || 0
      },
      totalCryptoMcap: totalMarketCap / 1e12, // Convert to trillions
      totalVolume24h: totalVolume / 1e9, // Convert to billions
      btcPrice: coinsData[0]?.current_price || 0,
      btcChange24h: coinsData[0]?.price_change_percentage_24h || 0,
      ethPrice: coinsData[1]?.current_price || 0,
      ethChange24h: coinsData[1]?.price_change_percentage_24h || 0
    };
  } catch (error) {
    console.error('Crypto metrics fetch error:', error);
    return {
      btcDominance: { value: 50, change: 0 },
      totalCryptoMcap: 2.5,
      totalVolume24h: 100
    };
  }
}

// Fetch funding rates from exchanges
async function fetchFundingRates() {
  try {
    // Binance perpetual funding rates
    const response = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT');
    const data = await response.json();
    
    const fundingRate = parseFloat(data.lastFundingRate || 0.0001);
    const markPrice = parseFloat(data.markPrice || 0);
    
    // Also fetch ETH funding
    const ethResponse = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=ETHUSDT');
    const ethData = await ethResponse.json();
    const ethFunding = parseFloat(ethData.lastFundingRate || 0.0001);
    
    // Average the major pairs
    const avgFunding = (fundingRate + ethFunding) / 2;
    
    return {
      fundingRate: {
        value: avgFunding,
        btc: fundingRate,
        eth: ethFunding,
        // Convert to percentage (funding rates are typically 8-hour)
        percentageAnnualized: avgFunding * 3 * 365 * 100 // 3 times per day * 365 days
      }
    };
  } catch (error) {
    console.error('Funding rate fetch error:', error);
    return {
      fundingRate: {
        value: 0.01,
        btc: 0.01,
        eth: 0.01,
        percentageAnnualized: 10.95
      }
    };
  }
}

// Fetch open interest data
async function fetchOpenInterest() {
  try {
    // First try CoinMarketCap if we have API key
    const cmcApiKey = process.env.NEXT_PUBLIC_COINMARKETCAP || process.env.COINMARKETCAP_API_KEY;
    
    if (cmcApiKey) {
      try {
        // Try to get global metrics which includes derivatives data
        const globalResponse = await fetch('https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest', {
          headers: {
            'X-CMC_PRO_API_KEY': cmcApiKey,
            'Accept': 'application/json'
          }
        });
        
        if (globalResponse.ok) {
          const globalData = await globalResponse.json();
          console.log('CMC Global Metrics Response:', JSON.stringify(globalData.data, null, 2));
          
          // Log all available fields to see what CMC provides
          console.log('Available CMC fields:', Object.keys(globalData.data));
          
          // Check for actual open interest fields
          // CMC might have fields like: total_open_interest, derivatives_open_interest, etc.
          const openInterest = globalData.data?.total_open_interest || 
                              globalData.data?.derivatives_open_interest ||
                              globalData.data?.open_interest;
          
          if (openInterest) {
            console.log('CMC Open Interest found:', openInterest, '/', openInterest / 1e9, 'B');
            
            // Return the raw value from CMC
            return {
              openInterest: {
                value: openInterest / 1e9,
                btc: (openInterest * 0.6) / 1e9,
                eth: (openInterest * 0.2) / 1e9,
                change24h: 0
              }
            };
          }
          
          // Skip derivatives volume estimation - it's not accurate
          console.log('No direct OI data from CMC, skipping to next source');
        }
      } catch (cmcError) {
        console.log('CMC global metrics fetch failed:', cmcError.message);
      }
    }
    
    // Try CoinGecko derivatives API
    const coinGeckoKey = process.env.COINGECKO_API_KEY;
    const baseUrl = coinGeckoKey 
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
    
    const headers = coinGeckoKey ? { 'x-cg-pro-api-key': coinGeckoKey } : {};
    
    try {
      // Fetch derivatives exchanges data
      const derivativesResponse = await fetch(`${baseUrl}/derivatives/exchanges`, { headers });
      
      if (derivativesResponse.ok) {
        const derivativesData = await derivativesResponse.json();
        
        // Sum up open interest from all exchanges
        let totalOpenInterest = 0;
        console.log('CoinGecko derivatives exchanges count:', derivativesData.length);
        
        derivativesData.forEach(exchange => {
          if (exchange.open_interest_btc) {
            totalOpenInterest += exchange.open_interest_btc;
            console.log(`${exchange.name}: ${exchange.open_interest_btc} BTC`);
          }
        });
        
        console.log('Total OI in BTC from CoinGecko:', totalOpenInterest);
        
        // Get BTC price to convert to USD
        const priceResponse = await fetch(`${baseUrl}/simple/price?ids=bitcoin&vs_currencies=usd`, { headers });
        const priceData = await priceResponse.json();
        const btcPrice = priceData.bitcoin?.usd || 60000;
        
        const totalOIinUSD = totalOpenInterest * btcPrice;
        
        console.log('CoinGecko Open Interest:', {
          totalOpenInterestBTC: totalOpenInterest,
          btcPrice,
          totalOIinUSD: totalOIinUSD / 1e9
        });
        
        // Return the actual calculated value without caps
        if (totalOIinUSD > 0) {
          return {
            openInterest: {
              value: totalOIinUSD / 1e9, // Convert to billions
              btc: (totalOIinUSD * 0.6) / 1e9, // Estimate BTC is 60% of total OI
              eth: (totalOIinUSD * 0.2) / 1e9, // Estimate ETH is 20% of total OI
              change24h: 0
            }
          };
        }
      }
    } catch (geckoError) {
      console.log('CoinGecko derivatives fetch failed:', geckoError.message);
    }
    
    // Try alternative: use CoinGlass public endpoint (no auth needed)
    try {
      const coinglassResponse = await fetch('https://api.coinglass.com/api/futures/openInterest/chart?symbol=BTC&interval=1d&limit=1');
      
      if (coinglassResponse.ok) {
        const coinglassData = await coinglassResponse.json();
        
        if (coinglassData.data && coinglassData.data.length > 0) {
          const latestOI = coinglassData.data[0];
          const totalOI = latestOI.totalOpenInterest || 0;
          
          console.log('CoinGlass Open Interest:', totalOI / 1e9);
          
          return {
            openInterest: {
              value: totalOI / 1e9,
              btc: (totalOI * 0.6) / 1e9,
              eth: (totalOI * 0.2) / 1e9,
              change24h: 0
            }
          };
        }
      }
    } catch (coinglassError) {
      console.log('CoinGlass API failed:', coinglassError.message);
    }
    
    // Return 0 if no data source works
    return {
      openInterest: {
        value: 0,
        btc: 0,
        eth: 0,
        change24h: 0
      }
    };
  } catch (error) {
    console.error('Open interest fetch error:', error.message);
    return {
      openInterest: {
        value: 0,
        btc: 0,
        eth: 0,
        change24h: 0
      }
    };
  }
}

// Fallback data when APIs fail
function getFallbackData() {
  return {
    vix: { value: 20, change: -0.5, changePercent: -2.4 },
    dxy: { value: 100, change: -0.3, changePercent: -0.29 },
    treasury10Y: { value: 4.25, change: -0.02, changePercent: -0.47 },
    btcDominance: { value: 50, change: 0.5 },
    totalCryptoMcap: 2.5,
    fundingRate: { value: 0.01, percentageAnnualized: 10.95 },
    openInterest: { value: 20, change24h: 2 },
    fedRate: 5.0,
    fedRateChange: -0.25,
    nextFOMC: 'Dec 18',
    rateCutProb: 85,
    timestamp: new Date().toISOString()
  };
}