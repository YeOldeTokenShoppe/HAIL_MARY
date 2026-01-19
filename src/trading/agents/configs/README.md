# Agent Personality & Scoring System

A comprehensive system for establishing distinct personalities, knowledge bases, character-driven responses, and **quantitative scoring** for your trading agents.

## 🎭 System Overview

Your trading agents now have:
- **Deep character profiles** with personality traits, communication styles, and relationships
- **Specialized knowledge bases** with domain-specific expertise
- **Dynamic personality injection** that adapts to market conditions
- **Character-consistent responses** that maintain authenticity
- **Quantitative scoring outputs** with direction scores (-10 to +10) and confidence levels (0-1)
- **Weighted aggregation** for synthesized trading decisions
- **Shadow testing** of alternative weight schemes

## 📁 File Structure

```
src/trading/
├── agents/configs/
│   ├── personalities/
│   │   ├── emo-character.js      # EMO's complete personality profile
│   │   ├── tekno-character.js    # TEKNO's character definition
│   │   ├── macro-character.js    # MACRO's personality traits
│   │   └── rl80-character.js     # RL80's decision framework
│   ├── knowledge/
│   │   ├── emo-knowledge.json    # Sentiment analysis expertise
│   │   ├── tekno-knowledge.json  # Technical analysis knowledge
│   │   ├── macro-knowledge.json  # Economic/policy knowledge
│   │   └── rl80-knowledge.json   # Risk management systems
│   ├── personalitySystem.js      # Core personality engine
│   ├── enhancedPromptBuilder.js  # Dynamic prompt construction + scoring prompts
│   └── agentInteractionGuidelines.md
├── config/
│   └── scoring-config.js         # Scoring system configuration
├── types/
│   └── scoring.js                # Type definitions for scores
├── utils/
│   └── scoreParser.js            # Parse JSON scores from LLM responses
├── services/
│   ├── scoringOrchestrator.js    # Server-side workflow orchestrator (Railway)
│   ├── runScoringWorkflow.js     # CLI entry point for Railway
│   ├── scoreAggregator.js        # Weighted score aggregation
│   ├── positionSizer.js          # Position sizing from scores
│   ├── riskManager.js            # Risk limit enforcement
│   └── decisionLogger.js         # Firebase decision logging
└── components/
    └── PerformanceDashboard.jsx  # Live scoring metrics display
```

## 🚀 How to Use

### 1. Fine-Tune Agent Personalities

Edit the character files to adjust personality traits:

```javascript
// In personalities/emo-character.js
personality: {
  coreTraits: [
    'Energetic and plugged into social zeitgeist',
    'YOUR_CUSTOM_TRAIT_HERE',
    // Add or modify traits to shape EMO's character
  ]
}
```

### 2. Expand Knowledge Bases

Add domain-specific knowledge to JSON files:

```json
// In knowledge/emo-knowledge.json
{
  "sentiment_indicators": {
    "your_custom_indicator": {
      "description": "What this indicator means",
      "bullish_signal": "When it suggests buying",
      "bearish_signal": "When it suggests selling"
    }
  }
}
```

### 3. Integrate into Agent Code

Update your agents to use the personality system:

```javascript
import { buildEnhancedPrompt } from './configs/enhancedPromptBuilder.js';

export async function callYourAgent(context, apiKey) {
  // Build personality-aware prompt
  const enhancedPrompt = buildEnhancedPrompt('EMO', context, context.lastMessages || []);
  
  // Use enhanced prompt in API call
  const response = await fetch('your-ai-api', {
    // ... other config
    body: JSON.stringify({
      messages: [
        { role: 'system', content: enhancedPrompt.systemPrompt },
        { role: 'user', content: enhancedPrompt.userPrompt }
      ],
      temperature: enhancedPrompt.temperature,
      max_tokens: enhancedPrompt.maxTokens
    })
  });
}
```

---

## 📊 Scoring System

### Overview

The scoring system converts qualitative agent analysis into quantitative trading signals:

| Component | Range | Description |
|-----------|-------|-------------|
| Direction Score | -10 to +10 | Bearish (-10) to Bullish (+10) |
| Confidence | 0 to 1 | Low (0) to High (1) certainty |
| Assets | BTC, ETH, SOL, XRP | All analyzed assets |
| Tradeable | BTC-PERP, ETH-PERP | Lighter DEX positions |

### Scoring Workflow

