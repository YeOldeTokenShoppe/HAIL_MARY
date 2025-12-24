import React from 'react';
import './SimpleCard.css';

const SimpleCard = ({ 
  agent, 
  isActive = false, 
  className = ''
}) => {
  return (
    <div className={`simple-card ${className} ${isActive ? 'active' : ''}`}>
      <div className="simple-card-header">
        <h3 className="simple-card-name">{agent.name}</h3>
        <span className="simple-card-type">{agent.status === 'active' ? 'Fire' : 'Water'}</span>
      </div>
      
      <div className="simple-card-image">
        <img src={agent.image || '/aurora.webp'} alt={agent.name} />
      </div>
      
      <div className="simple-card-description">
        {agent.currentInsight?.substring(0, 100)}...
      </div>
      
      <div className="simple-card-stats">
        <div className="stat">
          <span className="stat-label">{agent.specialty}</span>
          <span className="stat-value">{agent.stats.successRate}%</span>
        </div>
        <div className="stat">
          <span className="stat-label">Profit</span>
          <span className="stat-value">{agent.stats.profit}</span>
        </div>
      </div>
      
      <div className="simple-card-footer">
        <span className="card-id">{agent.id}</span>
      </div>
    </div>
  );
};

export default SimpleCard;