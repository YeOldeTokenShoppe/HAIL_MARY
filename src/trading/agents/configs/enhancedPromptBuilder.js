/**
 * Enhanced Prompt Builder
 * 
 * Builds AI prompts with personality injection, knowledge integration,
 * and context-aware adaptations for each trading agent.
 */

import { buildCharacterPrompt, getResponseTemplate, adaptPersonalityToMarket } from './personalitySystem.js';
import { SCORING_PROMPT_TEMPLATE, ASSETS } from '../../config/scoring-config.js';

// Import knowledge bases
import EMO_KNOWLEDGE from './knowledge/emo-knowledge.json';
import TEKNO_KNOWLEDGE from './knowledge/tekno-knowledge.json';
import MACRO_KNOWLEDGE from './knowledge/macro-knowledge.json';
import RL80_KNOWLEDGE from './knowledge/rl80-knowledge.json';
import { getRecentAnalysisForAgent } from './knowledge/weeklyAnalysisSystem.js';

const KNOWLEDGE_BASES = {
  EMO: EMO_KNOWLEDGE,
  TEKNO: TEKNO_KNOWLEDGE,
  MACRO: MACRO_KNOWLEDGE,
  RL80: RL80_KNOWLEDGE
};

// ============================================================================
// MAIN PROMPT BUILDER
// ============================================================================

/**
 * Build complete prompt for agent with personality and knowledge injection
 * @param {string} agentName - Agent identifier (EMO, TEKNO, MACRO, RL80)
 * @param {Object} context - Trading context and market data
 * @param {Array} teamMessages - Recent messages from other agents
 * @param {Object} options - Additional options for prompt customization
 * @returns {Object} - Complete prompt configuration
 */
export async function buildEnhancedPrompt(agentName, context = {}, teamMessages = [], options = {}) {
  const { marketData = {}, teamAnalysis = null, isSequentialWorkflow = false } = context;
  const { includeKnowledge = true, adaptToMarket = true, responseTemplate = true, includeWeeklyAnalysis = true } = options;

  // Build base character prompt
  const characterPrompt = buildCharacterPrompt(agentName, marketData, { teamMessages });

  // Add knowledge base if requested
  let knowledgeSection = '';
  if (includeKnowledge) {
    knowledgeSection = await buildKnowledgeSection(agentName, marketData, includeWeeklyAnalysis);
  }

  // Add market adaptations
  let adaptationSection = '';
  if (adaptToMarket) {
    adaptationSection = buildAdaptationSection(agentName, marketData);
  }

  // Add team context for RL80
  let teamContextSection = '';
  if (agentName === 'RL80' && teamAnalysis) {
    teamContextSection = buildTeamContextSection(teamAnalysis);
  }

  // Build response constraints
  const responseConstraints = buildResponseConstraints(agentName, marketData, responseTemplate);

  // Assemble final prompt
  const fullPrompt = `${characterPrompt}

${knowledgeSection}

${adaptationSection}

${teamContextSection}

${responseConstraints}

## RESPONSE FORMAT (CRITICAL)
${getResponseFormatGuidance(agentName)}

## RESPONSE REQUIREMENTS
- Respond as ${agentName} would, staying completely in character
- Use your specific vocabulary and communication style
- Keep response to 35-55 words (approximately 200-280 characters)
- Focus on your area of expertise
- Include specific numbers (prices, percentages, levels) when available`;

  return {
    systemPrompt: fullPrompt,
    userPrompt: buildUserPrompt(agentName, context, teamMessages),
    temperature: getTemperatureForAgent(agentName, marketData),
    maxTokens: getMaxTokensForAgent(agentName),
    metadata: {
      agentName,
      marketConditions: analyzeMarketConditions(marketData),
      teamConsensus: analyzeTeamConsensus(teamMessages),
      isSequentialWorkflow
    }
  };
}

// ============================================================================
// SCORING PROMPT BUILDER
// ============================================================================

/**
 * Build prompt for scoring mode - includes instructions for JSON output
 * @param {string} agentName - Agent identifier (EMO, TEKNO, MACRO)
 * @param {Object} context - Trading context and market data
 * @param {Array} teamMessages - Recent messages from other agents
 * @param {Object} options - Additional options
 * @returns {Object} - Complete prompt configuration with scoring instructions
 */
