// API Route for Fear & Greed Index
// Fetches real-time crypto market sentiment from CoinMarketCap

export default async function handler(req, res) {
  try {
    // Use CoinMarketCap API if key is available
    const cmcApiKey = process.env.NEXT_PUBLIC_COINMARKETCAP || process.env.COINMARKETCAP_API_KEY;
    
    if (cmcApiKey) {
      // Fetch Fear & Greed from CoinMarketCap
      const response = await fetch('https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest', {
        headers: {
          'X-CMC_PRO_API_KEY': cmcApiKey,
          'Accept': 'application/json'
        }
      });
      
      const cmcData = await response.json();
      
      if (cmcData && cmcData.data) {
        const fngValue = cmcData.data.value;
        const classification = getClassification(fngValue);
        
        return res.status(200).json({
          success: true,
          data: {
            value: Math.round(fngValue),
            classification: classification,
            timestamp: cmcData.data.timestamp || new Date().toISOString(),
            components: cmcData.data.components || {},
            color: getColorForValue(fngValue),
            emoji: getEmojiForValue(fngValue)
          }
        });
      }
    }
    
    // Fallback to Alternative.me API if CMC is not available
    const response = await fetch('https://api.alternative.me/fng/?limit=1');
    const data = await response.json();
    
    if (data && data.data && data.data[0]) {
      const fngData = data.data[0];
      
      res.status(200).json({
        success: true,
        data: {
          value: parseInt(fngData.value),
          classification: fngData.value_classification,
          timestamp: fngData.timestamp,
          timeUntilUpdate: fngData.time_until_update,
          
          // Add color and emoji for UI
          color: getColorForValue(parseInt(fngData.value)),
          emoji: getEmojiForValue(parseInt(fngData.value))
        }
      });
    } else {
      throw new Error('Invalid response from Fear & Greed API');
    }
  } catch (error) {
    console.error('Fear & Greed API error:', error);
    
    // Return fallback data
    res.status(200).json({
      success: false,
      data: {
        value: 50, // Neutral fallback
        classification: 'Neutral',
        timestamp: new Date().toISOString(),
        color: '#ffdd00',
        emoji: '😐'
      }
    });
  }
}

function getClassification(value) {
  if (value <= 20) return 'Extreme Fear';
  if (value <= 40) return 'Fear';
  if (value <= 60) return 'Neutral';
  if (value <= 80) return 'Greed';
  return 'Extreme Greed';
}

function getColorForValue(value) {
  if (value <= 20) return '#ff3333'; // Extreme Fear - Red
  if (value <= 40) return '#ff9500'; // Fear - Orange
  if (value <= 60) return '#ffdd00'; // Neutral - Yellow
  if (value <= 80) return '#34c759'; // Greed - Green
  return '#00ff00'; // Extreme Greed - Bright Green
}

function getEmojiForValue(value) {
  if (value <= 20) return '😱'; // Extreme Fear
  if (value <= 40) return '😨'; // Fear
  if (value <= 60) return '😐'; // Neutral
  if (value <= 80) return '😊'; // Greed
  return '🤑'; // Extreme Greed
}