import React, { useEffect, useState } from 'react';
import PokemonHoloCard from './PokemonHoloCard';
import './FocusedAgentCard.css';

const FocusedAgentCard = ({ agentId, onClose }) => {
  const [agentData, setAgentData] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  // Agent data with Pokemon card properties
  const agentsDatabase = {
    'RL80': {
      name: 'RL80',
      hp: 120,
      type: 'Fire',
      backgroundImage: '/aurora.webp',
      foregroundImage: '/crier.png',
      attacks: [
        { name: 'Momentum Trade', damage: 87, cost: '💎💎💎' },
        { name: 'Leverage Strike', damage: 124, cost: '🔥🔥🔥🔥' }
      ],
      weakness: 'Market Crash',
      resistance: 'FOMO',
      retreatCost: 2,
      rarity: 'rare holo',
      artist: 'AI Trader',
      cardNumber: 'RL80-001',
      description: 'Analyzing perpetual contracts. Strong bullish signal detected on ETH/USD. Executing long position with 3x leverage.'
    },
    'Emo': {
      name: 'Emo',
      hp: 100,
      type: 'Water',
      backgroundImage: '/80carpet.png',
      foregroundImage: '/candles.png',
      attacks: [
        { name: 'Sentiment Shift', damage: 82, cost: '💧💧' },
        { name: 'Social Signal', damage: 67, cost: '💧' }
      ],
      weakness: 'Black Swan',
      resistance: 'FUD',
      retreatCost: 1,
      rarity: 'common',
      artist: 'Sentiment Bot',
      cardNumber: 'EMO-001',
      description: 'Market sentiment shifting to extreme greed. Social media mentions up 450%. Recommending defensive positioning.'
    },
    'Macro': {
      name: 'Macro',
      hp: 110,
      type: 'Electric',
      backgroundImage: '/heart.png',
      foregroundImage: '/crier.png',
      attacks: [
        { name: 'Fed Pivot', damage: 79, cost: '⚡⚡⚡' },
        { name: 'DXY Analysis', damage: 98, cost: '⚡⚡⚡⚡' }
      ],
      weakness: 'Inflation',
      resistance: 'Recession',
      retreatCost: 3,
      rarity: 'uncommon',
      artist: 'Macro Trader',
      cardNumber: 'MAC-002',
      description: 'Fed pivot indicators strengthening. DXY showing weakness. Favorable conditions for risk-on assets detected.'
    },
    'Tekno': {
      name: 'Tekno',
      hp: 105,
      type: 'Steel',
      backgroundImage: '/aurora.webp',
      foregroundImage: '/candles.png',
      attacks: [
        { name: 'Pattern Scan', damage: 91, cost: '⚙️⚙️' },
        { name: 'RSI Divergence', damage: 112, cost: '⚙️⚙️⚙️' }
      ],
      weakness: 'Slippage',
      resistance: 'Volatility',
      retreatCost: 2,
      rarity: 'rare',
      artist: 'Tech Analyst',
      cardNumber: 'TEK-003',
      description: 'BTC forming ascending triangle on 4H. RSI divergence confirmed. Target: $52,000. Stop loss: $47,200.'
    },
    'Mike': {
      name: 'Mike',
      hp: 95,
      type: 'Psychic',
      backgroundImage: '/80carpet.png',
      foregroundImage: '/crier.png',
      attacks: [
        { name: 'Risk Control', damage: 85, cost: '🔮🔮' },
        { name: 'Capital Shield', damage: 65, cost: '🔮' }
      ],
      weakness: 'Overleveraged',
      resistance: 'Drawdown',
      retreatCost: 1,
      rarity: 'uncommon',
      artist: 'Risk Manager',
      cardNumber: 'MIK-004',
      description: 'Portfolio risk exposure at 65%. Suggesting position size reduction on high-leverage trades.'
    },
    'Coin1': {
      name: 'Sacred Coin',
      hp: 150,
      type: 'Gold',
      backgroundImage: '/aurora.webp',
      foregroundImage: '/candles.png',
      attacks: [
        { name: 'Divine Fortune', damage: 100, cost: '💰💰💰' },
        { name: 'Blessed Trade', damage: 150, cost: '💰💰💰💰' }
      ],
      weakness: 'Bear Market',
      resistance: 'Paper Hands',
      retreatCost: 0,
      rarity: 'legendary holo',
      artist: 'Temple Oracle',
      cardNumber: 'COIN-001',
      description: 'An ancient coin blessed by the temple spirits. Holding this token grants wisdom and fortune to those who believe.'
    },
    'Coin2': {
      name: 'Mystic Token',
      hp: 140,
      type: 'Water',
      backgroundImage: '/80carpet.png',
      foregroundImage: '/crier.png',
      attacks: [
        { name: 'Tidal Wealth', damage: 95, cost: '💧💧💧' },
        { name: 'Ocean\'s Blessing', damage: 130, cost: '💧💧💧💧' }
      ],
      weakness: 'Drought',
      resistance: 'Fire',
      retreatCost: 1,
      rarity: 'legendary holo',
      artist: 'Water Sage',
      cardNumber: 'COIN-002',
      description: 'A mystical token infused with the power of the tides. Its holder gains the ability to flow with market currents.'
    },
    'Coin3': {
      name: 'Eternal Medallion',
      hp: 160,
      type: 'Psychic',
      backgroundImage: '/heart.png',
      foregroundImage: '/candles.png',
      attacks: [
        { name: 'Mind Over Market', damage: 110, cost: '🔮🔮🔮' },
        { name: 'Psychic Surge', damage: 145, cost: '🔮🔮🔮🔮' }
      ],
      weakness: 'Reality Check',
      resistance: 'FUD',
      retreatCost: 2,
      rarity: 'legendary holo',
      artist: 'Mind Reader',
      cardNumber: 'COIN-003',
      description: 'An eternal medallion that grants its bearer foresight into market movements. Sees patterns invisible to others.'
    },
    'Coin4': {
      name: 'Phoenix Doubloon',
      hp: 135,
      type: 'Fire',
      backgroundImage: '/aurora.webp',
      foregroundImage: '/crier.png',
      attacks: [
        { name: 'Rising Flames', damage: 105, cost: '🔥🔥🔥' },
        { name: 'Phoenix Revival', damage: 140, cost: '🔥🔥🔥🔥' }
      ],
      weakness: 'Ice Age',
      resistance: 'Liquidation',
      retreatCost: 1,
      rarity: 'legendary holo',
      artist: 'Flame Keeper',
      cardNumber: 'COIN-004',
      description: 'A legendary doubloon that rises from the ashes of failed trades. Each loss makes it stronger.'
    }
  };

  useEffect(() => {
    console.log('FocusedAgentCard received agentId:', agentId);
    if (agentId && agentsDatabase[agentId]) {
      console.log('Loading data for:', agentId, agentsDatabase[agentId]);
      setAgentData(agentsDatabase[agentId]);
      // Delay to trigger animation
      setTimeout(() => setIsVisible(true), 10);
    } else {
      console.log('No data found for agentId:', agentId);
      setIsVisible(false);
      // Wait for animation before clearing data
      setTimeout(() => setAgentData(null), 300);
    }
  }, [agentId]);

  if (!agentData) return null;

  return (
    <div className="focused-agent-wrapper">
      {/* Background blur overlay */}
      <div 
        className={`card-backdrop ${isVisible ? 'visible' : ''}`}
        onClick={onClose}
      />
      <div className={`focused-agent-card ${isVisible ? 'visible' : ''}`}>
        <button 
          className="close-button"
          onClick={onClose}
          aria-label="Close card"
        >
          ✕
        </button>
        <PokemonHoloCard 
          {...agentData}
          agent={agentData}
          className="focused-card"
        />
      </div>
    </div>
  );
};

export default FocusedAgentCard;