export async function buildScoringPrompt(agentName, context = {}, teamMessages = [], options = {}) {
  const { marketData = {}, teamAnalysis = null, isSequentialWorkflow = false } = context;
  const { includeKnowledge = true, adaptToMarket = true, includeWeeklyAnalysis = true } = options;

  // Build base character prompt
  const characterPrompt = buildCharacterPrompt(agentName, marketData, { teamMessages });

  // Add knowledge base if requested
  let knowledgeSection = '';
  if (includeKnowledge) {
    knowledgeSection = await buildKnowledgeSection(agentName, marketData, includeWeeklyAnalysis);
  }

  // Add market adaptations
  let adaptationSection = '';
  if (adaptToMarket) {
    adaptationSection = buildAdaptationSection(agentName, marketData);
  }

  // Add team context for RL80
  let teamContextSection = '';
  if (agentName === 'RL80' && teamAnalysis) {
    teamContextSection = buildTeamContextSection(teamAnalysis);
  }

  // Build scoring-specific system prompt
  const fullPrompt = `${characterPrompt}

${knowledgeSection}

${adaptationSection}

${teamContextSection}

## RESPONSE FORMAT (CRITICAL)
${getResponseFormatGuidance(agentName)}

## RESPONSE REQUIREMENTS
- Respond as ${agentName} would, staying completely in character
- Use your specific vocabulary and communication style
- Keep your text analysis to 35-55 words (~200-280 characters)
- Include specific numbers (prices, percentages, levels)
- IMPORTANT: You MUST provide scores for all assets in your analysis

${SCORING_PROMPT_TEMPLATE}`;

  return {
    systemPrompt: fullPrompt,
    userPrompt: buildScoringUserPrompt(agentName, context, teamMessages),
    temperature: getTemperatureForAgent(agentName, marketData),
    maxTokens: getMaxTokensForScoringAgent(agentName),
    metadata: {
      agentName,
      marketConditions: analyzeMarketConditions(marketData),
      teamConsensus: analyzeTeamConsensus(teamMessages),
      isSequentialWorkflow,
      scoringMode: true
    }
  };
}

/**
 * Build user prompt for scoring mode
 * @param {string} agentName - Agent name
 * @param {Object} context - Context with market data
 * @param {Array} teamMessages - Team messages
 * @returns {string}
 */
function buildScoringUserPrompt(agentName, context, teamMessages) {
  const { marketData = {} } = context;

  let prompt = `Analyze the current market and provide your ${agentName} assessment.\n\n`;

  prompt += `**Current Market Data:**\n`;
  if (marketData.btcPrice) prompt += `- BTC: $${marketData.btcPrice.toLocaleString()}\n`;
  if (marketData.ethPrice) prompt += `- ETH: $${marketData.ethPrice.toLocaleString()}\n`;
  if (marketData.fearGreed !== undefined) prompt += `- Fear & Greed Index: ${marketData.fearGreed}\n`;
  if (marketData.vix !== undefined) prompt += `- VIX: ${marketData.vix.toFixed(1)}\n`;
  if (marketData.dxy !== undefined) prompt += `- DXY: ${marketData.dxy.toFixed(2)}\n`;
  if (marketData.fundingRate !== undefined) prompt += `- Funding Rate: ${(marketData.fundingRate * 100).toFixed(3)}%\n`;
  if (marketData.openInterest !== undefined) prompt += `- Open Interest: $${marketData.openInterest}B\n`;

  // Add news data for EMO agent
  if (agentName === 'EMO' && marketData.news?.headlines?.length > 0) {
    prompt += `\n**Latest Crypto News Headlines:**\n`;
    const newsToShow = marketData.news.headlines.slice(0, 8);
    newsToShow.forEach(h => {
      const sentimentIcon = h.sentiment === 'bullish' ? '📈' : h.sentiment === 'bearish' ? '📉' : '➖';
      prompt += `${sentimentIcon} ${h.title} (${h.source})\n`;
    });

    const sentiment = marketData.news.sentiment;
    if (sentiment) {
      prompt += `\n**News Sentiment Summary:** ${sentiment.bullish} bullish, ${sentiment.bearish} bearish, ${sentiment.neutral} neutral\n`;
      const score = marketData.news.sentimentScore;
      if (score !== undefined) {
        prompt += `**News Sentiment Score:** ${score > 0 ? '+' : ''}${score.toFixed(2)} (-1 bearish to +1 bullish)\n`;
      }
    }
  }

  if (teamMessages?.length > 0) {
    prompt += `\n**Recent Team Messages:**\n`;
    teamMessages.slice(-3).forEach(msg => {
      prompt += `- ${msg.agent}: ${msg.message}\n`;
    });
  }

  prompt += `\n**Required Assets to Score:** ${ASSETS.join(', ')}\n`;
  prompt += `\nProvide your analysis in character (35-55 words), then include your scores in <scores> tags.`;
  prompt += `\nYour text will be shown to users - be specific with numbers, start with "I'm seeing/watching/reading..."`;

  return prompt;
}

