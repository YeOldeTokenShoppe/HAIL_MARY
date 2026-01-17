# Agent Knowledge Management

## Ways to Add Knowledge to Agents

### 1. **Weekly Market Analysis (Recommended)**
Upload YouTube transcripts via the admin interface at `/admin`:

**How to Use:**
1. Navigate to `/admin` and authenticate with admin password
2. Click "Upload Transcripts" tab
3. Fill in video details and paste transcript content
4. System automatically extracts insights for each agent:
   - **EMO**: Sentiment, fear/greed, social psychology
   - **TEKNO**: Technical levels, patterns, indicators  
   - **MACRO**: Economic policy, Fed commentary, trends
   - **RL80**: Trading strategies, risk management

**Benefits:**
- Keeps agents updated with current market conditions
- Automatically categorizes insights by agent expertise
- Persistent storage in Firebase for historical reference
- Integrated into agent prompts via `buildEnhancedPrompt()`

### 2. **Static Knowledge (In the Agent File)**
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

### 3. **Knowledge Files (JSON/Markdown)**
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

### 4. **Dynamic Knowledge (Database/API)**
Store knowledge in Firestore and load it:

```javascript
// Load from Firestore
const agentKnowledge = await db.collection('agent-knowledge')
  .doc('market-analyst')
  .get();
```

### 5. **Context Injection**
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

### 6. **Vector Database (Advanced)**
For large knowledge bases, use embeddings:
- Store documents as embeddings
- Retrieve relevant context based on query
- Include in agent prompt

## Recommended Approach

For most cases, use a combination:
1. **Weekly market updates** → Admin interface `/admin` (recommended)
2. **Core personality** → In agent file (`configs/personalities/`)
3. **Domain knowledge** → JSON files (`configs/knowledge/`)
4. **Current events** → Firestore or API
5. **Large documents** → Vector database

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