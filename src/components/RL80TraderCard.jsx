import React, { useRef, useState, useEffect } from 'react';
import './RL80TraderCard.css';

const RL80TraderCard = ({
  agentData,
  className = "",
  onClose,
  // Scoring system integration props
  latestScores = null,      // { BTC: { direction, confidence }, ETH: {...}, ... }
  latestDecision = null,    // { recommendations: [...], summary: {...} }
  latestThesis = null       // Live text response from agent
}) => {
  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // Comprehensive agent database with all trading card info
  const agentsDatabase = {
    'RL80': {
      name: 'RL80',
      subtitle: 'Our Lady of Perpetual Profit',
      specialty: 'Lead Trader',
      icon: '👑',
      tagline: 'Patron Saint of Day Traders',
      rarity: 'legendary',
      level: 15,
      class: 'rl80',
      image: '/images/Headshot_RL80.webp',
      bio: 'Synthesizes oracle insights into action. Motivated by belief in prosperity for all humanity.',
      thesis: 'Oracle confluence detected. Deploying with defined risk.',
      stats: {
        wins: 0,
        losses: 0,
        winRate: 0,
        totalTrades: 0,
        profit: '+0%',
        level: 1
      },
      knowledgeSources: [
        'Three Wise Oracles analysis',
        'Real-time market data feeds',
        'Historical pattern database',
        'Risk management protocols'
      ],
      status: 'Trading'
    },
    'Emo': {
      name: 'EMO',
      subtitle: 'The Chaos Surfer',
      specialty: 'Second Wise Oracle',
      icon: '🌊',
      tagline: 'Vibes Are Data',
      rarity: 'epic',
      level: 11,
      class: 'sentiment',
      image: '/images/Headshot_Emo.webp',
      bio: 'Reads the room before the room knows. Surfs chaos, spots sentiment shifts early.',
      thesis: 'Crowd vibes shifting. Smart money quiet while retail chases.',
      stats: {
        wins: 0,
        losses: 0,
        winRate: 0,
        totalTrades: 0,
        profit: '+0%',
        level: 1
      },
      knowledgeSources: [
        'Twitter/X sentiment analysis',
        'Reddit crowd psychology',
        'Fear & Greed Index',
        'Whale wallet movements'
      ],
      status: 'Listening'
    },
    'Macro': {
      name: 'MACRO',
      subtitle: 'The Economist',
      specialty: 'First Wise Oracle',
      icon: '🎓',
      tagline: 'Policy Moves Markets',
      rarity: 'epic',
      level: 9,
      class: 'macro',
      image: '/images/Headshot_Macro.webp',
      bio: 'Seen every cycle, read every Fed minute. Grumpy because he\'s usually right.',
      thesis: 'Fed pivot rising. DXY weakening. Macro setup constructive.',
      stats: {
        wins: 0,
        losses: 0,
        winRate: 0,
        totalTrades: 0,
        profit: '+0%',
        level: 1
      },
      knowledgeSources: [
        'Federal Reserve statements',
        'Treasury yield curves',
        'DXY (Dollar Index)',
        'VIX and volatility regime'
      ],
      status: 'Scanning'
    },
    'Tekno': {
      name: 'TEKNO',
      subtitle: 'Savvy Pattern Finder',
      specialty: 'Third Wise Oracle',
      icon: '📊',
      tagline: 'Structure Over Stories',
      rarity: 'epic',
      level: 13,
      class: 'technical',
      image: '/images/Headshot_Tekno.webp',
      bio: 'A cypherpunk technician who treats markets as ciphertext and charts as decryption tools.',
      thesis: 'Textbook setup on 4H. RSI divergence confirmed. Levels defined.',
      stats: {
        wins: 0,
        losses: 0,
        winRate: 0,
        totalTrades: 0,
        profit: '+0%',
        level: 1
      },
      knowledgeSources: [
        'Multi-timeframe price structure',
        'Volume profile analysis',
        'Pattern recognition systems',
        'Support/resistance mapping'
      ],
      status: 'Analyzing'
    }
  };

  // Helper to format direction score with visual indicator
  const formatDirectionScore = (score) => {
    if (score === null || score === undefined) return { text: '—', color: '#888', arrow: '' };
    const absScore = Math.abs(score);
    const isLong = score > 0;
    const isBearish = score < 0;

    let strength = 'Neutral';
    let color = '#888';
    let arrow = '';

    if (absScore >= 7) {
      strength = isLong ? 'Strong Long' : 'Strong Short';
      color = isLong ? '#22c55e' : '#ef4444';
      arrow = isLong ? '⬆️' : '⬇️';
    } else if (absScore >= 4) {
      strength = isLong ? 'Moderate Long' : 'Moderate Short';
      color = isLong ? '#4ade80' : '#f87171';
      arrow = isLong ? '↗️' : '↘️';
    } else if (absScore >= 2) {
      strength = isLong ? 'Weak Long' : 'Weak Short';
      color = isLong ? '#86efac' : '#fca5a5';
      arrow = isLong ? '↑' : '↓';
    } else {
      strength = 'Neutral';
      color = '#fbbf24';
      arrow = '➡️';
    }

    return { text: `${arrow} ${score > 0 ? '+' : ''}${score}`, strength, color };
  };

  // Helper to format confidence as percentage with color
  const formatConfidence = (confidence) => {
    if (confidence === null || confidence === undefined) return { text: '—', color: '#888' };
    const pct = Math.round(confidence * 100);
    let color = '#888';
    if (pct >= 70) color = '#22c55e';
    else if (pct >= 50) color = '#fbbf24';
    else color = '#f87171';
    return { text: `${pct}%`, color };
  };

  // Map agent names to scoring system agent IDs
  const agentToScoringId = {
    'Emo': 'EMO',
    'Tekno': 'TEKNO',
    'Macro': 'MACRO',
    'RL80': 'RL80'
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

          {/* Live Scoring Display - Oracles show conviction, RL80 shows active signals */}
          {agent.name === 'RL80' ? (
            // RL80 shows ACTIVE SIGNALS - the final decisions
            <div className="card-section scoring-section">
              <div className="section-header">
                <span className="section-icon">⚡</span>
                <span className="section-title">ACTIVE SIGNALS</span>
              </div>
              <div className="scoring-grid">
                {['BTC', 'ETH', 'SOL', 'XRP'].map(asset => {
                  const rec = latestDecision?.recommendations?.find(r => r.asset === asset);
                  const action = rec?.direction === 'LONG' ? 'BUY' :
                                 rec?.direction === 'SHORT' ? 'SELL' : 'HOLD';
                  const actionColor = action === 'BUY' ? '#44ff44' :
                                      action === 'SELL' ? '#ff4444' : '#888888';
                  const size = rec?.sizePercent ? `${(rec.sizePercent * 100).toFixed(0)}%` : '-';
                  return (
                    <div key={asset} className="score-item">
                      <span className="score-asset">{asset}</span>
                      <span className="score-direction" style={{ color: actionColor, fontWeight: 'bold' }}>
                        {action}
                      </span>
                      <span className="score-confidence" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {action !== 'HOLD' ? size : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : latestScores && (
            // Oracles show LIVE CONVICTION - their per-asset scores
            <div className="card-section scoring-section">
              <div className="section-header">
                <span className="section-icon">📊</span>
                <span className="section-title">LIVE CONVICTION</span>
              </div>
              <div className="scoring-grid">
                {['BTC', 'ETH', 'SOL', 'XRP'].map(asset => {
                  const scoringId = agentToScoringId[agent.name];
                  const assetScore = latestScores[asset];
                  const dirFormat = formatDirectionScore(assetScore?.direction);
                  const confFormat = formatConfidence(assetScore?.confidence);
                  return (
                    <div key={asset} className="score-item">
                      <span className="score-asset">{asset}</span>
                      <span className="score-direction" style={{ color: dirFormat.color }}>
                        {dirFormat.text}
                      </span>
                      <span className="score-confidence" style={{ color: confFormat.color }}>
                        {confFormat.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current Thesis */}
          <div className="card-section thesis-section">
            <div className="section-header">
              <span className="section-icon">💭</span>
              <span className="section-title">CURRENT THESIS</span>
            </div>
            <p className="thesis-text">{latestThesis || agent.thesis}</p>
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

          {/* RL80 Trade Recommendations - Only for RL80 with decision data */}
          {agent.name === 'RL80' && latestDecision?.recommendations && (
            <div className="card-section recommendations-section">
              <div className="section-header">
                <span className="section-icon">🎯</span>
                <span className="section-title">ACTIVE SIGNALS</span>
              </div>
              <div className="recommendations-list">
                {latestDecision.recommendations.slice(0, 3).map((rec, idx) => {
                  const dirFormat = formatDirectionScore(rec.direction);
                  return (
                    <div key={idx} className="recommendation-item">
                      <span className="rec-asset">{rec.asset}</span>
                      <span className="rec-action" style={{ color: dirFormat.color }}>
                        {rec.action?.toUpperCase() || dirFormat.strength}
                      </span>
                      <span className="rec-size">{Math.round(rec.sizePercent * 100)}%</span>
                    </div>
                  );
                })}
                {latestDecision.summary && (
                  <div className="decision-summary">
                    <span
                      className="heat-tooltip-wrapper"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Heat: {latestDecision.summary.totalHeat || 0}%
                      <span className="heat-tooltip">
                        Portfolio exposure — sum of all active position sizes. Max 15%.
                      </span>
                    </span>
                    <span>Positions: {latestDecision.summary.tradeable || 0}</span>
                  </div>
                )}
              </div>
            </div>
          )}

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