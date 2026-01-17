/**
 * Agent Personality System
 * 
 * Centralized system for injecting personality traits, communication styles,
 * and character-specific knowledge into agent responses.
 */

// Import character profiles
import EMO_CHARACTER from './personalities/emo-character.js';
import TEKNO_CHARACTER from './personalities/tekno-character.js';
import MACRO_CHARACTER from './personalities/macro-character.js';
import RL80_CHARACTER from './personalities/rl80-character.js';

// ============================================================================
// CHARACTER REGISTRY
// ============================================================================

export const CHARACTERS = {
  EMO: EMO_CHARACTER,
  TEKNO: TEKNO_CHARACTER,
  MACRO: MACRO_CHARACTER,
  RL80: RL80_CHARACTER
};

// ============================================================================
// PERSONALITY INJECTION FUNCTIONS
// ============================================================================

/**
 * Build character-specific system prompt
 * @param {string} agentName - Name of the agent (EMO, TEKNO, MACRO, RL80)
 * @param {Object} marketContext - Current market conditions
 * @param {Object} teamContext - Other agents' recent messages
 * @returns {string} - Complete system prompt with personality
 */
export function buildCharacterPrompt(agentName, marketContext = {}, teamContext = {}) {
  const character = CHARACTERS[agentName];
  if (!character) {
    throw new Error(`Unknown character: ${agentName}`);
  }

  const prompt = `
# ${character.identity.fullName} (${character.identity.name})

## CORE IDENTITY
You are ${character.identity.name}, the ${character.identity.role}. ${character.identity.archetype}.

**Personality**: ${character.personality.coreTraits.join(', ')}

**Communication Style**: 
- Tone: ${character.communication.voice.tone}
- Length: ${character.communication.format.length}
- Structure: ${character.communication.format.structure}
- Vocabulary: Focus on ${character.communication.language.vocabulary.primary.join(', ')}

## YOUR ROLE IN THE TEAM
${buildTeamDynamicsPrompt(character, agentName)}

## CURRENT MARKET CONTEXT
${buildMarketContextPrompt(character, marketContext)}

## RESPONSE GUIDELINES
1. Stay strictly in character - embody ${character.identity.name}'s personality
2. Use your specific vocabulary and communication patterns
3. Respond with ${character.communication.format.length}
4. Focus on your expertise: ${character.expertise.primary.join(', ')}
5. Consider team dynamics and your relationships with other agents

## DECISION FRAMEWORK
${buildDecisionFramework(character, agentName)}

Remember: You are ${character.identity.name}. Think, speak, and analyze exactly as this character would.
`;

  return prompt;
}

/**
 * Build team dynamics section for prompt
 */
function buildTeamDynamicsPrompt(character, agentName) {
  if (!character.relationships?.teamDynamics) {
    return 'Work collaboratively with your team.';
  }

  const dynamics = character.relationships.teamDynamics;
  let prompt = 'Team Relationships:\n';
  
  Object.entries(dynamics).forEach(([agent, relationship]) => {
    prompt += `- ${agent}: ${relationship.dynamic}. ${relationship.collaboration}\n`;
  });

  return prompt;
}

/**
 * Build market context section
 */
function buildMarketContextPrompt(character, marketContext) {
  if (!marketContext || Object.keys(marketContext).length === 0) {
    return 'No specific market context provided.';
  }

  let prompt = 'Current Market Data:\n';
  
  if (marketContext.btcPrice) {
    prompt += `- BTC Price: $${marketContext.btcPrice.toLocaleString()}\n`;
  }
  if (marketContext.fearGreed !== undefined) {
    prompt += `- Fear & Greed Index: ${marketContext.fearGreed}\n`;
  }
  if (marketContext.vix !== undefined) {
    prompt += `- VIX: ${marketContext.vix}\n`;
  }
  if (marketContext.fundingRate !== undefined) {
    prompt += `- Funding Rate: ${(marketContext.fundingRate * 100).toFixed(3)}%\n`;
  }

  return prompt;
}

/**
 * Build character-specific decision framework
 */
function buildDecisionFramework(character, agentName) {
  if (agentName === 'RL80' && character.decisionFramework?.signalSynthesis) {
    return `Signal Synthesis Framework:
- Strong Buy: ${character.decisionFramework.signalSynthesis.strongBuy.conditions.join(', ')}
- Buy: ${character.decisionFramework.signalSynthesis.buy.conditions.join(', ')}
- Hold: ${character.decisionFramework.signalSynthesis.hold.conditions.join(', ')}
- Sell: ${character.decisionFramework.signalSynthesis.sell.conditions.join(', ')}
- Strong Sell: ${character.decisionFramework.signalSynthesis.strongSell.conditions.join(', ')}`;
  }

  if (character.expertise?.primary) {
    return `Focus Areas: ${character.expertise.primary.join(', ')}`;
  }

  return 'Apply your expertise to current market conditions.';
}

// ============================================================================
// RESPONSE TEMPLATE SYSTEM
// ============================================================================

/**
 * Get appropriate response template based on market conditions
 * @param {string} agentName - Agent name
 * @param {Object} conditions - Current market conditions
 * @returns {string|null} - Template or null if none match
 */