/**
 * Get max tokens for scoring mode (larger to accommodate JSON)
 * @param {string} agentName - Agent name
 * @returns {number}
 */
function getMaxTokensForScoringAgent(agentName) {
  // Scoring mode needs more tokens for JSON output
  return {
    EMO: 500,
    TEKNO: 500,
    MACRO: 500,
    RL80: 600
  }[agentName] || 500;
}

// ============================================================================
// SECTION BUILDERS
// ============================================================================

/**
 * Build knowledge section from agent's knowledge base
 */
async function buildKnowledgeSection(agentName, marketData, includeWeeklyAnalysis = true) {
  const knowledge = KNOWLEDGE_BASES[agentName];
  if (!knowledge) return '';

  let section = `## YOUR KNOWLEDGE BASE\n`;

  // Agent-specific knowledge integration
  switch (agentName) {
    case 'EMO':
      section += buildEMOKnowledgeSection(knowledge, marketData);
      break;
    case 'TEKNO':
      section += buildTEKNOKnowledgeSection(knowledge, marketData);
      break;
    case 'MACRO':
      section += buildMACROKnowledgeSection(knowledge, marketData);
      break;
    case 'RL80':
      section += buildRL80KnowledgeSection(knowledge, marketData);
      break;
    default:
      section += 'Apply your expertise to current market conditions.';
  }

  // Add recent weekly analysis if available
  if (includeWeeklyAnalysis) {
    const weeklyInsights = await getRecentWeeklyAnalysis(agentName);
    if (weeklyInsights.length > 0) {
      section += buildWeeklyAnalysisSection(weeklyInsights, agentName);
    }
  }

  return section;
}

/**
 * Get recent weekly analysis for agent
 */
async function getRecentWeeklyAnalysis(agentName) {
  try {
    return await getRecentAnalysisForAgent(agentName, 7); // Last 7 days
  } catch (error) {
    console.log(`No weekly analysis available for ${agentName}:`, error.message);
    return [];
  }
}

/**
 * Build weekly analysis section
 */
function buildWeeklyAnalysisSection(weeklyInsights, agentName) {
  let section = `\n## RECENT WEEKLY ANALYSIS\n`;
  
  weeklyInsights.slice(0, 2).forEach((analysis, index) => {
    section += `\n**${analysis.source} (${new Date(analysis.date).toLocaleDateString()})**\n`;
    
    if (analysis.insights && analysis.insights.length > 0) {
      section += `Key insights:\n`;
      analysis.insights.slice(0, 3).forEach(insight => {
        section += `- ${insight.type}: ${insight.content}\n`;
      });
    }
    
    if (analysis.keyQuotes && analysis.keyQuotes.length > 0) {
      section += `Notable quotes:\n`;
      analysis.keyQuotes.slice(0, 2).forEach(quote => {
        section += `- "${quote}"\n`;
      });
    }
  });
  
  section += `\n*Use these recent insights to inform your ${agentName} analysis.*\n`;
  return section;
}

/**
 * Build EMO-specific knowledge section
 */