```
EMO (Grok) → TEKNO (OpenAI) → MACRO (Claude) → RL80 (Aggregator)
     ↓              ↓              ↓                  ↓
  Scores         Scores         Scores          Decision
     └──────────────┴──────────────┘                 │
                    ↓                                │
           scoreAggregator.js ←──────────────────────┘
                    ↓
           positionSizer.js
                    ↓
            riskManager.js
                    ↓
           decisionLogger.js → Firebase
```

### Running on Railway

```bash
# Single run (Railway cron job)
npm run scoring

# Scheduled (keeps process alive)
npm run scoring:scheduled

# Health check
npm run scoring:health
```

### Configuration

Edit `src/trading/config/scoring-config.js`:

```javascript
// Assets to analyze
ASSETS: ['BTC', 'ETH', 'SOL', 'XRP']
TRADEABLE_ASSETS: ['BTC', 'ETH']  // Only these can be traded

// Agent weights (must sum to 1.0)
ANALYST_WEIGHTS: {
  EMO: 0.333,    // Sentiment
  TEKNO: 0.333,  // Technical
  MACRO: 0.334   // Macro
}

// Risk limits
RISK_LIMITS: {
  MAX_POSITION: 0.05,      // 5% max per position
  MAX_HEAT: 0.15,          // 15% total portfolio exposure
  MAX_DAILY_LOSS: 0.02,    // 2% daily loss limit
  MIN_CONFIDENCE: 0.4      // Minimum confidence to trade
}
```

### Shadow Testing

Alternative weight schemes are logged (not executed) for future optimization:

```javascript
SHADOW_WEIGHTS: {
  momentum_focused: { EMO: 0.2, TEKNO: 0.5, MACRO: 0.3 },
  sentiment_focused: { EMO: 0.5, TEKNO: 0.25, MACRO: 0.25 },
  macro_focused: { EMO: 0.2, TEKNO: 0.3, MACRO: 0.5 }
}
```

### Firebase Collections

| Collection | Purpose |
|------------|---------|
| `agentScores/` | Individual analyst scores per run |
| `decisions/` | Full decision logs with recommendations |
| `decisionOutcomes/` | P&L outcomes (filled when positions close) |

### Adding Scoring to Agents

Each agent has a scoring function:

```javascript
import { callSentimentOracleWithScoring } from './agents/sentiment-oracle.js';
import { callMarketAnalystWithScoring } from './agents/market-analyst.js';
import { callMacroSpecialistWithScoring } from './agents/macro-specialist.js';

// Returns: { scores: [...], textResponse: "...", agentId: "EMO" }
const result = await callSentimentOracleWithScoring(context, apiKey);
```

### Score Output Format

```javascript
{
  agentId: "EMO",
  timestamp: 1705600000000,
  scores: [
    { asset: "BTC", direction: 6, confidence: 0.75, rationale: "..." },
    { asset: "ETH", direction: 4, confidence: 0.65, rationale: "..." }
  ],
  textResponse: "Vibes are bullish...",
  metadata: { fearGreed: 72, ... }
}
```

### Decision Output Format

```javascript
{
  timestamp: 1705600000000,
  recommendations: [
    { asset: "BTC", action: "LONG", direction: 5.2, sizePercent: 0.03, ... }
  ],
  summary: { tradeable: 2, totalHeat: 8.5 },
  shadowComparison: { momentum_focused: {...}, ... }
}
```

---

## 🎯 Character Profiles

### EMO (Emotional Market Oracle)
- **Archetype**: The Vibe Reader
- **Personality**: Energetic, street-smart, contrarian when needed
- **Expertise**: Sentiment analysis, crowd psychology, social media trends
- **Communication**: Punchy 1-2 sentences with crypto slang
- **Knowledge**: Fear & Greed Index, funding rates, social sentiment

### TEKNO (Technical Knowledge Oracle)
- **Archetype**: The Pattern Master
- **Personality**: Cold, analytical, precision-focused
- **Expertise**: Chart patterns, technical indicators, support/resistance
- **Communication**: Precise technical language with specific levels
- **Knowledge**: RSI, MACD, chart patterns, market structure

### MACRO (Macroeconomic Research Oracle)
- **Archetype**: The Big Picture Thinker
- **Personality**: Authoritative, patient, institutional perspective
- **Expertise**: Central bank policy, economic cycles, global trends
- **Communication**: Measured analysis with economic context
- **Knowledge**: Fed policy, economic indicators, currency dynamics

