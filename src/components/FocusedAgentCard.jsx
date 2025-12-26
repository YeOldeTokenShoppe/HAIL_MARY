import React, { useEffect, useState } from 'react';
import RL80TraderCard from './RL80TraderCard';
import './FocusedAgentCard.css';

const FocusedAgentCard = ({ agentId, onClose }) => {
  const [agentData, setAgentData] = useState(null);

  // Agent data - only the 4 main trading agents
  const agentsDatabase = {
    'RL80': {
      name: 'RL80',
      description: 'Analyzing perpetual contracts. Strong bullish signal detected on ETH/USD. Executing long position with 3x leverage.'
    },
    'Emo': {
      name: 'Emo',
      description: 'Market sentiment shifting to extreme greed. Social media mentions up 450%. Recommending defensive positioning.'
    },
    'Macro': {
      name: 'Macro',
      description: 'Fed pivot indicators strengthening. DXY showing weakness. Favorable conditions for risk-on assets detected.'
    },
    'Tekno': {
      name: 'Tekno',
      description: 'BTC forming ascending triangle on 4H. RSI divergence confirmed. Target: $52,000. Stop loss: $47,200.'
    }
  };

  useEffect(() => {
    console.log('FocusedAgentCard received agentId:', agentId);
    if (agentId && agentsDatabase[agentId]) {
      console.log('Loading data for:', agentId, agentsDatabase[agentId]);
      setAgentData(agentsDatabase[agentId]);
    } else {
      console.log('No data found for agentId:', agentId);
      setAgentData(null);
    }
  }, [agentId]);

  if (!agentData) return null;

  return (
    <RL80TraderCard 
      agentData={agentData}
      onClose={onClose}
      className="focused-card"
    />
  );
};

export default FocusedAgentCard;