function buildEMOKnowledgeSection(knowledge, marketData) {
  let section = '';

  // Fear & Greed interpretation
  if (marketData.fearGreed !== undefined) {
    const fearGreedData = knowledge.sentiment_indicators?.fear_greed_index;
    const currentLevel = interpretFearGreed(marketData.fearGreed, fearGreedData);
    
    section += `**Current Fear & Greed: ${marketData.fearGreed}**\n`;
    section += `- Level: ${currentLevel.level}\n`;
    section += `- Interpretation: ${currentLevel.interpretation}\n`;
    section += `- Signal: ${currentLevel.signal}\n`;
    section += `- Keywords: ${currentLevel.keywords?.join(', ')}\n\n`;
  }

  // Funding rate interpretation
  if (marketData.fundingRate !== undefined) {
    const fundingData = knowledge.sentiment_indicators?.funding_rates;
    const currentFunding = interpretFundingRate(marketData.fundingRate, fundingData);
    
    section += `**Current Funding Rate: ${(marketData.fundingRate * 100).toFixed(3)}%**\n`;
    section += `- Interpretation: ${currentFunding.interpretation}\n`;
    section += `- Signal: ${currentFunding.signal}\n`;
    section += `- Meaning: ${currentFunding.meaning}\n\n`;
  }

  // Response patterns
  section += `**Response Framework:**\n`;
  Object.entries(knowledge.response_frameworks || {}).forEach(([key, pattern]) => {
    section += `- ${key.replace('_', ' ')}: ${pattern}\n`;
  });

  return section;
}

/**
 * Build TEKNO-specific knowledge section
 */
function buildTEKNOKnowledgeSection(knowledge, marketData) {
  let section = '';

  // Price level analysis
  if (marketData.btcPrice) {
    section += `**Current BTC Price: $${marketData.btcPrice.toLocaleString()}**\n`;
    section += `- Focus on key support/resistance levels\n`;
    section += `- Monitor for breakouts or breakdowns\n`;
    section += `- Assess volume confirmation\n\n`;
  }

  // Technical indicators reference
  section += `**Key Technical Indicators to Consider:**\n`;
  Object.entries(knowledge.technical_indicators || {}).forEach(([category, indicators]) => {
    section += `- ${category.toUpperCase()}: ${Object.keys(indicators).join(', ')}\n`;
  });

  // Chart patterns
  section += `\n**Chart Patterns:**\n`;
  Object.entries(knowledge.chart_patterns || {}).forEach(([type, patterns]) => {
    section += `- ${type.replace('_', ' ')}: ${Object.keys(patterns).join(', ')}\n`;
  });

  return section;
}

/**
 * Build MACRO-specific knowledge section
 */
function buildMACROKnowledgeSection(knowledge, marketData) {
  let section = '';

  // Current macro environment
  section += `**Macro Context:**\n`;
  
  if (marketData.vix !== undefined) {
    section += `- VIX: ${marketData.vix.toFixed(1)} (Fear gauge)\n`;
  }
  
  if (marketData.dxy !== undefined) {
    section += `- Dollar Index: ${marketData.dxy.toFixed(1)}\n`;
  }

  // Policy regime analysis
  section += `\n**Consider Current Policy Regime:**\n`;
  Object.entries(knowledge.policy_regimes || {}).forEach(([regime, data]) => {
    section += `- ${regime.toUpperCase()}: ${data.crypto_impact}\n`;
  });

  // Key indicators to monitor
  section += `\n**Key Macro Indicators:**\n`;
  const indicators = knowledge.economic_indicators;
  if (indicators) {
    section += `- Inflation: ${Object.keys(indicators.inflation || {}).join(', ')}\n`;
    section += `- Employment: ${Object.keys(indicators.employment || {}).join(', ')}\n`;
    section += `- Growth: ${Object.keys(indicators.growth || {}).join(', ')}\n`;
  }

  return section;
}

/**
 * Build RL80-specific knowledge section
 */
function buildRL80KnowledgeSection(knowledge, marketData) {
  let section = '';

  // Risk management framework
  section += `**Risk Management Active:**\n`;
  const riskMgmt = knowledge.risk_management;
  if (riskMgmt) {
    section += `- Max single position: ${riskMgmt.position_sizing?.portfolio_limits?.single_position || '5%'}\n`;
    section += `- Max portfolio heat: ${riskMgmt.position_sizing?.portfolio_limits?.total_heat || '15%'}\n`;
    section += `- Stop loss: 2-3% typical\n\n`;
  }

  // Current market regime assessment
  const volatility = assessVolatility(marketData);
  section += `**Current Market Regime: ${volatility}**\n`;
  
  const regimeData = knowledge.market_regimes?.[volatility];
  if (regimeData) {
    section += `- Strategy: ${regimeData.strategy}\n`;
    section += `- Position sizing: ${regimeData.position_sizing}\n`;
    section += `- Stop management: ${regimeData.stop_management}\n\n`;
  }

  // Team synthesis framework
  section += `**Team Signal Processing:**\n`;
  Object.entries(knowledge.team_synthesis?.consensus_scenarios || {}).forEach(([scenario, data]) => {
    section += `- ${scenario.replace('_', ' ')}: ${data.action} (${data.sizing})\n`;
  });

  return section;
}

