import React, { useRef, useState, useEffect } from 'react';
import './RL80TraderCard.css';

const RL80TraderCard = ({
  agentData,
  className = "",
  onClose
}) => {
  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // Comprehensive agent database with all trading card info
  const agentsDatabase = {
    'RL80': {
      name: 'RL80',
      subtitle: 'The Oracle',
      specialty: 'Council Leader',
      icon: '👑',
      tagline: 'Orchestrating Victory',
      rarity: 'legendary',
      level: 15,
      class: 'rl80',
      image: '/images/Headshot_RL80.webp', // Update this path
      bio: 'Supreme commander of the trading council. Aggregates specialist insights to make final trading decisions.',
      thesis: 'Synthesizing macro data, sentiment indicators, and technical patterns. Strong confluence detected on ETH/USD. Executing calculated long position with 3x leverage. Risk-reward ratio: 1:4.2',
      stats: {
        wins: 1085,
        losses: 162,
        winRate: 87,
        totalTrades: 1247,
        profit: '+324.5%',
        level: 15
      },
      knowledgeSources: [
        'Real-time market data feeds',
        'Council member analyses',
        'Historical pattern database',
        'Risk management protocols'
      ],
      status: 'Trading'
    },
    'Emo': {
      name: 'Emo',
      subtitle: 'The Empath',
      specialty: 'Sentiment Analysis',
      icon: '🎭',
      tagline: 'Reading the Market\'s Mind',
      rarity: 'epic',
      level: 11,
      class: 'sentiment',
      image: '/images/Headshot_Emo.webp', // Update this path
      bio: 'Emotional intelligence expert. Analyzes social trends, news sentiment, and crowd psychology to detect market shifts.',
      thesis: 'Market sentiment shifting to extreme greed (F&G: 82). Social mentions up 450% in 24hrs. Whale accumulation detected. High volatility incoming - defensive positioning recommended.',
      stats: {
        wins: 731,
        losses: 161,
        winRate: 82,
        totalTrades: 892,
        profit: '+267.3%',
        level: 11
      },
      knowledgeSources: [
        'Twitter/X sentiment analysis',
        'Reddit trends',
        'Fear & Greed Index',
        'Whale wallet movements'
      ],
      status: 'Listening'
    },
    'Macro': {
      name: 'Macro',
      subtitle: 'The Economist',
      specialty: 'Macroeconomic Analysis',
      icon: '🌍',
      tagline: 'Seeing the Bigger Picture',
      rarity: 'epic',
      level: 9,
      class: 'macro',
      image: '/images/Headshot_Macro.webp', // Update this path
      bio: 'Global strategist. Tracks central bank policies, inflation data, interest rates, and geopolitical events.',
      thesis: 'Fed pivot probability increasing - CME FedWatch showing 78% odds of rate cut in Q2. DXY breaking support at 103.5. Strong tailwinds for risk-on assets and crypto.',
      stats: {
        wins: 429,
        losses: 114,
        winRate: 79,
        totalTrades: 543,
        profit: '+198.7%',
        level: 9
      },
      knowledgeSources: [
        'Federal Reserve statements',
        'CME FedWatch Tool',
        'DXY (Dollar Index)',
        'Treasury yield curves'
      ],
      status: 'Scanning'
    },
    'Tekno': {
      name: 'Tekno',
      subtitle: 'The Chartist',
      specialty: 'Technical Analysis',
      icon: '📈',
      tagline: 'Patterns Never Lie',
      rarity: 'epic',
      level: 13,
      class: 'technical',
      image: '/images/Headshot_Tekno.webp', // Update this path
      bio: 'Chart wizard. Lives and breathes price action, candlestick patterns, indicators, and support/resistance.',
      thesis: 'BTC forming textbook ascending triangle on 4H. RSI bullish divergence on daily. Volume confirms accumulation. Target: $52k. Stop: $47.2k. Fib 0.618 holding support.',
      stats: {
        wins: 1914,
        losses: 189,
        winRate: 91,
        totalTrades: 2103,
        profit: '+412.8%',
        level: 13
      },
      knowledgeSources: [
        'Multi-timeframe price data',
        'Order book analysis',
        'Pattern recognition AI',
        'Liquidation heatmaps'
      ],
      status: 'Analyzing'
    }
  };

  // Get agent info from database, fallback to passed agentData
  const getAgentInfo = (agentName) => {
    return agentsDatabase[agentName] || {
      name: agentName,
      subtitle: 'Trading Agent',
      specialty: 'Autonomous Trader',
      icon: '🤖',
      tagline: 'Trading the Markets',
      rarity: 'rare',
      level: 1,
      class: 'default',
      bio: agentData.description || 'An autonomous trading agent.',
      thesis: agentData.description || 'Analyzing market conditions...',
      stats: {
        wins: 0,
        losses: 0,
        winRate: 0,
        totalTrades: 0,
        profit: '+0%',
        level: 1
      },
      knowledgeSources: ['Market data feeds'],
      status: 'Active'
    };
  };

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);

    // Add escape key handler
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!agentData) return null;

  const agent = getAgentInfo(agentData.name);

  const handleBackdropClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleCardClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFlipped(!isFlipped);
  };

  const handleFlip = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFlipped(!isFlipped);
  };

  return (
    <div
      className={`rl80-card-wrapper ${isVisible ? 'visible' : ''}`}
      onClick={handleBackdropClick}
      onTouchEnd={handleBackdropClick}
    >
      <div
        className={`rl80-card-container ${agent.class} ${agent.rarity} ${isFlipped ? 'flipped' : ''}`}
        ref={cardRef}
        onClick={handleFlip}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFlip(e);
        }}
      >
        <div className="card-flip-inner">
          {/* FRONT OF CARD */}
          <div
            className="card-front"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: agent.rarity === 'legendary'
                ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 25%, #ff6b6b 75%, #9333ea 100%)'
                : agent.rarity === 'epic'
                ? 'linear-gradient(135deg, #c084fc 0%, #a855f7 50%, #9333ea 100%)'
                : 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
              borderRadius: '20px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transform: 'rotateY(0deg)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              boxShadow: '0 0 30px rgba(0, 0, 0, 0.5), 0 0 60px rgba(168, 85, 247, 0.4), 0 0 0 4px #7c3aed inset',
              overflow: 'hidden',
              fontFamily: 'Rubik, sans-serif',
              pointerEvents: 'none'
            }}
          >
          <div className="circuit-pattern"></div>
          <div className="holo-sheen"></div>

          {/* Card Header - Name and Level */}
          <div className="card-header">
            <div className="header-left">
              <div className="agent-name">{agent.name}</div>
              <div className="agent-subtitle">{agent.subtitle}</div>
            </div>
            <div className="level-badge">
              <span className="level-label">LV</span>
              <span className="level-value">{agent.level}</span>
            </div>
          </div>

          {/* Specialty Badge */}
          <div className="specialty-badge">
            <span className="specialty-icon">{agent.icon}</span>
            <span className="specialty-text">{agent.specialty}</span>
          </div>

          {/* Mobile-only Agent Image */}
          <div className="mobile-agent-image">
            <img src={agent.image || '/wawa.jpg'} alt={agent.name} />
          </div>

          {/* Tagline - Prominent */}
          <div className="tagline-box">
            <div className="tagline-text">{agent.tagline}</div>
          </div>

          {/* Character Bio */}
          <div className="card-section bio-section">
            <div className="section-header">
              <span className="section-icon">📖</span>
              <span className="section-title">AGENT PROFILE</span>
            </div>
            <p className="bio-text">{agent.bio}</p>
          </div>

          {/* Current Thesis */}
          <div className="card-section thesis-section">
            <div className="section-header">
              <span className="section-icon">💭</span>
              <span className="section-title">CURRENT THESIS</span>
            </div>
            <p className="thesis-text">{agent.thesis}</p>
          </div>

          {/* Card Footer */}
          <div className="card-footer">
            <div className="status">
              <div className="status-dot"></div>
              <span>{agent.status}</span>
            </div>
            <div className="rarity-badge">{agent.rarity.toUpperCase()}</div>
            <div className="flip-hint">Click to flip ⟳</div>
          </div>
        </div>

          {/* BACK OF CARD */}
          <div
            className="card-back"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: agent.rarity === 'legendary'
                ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 25%, #ff6b6b 75%, #9333ea 100%)'
                : agent.rarity === 'epic'
                ? 'linear-gradient(135deg, #c084fc 0%, #a855f7 50%, #9333ea 100%)'
                : 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
              borderRadius: '20px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transform: 'rotateY(-180deg)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              boxShadow: '0 0 30px rgba(0, 0, 0, 0.5), 0 0 60px rgba(168, 85, 247, 0.4), 0 0 0 4px #7c3aed inset',
              overflow: 'hidden',
              fontFamily: 'Rubik, sans-serif',
              pointerEvents: 'none'
            }}
          >
          <div className="circuit-pattern"></div>
          <div className="holo-sheen"></div>

          {/* Card Header */}
          <div className="card-header">
            <div className="header-left">
              <div className="agent-name">{agent.name}</div>
              <div className="agent-subtitle">Performance Stats</div>
            </div>
            <div className="level-badge">
              <span className="level-label">LV</span>
              <span className="level-value">{agent.level}</span>
            </div>
          </div>

          {/* Win/Loss Stats */}
          <div className="card-section stats-section">
            <div className="section-header">
              <span className="section-icon">⚔️</span>
              <span className="section-title">BATTLE RECORD</span>
            </div>
            <div className="stats-compact">
              <div className="stat-compact">
                <span className="stat-compact-label">Win Rate:</span>
                <span className="stat-compact-value">{agent.stats.winRate}%</span>
              </div>
              <div className="stat-compact">
                <span className="stat-compact-label">Wins:</span>
                <span className="stat-compact-value">{agent.stats.wins}</span>
              </div>
              <div className="stat-compact">
                <span className="stat-compact-label">Losses:</span>
                <span className="stat-compact-value">{agent.stats.losses}</span>
              </div>
              <div className="stat-compact">
                <span className="stat-compact-label">Total Trades:</span>
                <span className="stat-compact-value">{agent.stats.totalTrades}</span>
              </div>
              <div className="stat-compact highlight">
                <span className="stat-compact-label">Total Profit:</span>
                <span className="stat-compact-value">{agent.stats.profit}</span>
              </div>
            </div>
          </div>

          {/* Knowledge Sources */}
          <div className="card-section sources-section">
            <div className="section-header">
              <span className="section-icon">📚</span>
              <span className="section-title">KNOWLEDGE BASE</span>
            </div>
            <div className="sources-list">
              {agent.knowledgeSources.map((source, idx) => (
                <div key={idx} className="source-item">
                  <span className="source-bullet">▸</span>
                  <span className="source-text">{source}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card Footer */}
          <div className="card-footer">
            <div className="status">
              <div className="status-dot"></div>
              <span>{agent.status}</span>
            </div>
            <div className="rarity-badge">{agent.rarity.toUpperCase()}</div>
            <div className="flip-hint">Click to flip ⟳</div>
          </div>
          </div>
        </div>
      </div>

      <div className="close-hint">Tap outside to close</div>
    </div>
  );
};

export default RL80TraderCard;