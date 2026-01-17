# Agent Personality & Character System

A comprehensive system for establishing distinct personalities, knowledge bases, and character-driven responses for your trading agents.

## 🎭 System Overview

Your trading agents now have:
- **Deep character profiles** with personality traits, communication styles, and relationships
- **Specialized knowledge bases** with domain-specific expertise
- **Dynamic personality injection** that adapts to market conditions
- **Character-consistent responses** that maintain authenticity

## 📁 File Structure

```
src/trading/agents/configs/
├── personalities/
│   ├── emo-character.js      # EMO's complete personality profile
│   ├── tekno-character.js    # TEKNO's character definition
│   ├── macro-character.js    # MACRO's personality traits
│   └── rl80-character.js     # RL80's decision framework
├── knowledge/
│   ├── emo-knowledge.json    # Sentiment analysis expertise
│   ├── tekno-knowledge.json  # Technical analysis knowledge
│   ├── macro-knowledge.json  # Economic/policy knowledge
│   └── rl80-knowledge.json   # Risk management systems
├── personalitySystem.js      # Core personality engine
├── enhancedPromptBuilder.js  # Dynamic prompt construction
└── agentInteractionGuidelines.md # Team interaction rules
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

Potential additions to the system:
- Real-time personality learning
- Market regime detection
- Dynamic knowledge updates
- Cross-agent relationship evolution
- Performance-based personality adaptation

## 💡 Pro Tips

1. **Start Small**: Implement one agent at a time
2. **Test Frequently**: Validate character consistency regularly
3. **Update Knowledge**: Keep domain knowledge current
4. **Monitor Performance**: Track agent accuracy and consistency
5. **Iterate**: Continuously refine personalities based on results

---

Your agents are now ready to deliver authentic, character-driven analysis that maintains consistency while adapting to market conditions! 🎭📈