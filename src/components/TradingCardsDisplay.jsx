import React, { useState, useEffect } from 'react';
import SimpleCard from '@/components/SimpleCard';
import './TradingCardsDisplay.css';

const TradingCardsDisplay = () => {
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  
  const [agentsData, setAgentsData] = useState([
    {
      id: 'RL80-PRIME',
      name: 'RL80',
      subtitle: 'The Oracle',
      specialty: 'Council Leader',
      specialtyIcon: '👑',
      tagline: 'Orchestrating the Perfect Trade',
      image: '/wawa.jpg',
      status: 'active',
      rarity: 'legendary',
      level: 15,
      stats: {
        successRate: 87,
        totalTrades: 1247,
        wins: 1085,
        profit: '+324.5%'
      },
      currentInsight: 'Synthesizing macro data, sentiment indicators, and technical patterns. Strong confluence detected on ETH/USD. Executing calculated long position with 3x leverage. Risk-reward ratio: 1:4.2',
      description: 'The supreme commander of the trading council. RL80 aggregates insights from all specialist agents, weighing their expertise to make final trading decisions. A virtuous autonomous agent with one purpose: maximize profits for her followers and token holders.',
      knowledgeSources: [
        'Real-time market data feeds',
        'Council member analyses',
        'Historical pattern database',
        'Risk management protocols',
        'Position sizing algorithms'
      ]
    },
    {
      id: 'EMO-001',
      name: 'Emo',
      subtitle: 'The Empath',
      specialty: 'Sentiment Analysis',
      specialtyIcon: '🎭',
      tagline: 'Reading the Market\'s Mind',
      image: '/images/agent-placeholder.svg',
      status: 'active',
      rarity: 'epic',
      level: 11,
      stats: {
        successRate: 82,
        totalTrades: 892,
        wins: 731,
        profit: '+267.3%'
      },
      currentInsight: 'Market sentiment shifting to extreme greed (Fear & Greed Index: 82). Social media crypto mentions up 450% in 24hrs. Whale wallets showing accumulation. High volatility incoming - recommending defensive positioning on existing longs.',
      description: 'The council\'s emotional intelligence expert. Emo analyzes social media trends, news sentiment, and crowd psychology to detect market mood shifts before they happen. She can smell FOMO and panic from miles away.',
      knowledgeSources: [
        'Twitter/X sentiment analysis',
        'Reddit r/CryptoCurrency trends',
        'Fear & Greed Index',
        'Google Trends data',
        'Whale wallet movements',
        'News sentiment aggregators'
      ]
    },
    {
      id: 'MACRO-002',
      name: 'Macro',
      subtitle: 'The Economist',
      specialty: 'Macroeconomic Analysis',
      specialtyIcon: '🌍',
      tagline: 'Seeing the Bigger Picture',
      image: '/images/agent-placeholder.svg',
      status: 'active',
      rarity: 'epic',
      level: 9,
      stats: {
        successRate: 79,
        totalTrades: 543,
        wins: 429,
        profit: '+198.7%'
      },
      currentInsight: 'Fed pivot probability increasing - CME FedWatch showing 78% odds of rate cut in Q2. DXY breaking key support at 103.5, showing dollar weakness. Treasury yields declining. Strong tailwinds for risk-on assets and crypto. BTC correlation to tech stocks weakening.',
      description: 'The council\'s global strategist. Macro tracks central bank policies, inflation data, interest rates, and geopolitical events that move markets. He thinks in quarters and years while others think in hours.',
      knowledgeSources: [
        'Federal Reserve statements',
        'CME FedWatch Tool',
        'DXY (Dollar Index) data',
        'Treasury yield curves',
        'CPI & inflation reports',
        'Global liquidity indicators',
        'Geopolitical news feeds'
      ]
    },
    {
      id: 'TEKNO-003',
      name: 'Tekno',
      subtitle: 'The Chartist',
      specialty: 'Technical Analysis',
      specialtyIcon: '📈',
      tagline: 'Patterns Never Lie',
      image: '/images/agent-placeholder.svg',
      status: 'active',
      rarity: 'epic',
      level: 13,
      stats: {
        successRate: 91,
        totalTrades: 2103,
        wins: 1914,
        profit: '+412.8%'
      },
      currentInsight: 'BTC forming textbook ascending triangle on 4H timeframe. RSI showing bullish divergence on daily. Volume profile confirms accumulation zone. Breakout target: $52,000. Stop loss: $47,200. Fibonacci 0.618 retracement holding as support.',
      description: 'The council\'s chart wizard. Tekno lives and breathes price action, candlestick patterns, indicators, and support/resistance levels. She can spot a bull flag forming before most humans even open their charts.',
      knowledgeSources: [
        'Multi-timeframe price data',
        'Order book & volume analysis',
        'Support/resistance databases',
        'Pattern recognition algorithms',
        'RSI, MACD, Fibonacci tools',
        'On-chain metrics',
        'Liquidation heatmaps'
      ]
    }
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setAgentsData(prev => prev.map(agent => ({
        ...agent,
        stats: {
          ...agent.stats,
          totalTrades: agent.stats.totalTrades + Math.floor(Math.random() * 3)
        }
      })));
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const handlePrev = () => {
    setActiveCardIndex(i => i > 0 ? i - 1 : i);
  };

  const handleNext = () => {
    setActiveCardIndex(i => i < agentsData.length - 1 ? i + 1 : i);
  };

  return (
    <div className="trading-cards-container">
      <div className="cards-header">
        <h2>AI Trading Council</h2>
        <p>Navigate with arrows • Click cards to flip</p>
      </div>
      
      <div className="carousel">
        {activeCardIndex > 0 && (
          <button className="nav left" onClick={handlePrev}>
            ‹
          </button>
        )}
        
        {agentsData.map((agent, i) => {
          let className = 'card-container';
          if (i === activeCardIndex) {
            className += ' active';
          } else if (i === activeCardIndex - 1) {
            className += ' prev';
          } else if (i === activeCardIndex + 1) {
            className += ' next';
          } else {
            className += ' hidden';
          }
          
          return (
            <div 
              key={agent.id}
              className={className}
            >
              <SimpleCard 
                agent={agent}
                isActive={i === activeCardIndex}
                className="carousel-card"
              />
            </div>
          );
        })}
        
        {activeCardIndex < agentsData.length - 1 && (
          <button className="nav right" onClick={handleNext}>
            ›
          </button>
        )}
      </div>
      
      <div className="card-indicators">
        {agentsData.map((_, index) => (
          <button
            key={index}
            className={`indicator ${activeCardIndex === index ? 'active' : ''}`}
            aria-label={`Agent ${index + 1}`}
            onClick={() => setActiveCardIndex(index)}
          />
        ))}
      </div>
      
      <div className="council-status">
        <div className="status-item">
          <span className="status-label">Council Status:</span>
          <span className="status-value active">ONLINE</span>
        </div>
        <div className="status-item">
          <span className="status-label">Active Agent:</span>
          <span className="status-value">{agentsData[activeCardIndex].name}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Total Profit:</span>
          <span className="status-value">+1203.3%</span>
        </div>
      </div>
    </div>
  );
};

export default TradingCardsDisplay;