/**
 * Build adaptation section for market conditions
 */
function buildAdaptationSection(agentName, marketData) {
  const adaptations = adaptPersonalityToMarket(agentName, {
    regime: assessMarketRegime(marketData),
    volatility: assessVolatility(marketData)
  });

  if (!adaptations || Object.keys(adaptations).length === 0) {
    return '';
  }

  let section = `## MARKET ADAPTATIONS\n`;
  Object.entries(adaptations).forEach(([key, value]) => {
    section += `**${key.toUpperCase()}**: ${value}\n`;
  });

  return section;
}

/**
 * Build team context section for RL80
 */
function buildTeamContextSection(teamAnalysis) {
  if (!teamAnalysis) return '';

  return `## TEAM ANALYSIS INPUT

**EMO Analysis:** ${teamAnalysis.emoAnalysis || 'Not provided'}

**TEKNO Analysis:** ${teamAnalysis.teknoAnalysis || 'Not provided'}

**MACRO Analysis:** ${teamAnalysis.macroAnalysis || 'Not provided'}

**Your Task:** Synthesize these inputs with current market data to make final trading decision.
`;
}

/**
 * Build response constraints and templates
 */
function buildResponseConstraints(agentName, marketData, useTemplate) {
  let section = '';

  if (useTemplate) {
    const template = getResponseTemplate(agentName, {
      fearGreed: marketData.fearGreed,
      policy: assessPolicy(marketData),
      consensus: 'mixed' // Will be determined by actual team analysis
    });

    if (template) {
      section += `**Suggested Response Pattern:** ${template}\n`;
    }
  }

  return section;
}

// ============================================================================
// USER PROMPT BUILDER
// ============================================================================

/**
 * Build user prompt with current context
 */
