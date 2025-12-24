// Market Risk Appetite Calculator
// Combines multiple indicators to generate a 0-100 risk score

export function calculateMarketRiskAppetite(data) {
  const {
    // Crypto metrics
    btcPrice,
    btcChange24h = 0,
    ethPrice,
    ethChange24h = 0,
    fearGreedIndex = 50,
    
    // Traditional markets
    vix = 20,
    dxy = 100,
    dxyChange = 0,
    
    // Stablecoin flows
    stableFlowDirection = 'NEUTRAL',
    stableFlowMagnitude = 0,
    
    // Market structure
    btcDominance = 50,
    totalCryptoMcap = 2,
    defiTVL = 50,
    fundingRate = 0.01,
    openInterest = 15,
    
    // Volume metrics
    volume24h = 50,
    volumeChange24h = 0
  } = data;

  // Initialize component scores
  const scores = {
    price: 0,
    volatility: 0,
    sentiment: 0,
    flows: 0,
    structure: 0,
    macro: 0
  };

  // 1. Price Momentum Score (0-100)
  // Based on BTC and ETH price changes
  const avgPriceChange = (btcChange24h + ethChange24h) / 2;
  if (avgPriceChange > 10) scores.price = 100;
  else if (avgPriceChange > 5) scores.price = 85;
  else if (avgPriceChange > 2) scores.price = 70;
  else if (avgPriceChange > 0) scores.price = 55;
  else if (avgPriceChange > -2) scores.price = 45;
  else if (avgPriceChange > -5) scores.price = 30;
  else if (avgPriceChange > -10) scores.price = 15;
  else scores.price = 0;

  // 2. Volatility Score (0-100)
  // Lower VIX = higher risk appetite
  if (vix < 12) scores.volatility = 100;
  else if (vix < 15) scores.volatility = 85;
  else if (vix < 18) scores.volatility = 70;
  else if (vix < 22) scores.volatility = 50;
  else if (vix < 28) scores.volatility = 30;
  else if (vix < 35) scores.volatility = 15;
  else scores.volatility = 0;

  // 3. Sentiment Score (0-100)
  // Based on Fear & Greed Index
  scores.sentiment = fearGreedIndex;

  // 4. Capital Flows Score (0-100)
  // Based on stablecoin flows
  if (stableFlowDirection === 'IN') {
    // Inflows are bullish
    if (stableFlowMagnitude > 5) scores.flows = 100;
    else if (stableFlowMagnitude > 2) scores.flows = 85;
    else if (stableFlowMagnitude > 1) scores.flows = 70;
    else if (stableFlowMagnitude > 0.5) scores.flows = 60;
    else scores.flows = 55;
  } else if (stableFlowDirection === 'OUT') {
    // Outflows are bearish
    if (stableFlowMagnitude > 5) scores.flows = 0;
    else if (stableFlowMagnitude > 2) scores.flows = 15;
    else if (stableFlowMagnitude > 1) scores.flows = 30;
    else if (stableFlowMagnitude > 0.5) scores.flows = 40;
    else scores.flows = 45;
  } else {
    // Neutral flows
    scores.flows = 50;
  }

  // 5. Market Structure Score (0-100)
  // Based on funding rates, open interest, dominance
  let structureScore = 50;
  
  // Funding rate component
  if (fundingRate > 0.02) structureScore += 15; // Very bullish
  else if (fundingRate > 0.01) structureScore += 10;
  else if (fundingRate > 0) structureScore += 5;
  else if (fundingRate < -0.01) structureScore -= 10;
  else if (fundingRate < -0.02) structureScore -= 15; // Very bearish
  
  // Open interest component (higher OI = more risk appetite)
  if (openInterest > 20) structureScore += 15;
  else if (openInterest > 15) structureScore += 10;
  else if (openInterest > 10) structureScore += 5;
  else if (openInterest < 5) structureScore -= 10;
  
  // BTC dominance component (lower dominance = more risk appetite for alts)
  if (btcDominance < 40) structureScore += 10;
  else if (btcDominance < 45) structureScore += 5;
  else if (btcDominance > 60) structureScore -= 10;
  else if (btcDominance > 55) structureScore -= 5;
  
  scores.structure = Math.max(0, Math.min(100, structureScore));

  // 6. Macro Score (0-100)
  // Based on DXY and traditional markets
  let macroScore = 50;
  
  // DXY component (weaker dollar = risk on for crypto)
  if (dxyChange < -1) macroScore += 20;
  else if (dxyChange < -0.5) macroScore += 10;
  else if (dxyChange < 0) macroScore += 5;
  else if (dxyChange > 1) macroScore -= 20;
  else if (dxyChange > 0.5) macroScore -= 10;
  
  // DXY absolute level
  if (dxy < 100) macroScore += 10;
  else if (dxy < 102) macroScore += 5;
  else if (dxy > 106) macroScore -= 10;
  else if (dxy > 104) macroScore -= 5;
  
  scores.macro = Math.max(0, Math.min(100, macroScore));

  // Calculate weighted average for final score
  const weights = {
    price: 0.20,      // 20% - Current price action
    volatility: 0.15, // 15% - Market volatility
    sentiment: 0.25,  // 25% - Fear & Greed sentiment
    flows: 0.20,      // 20% - Capital flows
    structure: 0.10,  // 10% - Market structure
    macro: 0.10       // 10% - Macro environment
  };

  const finalScore = Math.round(
    scores.price * weights.price +
    scores.volatility * weights.volatility +
    scores.sentiment * weights.sentiment +
    scores.flows * weights.flows +
    scores.structure * weights.structure +
    scores.macro * weights.macro
  );

  // Determine risk regime
  let regime;
  if (finalScore >= 80) regime = 'EXTREME_GREED';
  else if (finalScore >= 65) regime = 'GREED';
  else if (finalScore >= 55) regime = 'RISK_ON';
  else if (finalScore >= 45) regime = 'NEUTRAL';
  else if (finalScore >= 35) regime = 'RISK_OFF';
  else if (finalScore >= 20) regime = 'FEAR';
  else regime = 'EXTREME_FEAR';

  // Generate signals based on score components
  const signals = [];
  
  if (scores.price > 70) signals.push('Strong Price Momentum');
  else if (scores.price < 30) signals.push('Price Weakness');
  
  if (scores.volatility > 70) signals.push('Low Volatility (Risk On)');
  else if (scores.volatility < 30) signals.push('High Volatility (Caution)');
  
  if (scores.flows > 70) signals.push('Strong Capital Inflows');
  else if (scores.flows < 30) signals.push('Capital Outflows');
  
  if (scores.sentiment > 70) signals.push('Bullish Sentiment');
  else if (scores.sentiment < 30) signals.push('Bearish Sentiment');
  
  if (scores.structure > 70) signals.push('Bullish Structure');
  else if (scores.structure < 30) signals.push('Weak Structure');

  return {
    score: finalScore,
    regime,
    components: scores,
    signals,
    weights,
    recommendation: getRecommendation(finalScore, regime)
  };
}

function getRecommendation(score, regime) {
  if (score >= 80) {
    return 'Extreme greed. Consider taking profits and reducing risk.';
  } else if (score >= 65) {
    return 'Market greedy. Stay bullish but watch for reversals.';
  } else if (score >= 55) {
    return 'Risk-on environment. Favorable for long positions.';
  } else if (score >= 45) {
    return 'Neutral market. Trade with caution, wait for clear signals.';
  } else if (score >= 35) {
    return 'Risk-off sentiment. Reduce exposure, focus on quality.';
  } else if (score >= 20) {
    return 'Market fearful. Look for contrarian opportunities.';
  } else {
    return 'Extreme fear. Potential bottoming zone for brave buyers.';
  }
}

export default calculateMarketRiskAppetite;