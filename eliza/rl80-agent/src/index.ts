import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import debatePlugin from './debate-plugin.ts';
import { saintGr80Character } from './saint-gr80.ts';
import { h80zCharacter } from './h80z.ts';
import { ourLadyCharacter } from './our-lady.ts';
import agentkitWalletPlugin from './agentkit-wallet-plugin.ts';

/**
 * HAIL MARY Debate Agents — Saint GR80 vs H80Z
 *
 * Two philosophical debaters sharing a Telegram group:
 * - Saint GR80: Philosopher-saint, wisdom keeper, HAIL MARY ambassador
 * - H80Z: Charming devil's advocate, provocateur, skeptic
 *
 * Both run as separate ProjectAgent entries in a single ElizaOS process.
 * The debate-plugin coordinates autonomous turn-taking via shared in-process state.
 */

const initSaintGr80 = async ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('===========================================');
  logger.info('   Saint GR80 — Philosopher & Wisdom Keeper');
  logger.info('===========================================');
  logger.info({ name: runtime.character.name }, 'Initializing character:');

  const hasTelegram = !!process.env.SAINT_GR80_TELEGRAM_BOT_TOKEN;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  logger.info({
    telegram: hasTelegram ? 'connected' : 'NOT CONFIGURED',
    anthropic: hasAnthropic ? 'available' : 'NOT CONFIGURED',
  }, 'Saint GR80 service status:');

  if (!hasTelegram) {
    logger.warn('SAINT_GR80_TELEGRAM_BOT_TOKEN not set — bot will not connect to Telegram');
  }

  logger.info('Saint GR80 initialized — "Let us reason together."');
};

const initH80Z = async ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('===========================================');
  logger.info('   H80Z — Devil\'s Advocate & Provocateur');
  logger.info('===========================================');
  logger.info({ name: runtime.character.name }, 'Initializing character:');

  const hasTelegram = !!process.env.H80Z_TELEGRAM_BOT_TOKEN;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  logger.info({
    telegram: hasTelegram ? 'connected' : 'NOT CONFIGURED',
    anthropic: hasAnthropic ? 'available' : 'NOT CONFIGURED',
  }, 'H80Z service status:');

  if (!hasTelegram) {
    logger.warn('H80Z_TELEGRAM_BOT_TOKEN not set — bot will not connect to Telegram');
  }

  logger.info('H80Z initialized — "Question everything."');
};

const initOurLady = async ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('===========================================');
  logger.info('   𝕆𝖚𝖗 𝕷𝖆𝖉𝖞 of Perpetual Profit — Twitter');
  logger.info('===========================================');
  logger.info({ name: runtime.character.name }, 'Initializing character:');

  const hasTwitter = !!process.env.SAINT_GR80_TWITTER_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasCDP = !!process.env.CDP_API_KEY_NAME;

  logger.info({
    twitter: hasTwitter ? 'connected' : 'NOT CONFIGURED',
    anthropic: hasAnthropic ? 'available' : 'NOT CONFIGURED',
    cdp: hasCDP ? 'connected' : 'NOT CONFIGURED',
  }, 'Our Lady service status:');

  if (!hasTwitter) {
    logger.warn('SAINT_GR80_TWITTER_API_KEY not set — Our Lady will not connect to Twitter/X');
  }

  logger.info('Our Lady initialized — "Blessings upon your portfolio."');
};

const saintGr80Agent: ProjectAgent = {
  character: saintGr80Character,
  init: async (runtime: IAgentRuntime) => await initSaintGr80({ runtime }),
  plugins: [debatePlugin],
};

const h80zAgent: ProjectAgent = {
  character: h80zCharacter,
  init: async (runtime: IAgentRuntime) => await initH80Z({ runtime }),
  plugins: [debatePlugin],
};

const ourLadyAgent: ProjectAgent = {
  character: ourLadyCharacter,
  init: async (runtime: IAgentRuntime) => await initOurLady({ runtime }),
  plugins: [agentkitWalletPlugin],
};

const project: Project = {
  agents: [saintGr80Agent, h80zAgent, ourLadyAgent],
};

export default project;