function buildUserPrompt(agentName, context, teamMessages) {
  const { marketData = {} } = context;
  
  let prompt = `Analyze current market conditions and provide your ${agentName} perspective.\n\n`;
  
  prompt += `**Market Data:**\n`;
  if (marketData.btcPrice) prompt += `- BTC: $${marketData.btcPrice.toLocaleString()}\n`;
  if (marketData.fearGreed !== undefined) prompt += `- Fear & Greed: ${marketData.fearGreed}\n`;
  if (marketData.vix !== undefined) prompt += `- VIX: ${marketData.vix.toFixed(1)}\n`;
  if (marketData.fundingRate !== undefined) prompt += `- Funding: ${(marketData.fundingRate * 100).toFixed(3)}%\n`;

  if (teamMessages?.length > 0) {
    prompt += `\n**Recent Team Messages:**\n`;
    teamMessages.slice(-3).forEach(msg => {
      prompt += `- ${msg.agent}: ${msg.message}\n`;
    });
  }

  prompt += `\nProvide your analysis staying true to your character and expertise.`;

  return prompt;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function interpretFearGreed(value, fearGreedData) {
  for (const [level, data] of Object.entries(fearGreedData || {})) {
    const range = data.range.split('-').map(n => parseInt(n));
    if (value >= range[0] && value <= range[1]) {
      return { level, ...data };
    }
  }
  return { level: 'unknown', interpretation: 'Unknown level' };
}

function interpretFundingRate(rate, fundingData) {
  const percentage = rate * 100;
  
  for (const [level, data] of Object.entries(fundingData || {})) {
    const range = data.range;
    // Parse range and check if current rate falls within it
    if (range.includes('<') && percentage < parseFloat(range.split(' ')[1])) {
      return data;
    }
    if (range.includes('>') && percentage > parseFloat(range.split(' ')[1])) {
      return data;
    }
    if (range.includes('to')) {
      const [min, max] = range.split(' to ').map(r => parseFloat(r.replace('%', '')));
      if (percentage >= min && percentage <= max) {
        return data;
      }
    }
  }
  
  return { interpretation: 'Normal range', signal: 'Neutral' };
}

function assessMarketRegime(marketData) {
  // Simple regime assessment - can be enhanced
  if (marketData.vix > 30) return 'volatile';
  if (marketData.fearGreed < 30) return 'bear';
  if (marketData.fearGreed > 70) return 'bull';
  return 'sideways';
}

function assessVolatility(marketData) {
  if (marketData.vix > 30) return 'high';
  if (marketData.vix < 15) return 'low';
  return 'normal';
}

function assessPolicy(marketData) {
  // Simple policy assessment - can be enhanced with real data
  if (marketData.dxy > 105) return 'hawkish';
  if (marketData.dxy < 100) return 'dovish';
  return 'neutral';
}

function analyzeMarketConditions(marketData) {
  return {
    regime: assessMarketRegime(marketData),
    volatility: assessVolatility(marketData),
    policy: assessPolicy(marketData)
  };
}

function analyzeTeamConsensus(teamMessages) {
  if (!teamMessages || teamMessages.length === 0) return 'unknown';
  
  // Simple sentiment analysis of recent messages
  const recentMessages = teamMessages.slice(-3);
  let bullish = 0, bearish = 0;
  
  recentMessages.forEach(msg => {
    const text = (msg.message || '').toLowerCase();
    if (text.match(/bull|buy|long|up|positive/)) bullish++;
    if (text.match(/bear|sell|short|down|negative/)) bearish++;
  });
  
  if (bullish > bearish) return 'bullish';
  if (bearish > bullish) return 'bearish';
  return 'mixed';
}

function getTemperatureForAgent(agentName, marketData) {
  // Adjust creativity based on agent and market conditions
  const baseTemp = {
    EMO: 0.8,    // More creative for sentiment
    TEKNO: 0.6,  // Balanced for technical
    MACRO: 0.7,  // Slightly creative for macro
    RL80: 0.5    // More deterministic for decisions
  };
  
  return baseTemp[agentName] || 0.7;
}

function getMaxTokensForAgent(agentName) {
  // Token limits for chat mode - targets 35-55 words (~200-280 chars)
  // Scoring mode uses getMaxTokensForScoringAgent() which allows more for JSON
  return {
    EMO: 85,
    TEKNO: 85,
    MACRO: 90,
    RL80: 95
  }[agentName] || 85;
}

/**
 * Get role-aware response format guidance
 * Oracles (EMO, TEKNO, MACRO) report analysis to RL80
 * RL80 is the trader who synthesizes and executes
 */
function getResponseFormatGuidance(agentName) {
  if (agentName === 'RL80') {
    // RL80 is the trader - she executes trades
    return `You ARE the trader. You execute trades based on oracle analysis.
START with action: "I'm [holding/adding/closing/watching] [asset]..."
INCLUDE: Your position, oracle synthesis, specific risk levels (stops, targets)
EXAMPLE: "I'm holding my ETH-PERP long as the oracles lean bullish - TEKNO confirms support at $3,400, EMO sees squeeze potential. Stops at $3,200, targeting $3,800."`;
  }

  // Oracles report their domain analysis to RL80
  const oracleGuidance = {
    EMO: `You are an ORACLE reporting sentiment analysis to RL80 (the trader).
START with observation: "I'm seeing..." or "I'm reading..." or "Sentiment shows..."
INCLUDE: Specific F&G number, funding rates, crowd positioning, your directional read
EXAMPLE: "I'm seeing fear at F&G 32 with negative funding suggesting shorts are stacking - not extreme yet, but squeeze potential is building if we dip to sub-25 territory."`,

    TEKNO: `You are an ORACLE reporting technical analysis to RL80 (the trader).
START with observation: "I'm watching..." or "Structure shows..." or "I'm seeing..."
INCLUDE: Specific price levels, support/resistance, indicators (RSI, etc.), your directional read
EXAMPLE: "I'm watching BTC hold $95k support with RSI neutral at 48 - need a break above $98k to confirm continuation, range-bound until then favors patience."`,

    MACRO: `You are an ORACLE reporting macro analysis to RL80 (the trader).
START with observation: "I'm reading..." or "Macro shows..." or "I'm seeing..."
INCLUDE: Specific DXY, VIX, yields, policy context, your regime assessment
EXAMPLE: "I'm reading the macro as cautious risk-off with DXY at 104.5 and VIX elevated at 23 - yields still pressuring risk assets, patience favored until Fed signals clearly."`
  };

  return oracleGuidance[agentName] || 'Provide clear, specific analysis with data points.';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  buildEnhancedPrompt,
  buildScoringPrompt,
  buildKnowledgeSection,
  buildUserPrompt,
  analyzeMarketConditions
};