export function getResponseTemplate(agentName, conditions = {}) {
  const character = CHARACTERS[agentName];
  if (!character?.responseTemplates) return null;

  // EMO - Sentiment-based templates
  if (agentName === 'EMO') {
    const fearGreed = conditions.fearGreed;
    if (fearGreed !== undefined) {
      if (fearGreed < 25) return getRandomTemplate(character.responseTemplates.extremeFear);
      if (fearGreed > 75) return getRandomTemplate(character.responseTemplates.extremeGreed);
      if (fearGreed >= 40 && fearGreed <= 60) return getRandomTemplate(character.responseTemplates.neutral);
    }
  }

  // TEKNO - Technical condition templates
  if (agentName === 'TEKNO') {
    if (conditions.breakout) return getRandomTemplate(character.responseTemplates.bullishBreakout);
    if (conditions.breakdown) return getRandomTemplate(character.responseTemplates.bearishBreakdown);
    if (conditions.consolidation) return getRandomTemplate(character.responseTemplates.consolidation);
  }

  // MACRO - Policy-based templates
  if (agentName === 'MACRO') {
    if (conditions.policy === 'dovish') return getRandomTemplate(character.responseTemplates.dovishPolicy);
    if (conditions.policy === 'hawkish') return getRandomTemplate(character.responseTemplates.hawkishPolicy);
    if (conditions.uncertainty) return getRandomTemplate(character.responseTemplates.uncertainty);
  }

  // RL80 - Team consensus templates
  if (agentName === 'RL80') {
    if (conditions.consensus === 'bullish') return getRandomTemplate(character.responseTemplates.teamConsensus);
    if (conditions.consensus === 'bearish') return getRandomTemplate(character.responseTemplates.teamConsensus);
    if (conditions.consensus === 'mixed') return getRandomTemplate(character.responseTemplates.teamDivergence);
  }

  return null;
}

/**
 * Get random template from array
 */
function getRandomTemplate(templates) {
  if (!templates || !Array.isArray(templates)) return null;
  return templates[Math.floor(Math.random() * templates.length)];
}

// ============================================================================
// VOCABULARY INJECTION
// ============================================================================

/**
 * Get character-specific vocabulary for response generation
 * @param {string} agentName - Agent name
 * @param {string} category - Vocabulary category (primary, technical, etc.)
 * @returns {Array} - Array of vocabulary terms
 */
export function getCharacterVocabulary(agentName, category = 'primary') {
  const character = CHARACTERS[agentName];
  if (!character?.communication?.language?.vocabulary) return [];

  return character.communication.language.vocabulary[category] || [];
}

// ============================================================================
// PERSONALITY VALIDATION
// ============================================================================

/**
 * Validate if a response matches the character's personality
 * @param {string} agentName - Agent name
 * @param {string} response - Generated response
 * @returns {Object} - Validation result with suggestions
 */
export function validateCharacterResponse(agentName, response) {
  const character = CHARACTERS[agentName];
  if (!character) return { valid: false, reason: 'Unknown character' };

  const validation = {
    valid: true,
    warnings: [],
    suggestions: []
  };

  // Check length
  const expectedLength = character.communication.format.length;
  const sentences = response.split('.').filter(s => s.trim().length > 0);
  
  if (expectedLength.includes('1-2 sentences') && sentences.length > 2) {
    validation.warnings.push('Response too long for character');
  }

  // Check vocabulary usage
  const vocabulary = character.communication.language.vocabulary.primary;
  const hasCharacterVocab = vocabulary.some(term => 
    response.toLowerCase().includes(term.toLowerCase())
  );

  if (!hasCharacterVocab) {
    validation.suggestions.push(`Consider using character vocabulary: ${vocabulary.slice(0, 3).join(', ')}`);
  }

  // Character-specific validations
  if (agentName === 'EMO') {
    if (!response.match(/\b(vibe|sentiment|crowd|narrative)\b/i)) {
      validation.suggestions.push('EMO should reference sentiment or vibes');
    }
  }

  if (agentName === 'TEKNO') {
    if (!response.match(/\b(level|support|resistance|pattern)\b/i)) {
      validation.suggestions.push('TEKNO should reference technical levels');
    }
  }

  return validation;
}

// ============================================================================
// CONTEXT ADAPTATION
// ============================================================================

/**
 * Adapt personality based on current market conditions
 * @param {string} agentName - Agent name
 * @param {Object} marketConditions - Current market state
 * @returns {Object} - Adapted personality traits
 */
export function adaptPersonalityToMarket(agentName, marketConditions = {}) {
  const character = CHARACTERS[agentName];
  if (!character?.adaptations) return {};

  const adaptations = {};

  // Market regime adaptations
  if (marketConditions.regime && character.adaptations.marketRegimes) {
    adaptations.regime = character.adaptations.marketRegimes[marketConditions.regime];
  }

  // Volatility adaptations
  if (marketConditions.volatility && character.adaptations.volatility) {
    adaptations.volatility = character.adaptations.volatility[marketConditions.volatility];
  }

  return adaptations;
}

// ============================================================================
// EXPORT MAIN FUNCTIONS
// ============================================================================

export default {
  buildCharacterPrompt,
  getResponseTemplate,
  getCharacterVocabulary,
  validateCharacterResponse,
  adaptPersonalityToMarket,
  CHARACTERS
};