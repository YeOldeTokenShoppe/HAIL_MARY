import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import firestorePlugin from './firestore-plugin.ts';
import { character } from './character.ts';

/**
 * RL80 Agent - Our Lady of Perpetual Profit
 *
 * This is the ElizaOS implementation of RL80, the lead trader who synthesizes
 * analysis from the Three Wise Oracles (EMO, TEKNO, MACRO) into trading decisions.
 *
 * The agent connects to the existing HAIL_MARY Firestore database to access:
 * - Real-time market data (prices, volumes, changes)
 * - Technical indicators (RSI, MACD, support/resistance)
 * - Sentiment data (Fear & Greed Index)
 * - Macro data (VIX, DXY, Treasury yields)
 * - Oracle scores from EMO, TEKNO, MACRO
 */

const initCharacter = async ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('===========================================');
  logger.info('   RL80 - Our Lady of Perpetual Profit');
  logger.info('   Lead Trader & Synthesis Engine');
  logger.info('===========================================');
  logger.info({ name: character.name }, 'Initializing character:');

  // Log plugin status
  const hasFirebase = !!(
    process.env.FIREBASE_PROJECT_ID &&
    (process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY_BASE64)
  );

  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasDiscord = !!process.env.DISCORD_API_TOKEN;
  const hasTelegram = !!process.env.TELEGRAM_BOT_TOKEN;

  logger.info({
    firebase: hasFirebase ? 'connected' : 'not configured',
    anthropic: hasAnthropic ? 'available' : 'not configured',
    openai: hasOpenAI ? 'available' : 'not configured',
    discord: hasDiscord ? 'enabled' : 'disabled',
    telegram: hasTelegram ? 'enabled' : 'disabled',
  }, 'Service status:');

  if (!hasAnthropic && !hasOpenAI) {
    logger.warn('No LLM provider configured! Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env');
  }

  if (!hasFirebase) {
    logger.warn('Firebase not configured - RL80 will not have access to market data');
    logger.warn('Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to .env');
  }

  logger.info('RL80 initialized - "Let mama cook."');
};

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  plugins: [firestorePlugin], // Custom Firestore plugin for market data
};

const project: Project = {
  agents: [projectAgent],
};

export { character } from './character.ts';

export default project;
