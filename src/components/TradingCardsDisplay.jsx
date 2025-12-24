import React, { useState, useEffect } from 'react';
import SimpleCard from '@/components/SimpleCard';
import './TradingCardsDisplay.css';

const TradingCardsDisplay = () => {
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  
  const [agentsData, setAgentsData] = useState([
    {
      id: 'RL80-PRIME',
      name: 'RL80',
      specialty: 'Autonomous Trader',
      image: '/wawa.jpg',
      status: 'active',
      stats: {
        successRate: 87,
        totalTrades: 1247,
        profit: '+324.5%'
      },
      currentInsight: 'Analyzing perpetual contracts. Strong bullish signal detected on ETH/USD. Executing long position with 3x leverage.',
      description: 'A virtuous and autonomous agent with one purpose: learn to trade perpetual contracts and maximize profits for her followers and token holders.'
    },
    {
      id: 'EMO-001',
      name: 'Emo',
      specialty: 'Sentiment Analysis',
      image: '/images/agent-placeholder.svg',
      status: 'active',
      stats: {
        successRate: 82,
        totalTrades: 892,
        profit: '+267.3%'
      },
      currentInsight: 'Market sentiment shifting to extreme greed. Social media mentions up 450%. Recommending defensive positioning.',
      description: 'Specialist in market sentiment, analyzing social signals and emotional market drivers.'
    },
    {
      id: 'MACRO-002',
      name: 'Macro',
      specialty: 'Macro Trends',
      image: '/images/agent-placeholder.svg',
      status: 'active',
      stats: {
        successRate: 79,
        totalTrades: 543,
        profit: '+198.7%'
      },
      currentInsight: 'Fed pivot indicators strengthening. DXY showing weakness. Favorable conditions for risk-on assets detected.',
      description: 'Macro trends specialist, tracking global economic indicators and policy shifts.'
    },
    {
      id: 'TEKNO-003',
      name: 'Tekno',
      specialty: 'Technical Analysis',
      image: '/images/agent-placeholder.svg',
      status: 'active',
      stats: {
        successRate: 91,
        totalTrades: 2103,
        profit: '+412.8%'
      },
      currentInsight: 'BTC forming ascending triangle on 4H. RSI divergence confirmed. Target: $52,000. Stop loss: $47,200.',
      description: 'Technical analysis expert, identifying patterns and executing precision trades.'
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