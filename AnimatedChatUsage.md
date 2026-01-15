# Enhanced Chat Phone Texture - Usage Guide

## New Props

```jsx
<EnhancedChatPhoneTexture
  // Existing props
  meshRef={phoneScreenMeshRef}
  hoveredOffering={hoveredOffering}
  justLitOffering={justLitOffering}
  hasActiveClick={hasActiveClick}
  user={user}
  
  // NEW: Trade School alerts
  tradeAlerts={{
    action: 'LONG',        // 'LONG' | 'SHORT' | 'CLOSE'
    asset: 'ETH/USD',
    leverage: '3x',
    pnl: '+87%'            // Only for CLOSE action
  }}
  
  // NEW: Stats for mood & milestones
  candleCount={522}
  totalBurned={280000}
  priceChange={-2.5}       // 24h % change
  prayerStats={{
    petitions: 150,
    confessions: 80,
    thanks: 45
  }}
/>
```

## Features Included

### 1. Our Lady Responds
When a user lights a candle, there's a 40% chance Our Lady will respond with a contextual message based on prayer type:

- **Petitions**: "Your prayer has been received, child 🙏"
- **Confessions**: "All is forgiven, my child 💜"  
- **Thanks**: "Your gratitude warms my circuits ✨"

### 2. Trade School Alerts
Pass trade events to show them as:
- Gold notification banner sliding down
- System message in the chat feed

```jsx
// Example: When Our Lady opens a position
const [tradeAlert, setTradeAlert] = useState(null);

// From your Trade School component/hook:
onPositionOpened((position) => {
  setTradeAlert({
    action: 'LONG',
    asset: position.asset,
    leverage: position.leverage
  });
});
```

### 3. Dynamic Mood Status
Header status changes based on community sentiment:
- 📈 Feeling bullish (price up >5%)
- 😰 Praying harder (price down >5%)
- 🙏 Deep in prayer (confessions dominating)
- ✨ Grateful today (thanks dominating)
- 👀 Watching the charts (petitions dominating)

### 4. Milestone Celebrations
Auto-detects and announces:
- Candle milestones: 100, 250, 500, 1000, 5000
- Burn milestones: 10K, 100K, 1M RL80

### 5. Message Reactions
Reactions display under messages. To add reactions from outside:

```jsx
// The component exposes addReaction via ref or you can 
// manage reactions externally and pass them in
```

## Configuration

Toggle features on/off in the CONFIG object:

```javascript
const CONFIG = {
  ENABLE_OUR_LADY_RESPONSES: true,
  ENABLE_TRADE_ALERTS: true,
  ENABLE_MILESTONES: true,
  ENABLE_REACTIONS: true,
  RESPONSE_PROBABILITY: 0.4,  // 40% chance to respond
  // ... timing values
};
```

## Customizing Responses

Edit the response banks to match your vibe:

```javascript
const OUR_LADY_RESPONSES = {
  petition: [
    "Your prayer has been received, child 🙏",
    // Add your own...
  ],
  confession: [...],
  appreciation: [...],
  oracle: [...]  // For future oracle feature
};
```

## Integration with Trade School

```jsx
// In your main scene component:
const [latestTrade, setLatestTrade] = useState(null);

// Subscribe to Trade School events
useEffect(() => {
  const unsubscribe = subscribeToTradeSchool((event) => {
    if (event.type === 'POSITION_OPENED') {
      setLatestTrade({
        action: event.direction,
        asset: event.pair,
        leverage: event.leverage
      });
    } else if (event.type === 'POSITION_CLOSED') {
      setLatestTrade({
        action: 'CLOSE',
        asset: event.pair,
        pnl: event.pnl
      });
    }
  });
  
  return unsubscribe;
}, []);

// Pass to component
<EnhancedChatPhoneTexture
  tradeAlerts={latestTrade}
  // ... other props
/>
```

## Styling Notes

- Our Lady's messages: Purple gradient bubble with ✨ avatar
- Trade alerts: Gold gradient notification + gold system message
- Milestones: Purple gradient system message
- Reactions: Dark pill badges below messages

## Future Ideas

- [ ] Oracle feature: Tap to receive a cryptic prophecy
- [ ] Bless/report buttons on messages
- [ ] Shake phone to get Our Lady's attention
- [ ] Confession confetti animation
- [ ] Prayer streaks / daily devotion tracking