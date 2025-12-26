import React, { useRef, useState, useEffect } from 'react';
import './RL80TraderCard.css';

const RL80TraderCard = ({ 
  agentData,
  className = "",
  onClose
}) => {
  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  
  // Map agent types to card themes
  const getAgentTheme = (agentName) => {
    const themes = {
      'Macro': { class: 'macro', icon: '🌐', specialty: 'MACRO ORACLE' },
      'Tekno': { class: 'technical', icon: '📊', specialty: 'CHART SEER' },
      'Emo': { class: 'sentiment', icon: '💬', specialty: 'PULSE READER' },
      'RL80': { class: 'rl80', icon: '🤖', specialty: 'RL80 MASTER' }
    };
    return themes[agentName] || { class: 'default', icon: '🤖', specialty: agentName.toUpperCase() };
  };

  // Get dynamic stats based on agent type
  const getAgentStats = (agentName) => {
    const stats = {
      'Macro': {
        signal: { label: 'Conviction Level', value: 72 },
        stats: [
          { value: '↑', label: 'Trend' },
          { value: 'MED', label: 'Vol Read' },
          { value: '4H', label: 'Horizon' }
        ],
        status: 'Scanning'
      },
      'Tekno': {
        signal: { label: 'Signal Strength', value: 85 },
        stats: [
          { value: 'W', label: 'Pattern' },
          { value: '15M', label: 'Timeframe' },
          { value: '3', label: 'Confirms' }
        ],
        status: 'Analyzing'
      },
      'Emo': {
        signal: { label: 'Buzz Level', value: 63 },
        stats: [
          { value: '😊', label: 'Mood' },
          { value: '2.4K', label: 'Sources' },
          { value: '+12%', label: 'Δ 1H' }
        ],
        status: 'Listening'
      },
      'RL80': {
        signal: { label: 'Trade Power', value: 91 },
        stats: [
          { value: '3X', label: 'Leverage' },
          { value: 'LONG', label: 'Position' },
          { value: '+87%', label: 'PnL' }
        ],
        status: 'Trading'
      }
    };
    return stats[agentName] || {
      signal: { label: 'Power Level', value: 50 },
      stats: [
        { value: '—', label: 'Stat 1' },
        { value: '—', label: 'Stat 2' },
        { value: '—', label: 'Stat 3' }
      ],
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

  const theme = getAgentTheme(agentData.name);
  const stats = getAgentStats(agentData.name);

  const handleBackdropClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleCardClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div 
      className={`rl80-card-wrapper ${isVisible ? 'visible' : ''}`}
      onClick={handleBackdropClick}
      onTouchEnd={handleBackdropClick}
    >
      <div 
        className={`rl80-card ${theme.class} ${className}`} 
        ref={cardRef}
        onClick={handleCardClick}
        onTouchEnd={handleCardClick}
      >
        <div className="circuit-pattern"></div>
        <div className="holo-sheen"></div>
        
        <div className="card-header">
          <span className="agent-name">{theme.specialty}</span>
          <div className="specialty-icon">{theme.icon}</div>
        </div>
        
        <div className="portrait-window">
          <div className="robot-silhouette">🤖</div>
          <span className="portrait-label">3D Agent Preview</span>
        </div>
        
        <div className="signal-meter">
          <div className="meter-label">
            <span>{stats.signal.label}</span>
            <span className="meter-value">{stats.signal.value}%</span>
          </div>
          <div className="meter-bar">
            <div className="meter-fill" style={{ width: `${stats.signal.value}%` }}></div>
          </div>
        </div>
        
        <div className="stats-block">
          {stats.stats.map((stat, index) => (
            <div key={index} className="stat">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
        
        <div className="description-box">
          <p>{agentData.description}</p>
        </div>
        
        <div className="card-footer">
          <div className="status">
            <div className="status-dot"></div>
            <span>{stats.status}</span>
          </div>
          <div className="branding">RL80</div>
        </div>
      </div>
      
      <div className="close-hint">Tap outside to close</div>
    </div>
  );
};

export default RL80TraderCard;