### RL80 (Reinforcement Learning Trading Oracle)
- **Archetype**: The Systematic Executor
- **Personality**: Disciplined, risk-focused, decisive
- **Expertise**: Risk management, position sizing, execution
- **Communication**: Clear actions with defined risk parameters
- **Knowledge**: Team synthesis, position sizing, stop-loss strategies

## 🔧 Customization Options

### Personality Tweaks

**Communication Style:**
```javascript
communicationStyle: {
  tone: 'Your custom tone',
  length: '1-2 sentences or paragraph',
  vocabulary: 'Specific terms and language style'
}
```

**Response Patterns:**
```javascript
responsePatterns: {
  bullish_setup: [
    'Custom bullish response template',
    'Another variation for variety'
  ]
}
```

### Knowledge Expansion

**Add New Indicators:**
```json
{
  "technical_indicators": {
    "your_new_indicator": {
      "calculation": "How it's calculated",
      "bullish_signal": "When bullish",
      "bearish_signal": "When bearish",
      "timeframes": "Best timeframes to use"
    }
  }
}
```

**Add Response Templates:**
```json
{
  "response_frameworks": {
    "your_scenario": "Template with [variables] to fill"
  }
}
```

## 📊 Market Adaptations

The system automatically adapts personality based on market conditions:

### Market Regimes
- **Bull Market**: More aggressive, trend-following
- **Bear Market**: More defensive, risk-focused
- **Sideways**: Range-trading, patience emphasis
- **Volatile**: Reduced sizing, wider stops

### Volatility Levels
- **Low Vol**: Look for breakout setups
- **Normal Vol**: Standard approach
- **High Vol**: Risk reduction mode
- **Extreme Vol**: Capital preservation focus

## 🎪 Advanced Features

### Dynamic Prompt Building
```javascript
const prompt = buildEnhancedPrompt('EMO', context, teamMessages, {
  includeKnowledge: true,     // Include domain knowledge
  adaptToMarket: true,        // Adapt to market conditions  
  responseTemplate: true      // Use response templates
});
```

### Response Validation
```javascript
import { validateCharacterResponse } from './personalitySystem.js';

const validation = validateCharacterResponse('EMO', response);
if (!validation.valid) {
  console.log('Character inconsistency:', validation.warnings);
}
```

### Vocabulary Injection
```javascript
import { getCharacterVocabulary } from './personalitySystem.js';

const slangTerms = getCharacterVocabulary('EMO', 'slang');
// Use in response generation or validation
```

## 🔄 Integration Workflow

### For Existing Agents
1. Import the enhanced prompt builder
2. Replace your prompt generation with `buildEnhancedPrompt()`
3. Use the returned prompts in your API calls
4. Test to ensure character consistency

### For New Agents
1. Create character profile in `personalities/`
2. Create knowledge base in `knowledge/`
3. Build agent using enhanced prompt system
4. Add interaction guidelines to team workflow

## 🎯 Best Practices

### Character Consistency
- Always stay in character
- Use agent-specific vocabulary
- Maintain distinct communication styles
- Reference appropriate knowledge domains

### Knowledge Management
- Keep knowledge bases updated
- Add new market insights regularly
- Remove outdated information
- Organize by logical categories

### Team Dynamics
- Respect other agents' expertise domains
- Reference team members appropriately
- Handle disagreements in character
- Maintain sequential workflow order

## 🚨 Common Pitfalls

### Character Breaks
❌ EMO analyzing technical patterns in detail  
✅ EMO providing sentiment context for technical moves

### Knowledge Overlap
❌ All agents saying the same thing  
✅ Each agent adding unique domain perspective

### Generic Responses
❌ "Market is uncertain"  
✅ Character-specific insights with reasoning

## 🔮 Future Enhancements

**Implemented:**
- [x] Quantitative scoring system (-10 to +10)
- [x] Weighted score aggregation
- [x] Position sizing from conviction
- [x] Risk management enforcement
- [x] Shadow testing of weight schemes
- [x] Firebase decision logging

**Planned:**
- [ ] Outcome tracking (fill P&L when positions close)
- [ ] Weight optimization from shadow test results
- [ ] Analyst accuracy tracking
- [ ] Regime-based weight switching
- [ ] ML-based score calibration

## 💡 Pro Tips

1. **Start Small**: Implement one agent at a time
2. **Test Frequently**: Validate character consistency regularly
3. **Update Knowledge**: Keep domain knowledge current
4. **Monitor Performance**: Track agent accuracy and consistency
5. **Iterate**: Continuously refine personalities based on results

---

Your agents are now ready to deliver authentic, character-driven analysis that maintains consistency while adapting to market conditions! 🎭📈