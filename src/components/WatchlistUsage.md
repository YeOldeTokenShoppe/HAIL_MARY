# Watchlist Phone Texture - Usage Guide

## Overview

A trading-activity-feed style display for the 3D phone screen showing real-time community activity: candle lighting, staking, unstaking, and reward claims. Includes breakthrough event banners for Trade School alerts.

## Basic Usage

```jsx
import { WatchlistPhoneTexture } from './WatchlistPhoneTexture';

<WatchlistPhoneTexture
  meshRef={phoneScreenMeshRef}
  
  // New activity triggers
  justLitOffering={justLitOffering}
  stakingEvents={stakingEvent}
  tradeAlerts={tradeAlert}
  
  // Stats for footer
  candleCount={522}
  totalBurned={2800000}
  totalStaked={15000000}
  onlineCount={47}
  
  user={user}
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `meshRef` | ref | Reference to the Three.js mesh for the phone screen |
| `justLitOffering` | object | Triggers new candle activity when set |
| `stakingEvents` | object | Triggers staking activity (STAKE/UNSTAKE/CLAIM) |
| `tradeAlerts` | object | Triggers breakthrough banner for Trade School |
| `candleCount` | number | Total candles for footer stat |
| `totalBurned` | number | Total tokens burned for footer stat |
| `totalStaked` | number | Total tokens staked for footer stat |
| `onlineCount` | number | "Faithful online" count in header |
| `user` | object | Current user info for activity attribution |

## Activity Types

### Candle Lighting
```javascript
// Triggered automatically when justLitOffering changes
justLitOffering = {
  name: 'CryptoMaria',
  tokensBurned: '500',
  message: 'Please pump my bags',
  type: 'petition'
}
```

### Staking Events
```javascript
stakingEvents = {
  type: 'STAKE',      // 'STAKE' | 'UNSTAKE' | 'CLAIM'
  amount: 50000,
  user: {
    name: 'DiamondHands',
    address: '0x1234...5678'
  }
}
```

### Trade Alerts (Breakthrough Events)
```javascript
tradeAlerts = {
  action: 'LONG',     // 'LONG' | 'SHORT' | 'CLOSE'
  asset: 'ETH/USD',
  leverage: '3x',
  pnl: '+87%'         // Only for CLOSE action
}
```

## Visual Hierarchy

Activities are styled based on amount:

| Tier | Candle Threshold | Stake Threshold | Style |
|------|------------------|-----------------|-------|
| **Mega Whale** | 1000+ tokens | 500K+ tokens | Gold gradient, 🐋 icon, glow |
| **Whale** | 100+ tokens | 50K+ tokens | Purple gradient, 🔥 icon, glow |
| **Solid** | 10+ tokens | 5K+ tokens | Dark gray, ✨ icon |
| **Normal** | < 10 tokens | < 5K tokens | Darker gray, 🙏 icon |

## Tabs

Three filter tabs at the top:
- **🔥 ALL** - All activity types
- **🕯️ CANDLES** - Only candle lighting
- **💎 STAKING** - Stakes, unstakes, and claims

## Integrating with Firebase

The component already subscribes to your `offerings` collection. For staking events, you'll need to add a listener:

```javascript
// In your parent component
const [stakingEvent, setStakingEvent] = useState(null);

useEffect(() => {
  // Subscribe to staking contract events
  const stakingContract = getStakingContract();
  
  stakingContract.on('Staked', (user, amount, event) => {
    setStakingEvent({
      type: 'STAKE',
      amount: parseFloat(ethers.formatUnits(amount, 18)),
      user: { address: user },
      txHash: event.transactionHash
    });
  });
  
  stakingContract.on('Unstaked', (user, amount, event) => {
    setStakingEvent({
      type: 'UNSTAKE',
      amount: parseFloat(ethers.formatUnits(amount, 18)),
      user: { address: user }
    });
  });
  
  stakingContract.on('RewardsClaimed', (user, amount, event) => {
    setStakingEvent({
      type: 'CLAIM',
      amount: parseFloat(ethers.formatEther(amount)),
      user: { address: user }
    });
  });
  
  return () => {
    stakingContract.removeAllListeners();
  };
}, []);
```

## Integrating with Trade School

```javascript
const [tradeAlert, setTradeAlert] = useState(null);

// When Trade School opens a position
const handleTradeSchoolPosition = (position) => {
  setTradeAlert({
    action: position.direction, // 'LONG' or 'SHORT'
    asset: position.pair,
    leverage: position.leverage
  });
};

// When Trade School closes a position
const handleTradeSchoolClose = (result) => {
  setTradeAlert({
    action: 'CLOSE',
    asset: result.pair,
    pnl: result.pnlPercent
  });
};
```

## Customization

### Adjust Thresholds

```javascript
// In the component file
const CONFIG = {
  WHALE_THRESHOLDS: {
    CANDLE: 100,        // Adjust these
    STAKE: 50000,
    MEGA_MULTIPLIER: 10
  },
  // ...
};
```

### Add New Activity Types

```javascript
const ACTIVITY_TYPES = {
  // Add new types
  BURN: {
    icon: '🔥',
    verb: 'Burned',
    unit: 'RL80',
    color: '#ff4444'
  },
  // ...
};
```

### Change Colors/Styling

```javascript
function getTierStyle(tier) {
  switch (tier) {
    case 'mega':
      return {
        bgGradient: ['#ffd700', '#ff8c00'], // Customize
        icon: '🐋',
        glowColor: 'rgba(255, 215, 0, 0.4)',
        // ...
      };
    // ...
  }
}
```

## Comparison: Chat vs Watchlist

| Feature | Chat | Watchlist |
|---------|------|-----------|
| Content | User messages | Activity events |
| Moderation | Required | Not needed |
| Engagement | Conversational | Transactional |
| Social proof | Words | Actions |
| FOMO trigger | Medium | High |
| Complexity | Higher | Lower |

## Future Ideas

- [ ] Click/tap on activity to see tx on explorer
- [ ] Animate new items sliding in from top
- [ ] Sound effects for whale activities
- [ ] "Your rank" indicator based on total burned
- [ ] Daily/weekly leaderboard tab
- [ ] Filter by time range (1h, 24h, 7d, all)