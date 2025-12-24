# Agent Knowledge Management

## Ways to Add Knowledge to Agents

### 1. **Static Knowledge (In the Agent File)**
Edit the agent's configuration directly:
```javascript
// In market-analyst.js
expertise: {
  indicators: {
    momentum: ['RSI', 'MACD', 'Stochastic'],
    // Add new indicators here
    custom: ['Your Custom Indicator', 'Special Pattern']
  }
}
```

### 2. **Knowledge Files (JSON/Markdown)**
Create separate knowledge files that agents can import:

```javascript
// knowledge/market-patterns.json
{
  "patterns": {
    "wyckoff": {
      "accumulation": ["Spring", "Test", "Sign of Strength"],
      "distribution": ["UTAD", "SOW", "LPSY"]
    }
  }
}

// Then in agent file:
import marketPatterns from './knowledge/market-patterns.json';
```

### 3. **Dynamic Knowledge (Database/API)**
Store knowledge in Firestore and load it:

```javascript
// Load from Firestore
const agentKnowledge = await db.collection('agent-knowledge')
  .doc('market-analyst')
  .get();
```

### 4. **Context Injection**
Add specific knowledge in the prompt:

```javascript
// In your agent file
const specificKnowledge = `
Recent important events:
- Fed meeting on Dec 18
- BTC halving in April 2024
- ETH Dencun upgrade completed
`;

// Add to prompt
user: buildUserPrompt(marketData, lastMessages, specificKnowledge)
```

### 5. **Vector Database (Advanced)**
For large knowledge bases, use embeddings:
- Store documents as embeddings
- Retrieve relevant context based on query
- Include in agent prompt

## Recommended Approach

For most cases, use a combination:
1. **Core personality** → In agent file
2. **Domain knowledge** → JSON files
3. **Current events** → Firestore or API
4. **Large documents** → Vector database

## Example Knowledge File Structure

```
src/lib/agents/
├── sentiment-oracle.js
├── market-analyst.js
├── macro-specialist.js
├── rl80-trader.js
└── knowledge/
    ├── trading-patterns.json
    ├── market-events.json
    ├── technical-setups.json
    └── crypto-terms.json
```