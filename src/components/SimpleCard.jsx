import React from 'react';
import './SimpleCard.css';

const SimpleCard = ({
  agent,
  isActive = false,
  className = ''
}) => {
  // Calculate win/loss from stats
  const wins = agent.stats.wins || Math.floor(agent.stats.totalTrades * (agent.stats.successRate / 100));
  const losses = agent.stats.totalTrades - wins;

  return (
    <div className={`simple-card ${className} ${isActive ? 'active' : ''} ${agent.rarity || 'rare'}`}>
      {/* Top banner with name and level */}
      <div className="simple-card-header">
        <div className="card-title-section">
          <h3 className="simple-card-name">{agent.name}</h3>
          <span className="simple-card-subtitle">{agent.subtitle || 'Trading Agent'}</span>
        </div>
        <div className="card-level">
          <span className="level-label">LVL</span>
          <span className="level-value">{agent.level || Math.floor(agent.stats.totalTrades / 100)}</span>
        </div>
      </div>

      {/* Specialty badge */}
      <div className="specialty-badge">
        <span className="specialty-icon">{agent.specialtyIcon || '⚡'}</span>
        <span className="specialty-text">{agent.specialty}</span>
      </div>

      {/* Character portrait */}
      <div className="simple-card-image">
        <div className="image-frame">
          <img src={agent.image || '/aurora.webp'} alt={agent.name} />
        </div>
        <div className="image-caption">
          {agent.tagline || 'Autonomous Trading Specialist'}
        </div>
      </div>

      {/* Character bio */}
      <div className="card-section bio-section">
        <div className="section-label">PROFILE</div>
        <div className="bio-text">{agent.description}</div>
      </div>

      {/* Current thesis/attack */}
      <div className="card-section thesis-section">
        <div className="thesis-header">
          <span className="thesis-icon">💭</span>
          <span className="section-label">CURRENT THESIS</span>
        </div>
        <div className="thesis-text">{agent.currentInsight}</div>
      </div>

      {/* Stats grid */}
      <div className="card-section stats-section">
        <div className="section-label">PERFORMANCE</div>
        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-label">W/L Record</div>
            <div className="stat-value">{wins}W - {losses}L</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Win Rate</div>
            <div className="stat-value">{agent.stats.successRate}%</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Total Trades</div>
            <div className="stat-value">{agent.stats.totalTrades}</div>
          </div>
          <div className="stat-box highlight">
            <div className="stat-label">Profit</div>
            <div className="stat-value">{agent.stats.profit}</div>
          </div>
        </div>
      </div>

      {/* Knowledge sources */}
      {agent.knowledgeSources && agent.knowledgeSources.length > 0 && (
        <div className="card-section sources-section">
          <div className="section-label">KNOWLEDGE BASE</div>
          <div className="sources-list">
            {agent.knowledgeSources.map((source, idx) => (
              <div key={idx} className="source-item">
                <span className="source-icon">📚</span>
                <span className="source-text">{source}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card footer */}
      <div className="simple-card-footer">
        <span className="card-id">{agent.id}</span>
        <span className="card-rarity">{agent.rarity?.toUpperCase() || 'RARE'}</span>
      </div>

      {/* Holographic effect overlay */}
      <div className="holo-effect"></div>
    </div>
  );
};

export default SimpleCard;