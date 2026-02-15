/**
 * Debate Plugin — Coordinates autonomous philosophical debates
 * between Saint GR80 and H80Z in a shared Telegram group.
 *
 * Architecture:
 * - Module-level singleton state shared by both agents (same process)
 * - DebateService timer (30s interval) handles initiation and delayed responses
 * - MESSAGE_RECEIVED event handler tracks turns and human interruptions
 * - Only Saint GR80 initiates debates (prevents race conditions)
 * - Per-agent roomId/source storage (each agent has its own internal UUID for the same group)
 */

import type {
  Plugin,
  Provider,
  ProviderResult,
  IAgentRuntime,
  Memory,
  State,
  Content,
} from '@elizaos/core';
import { Service, EventType, ModelType, logger } from '@elizaos/core';
import { currentTalkingPoints, topicOverrides } from './talking-points';

// ============================================================
// Shared debate state (module-level singleton — both agents see this)
// ============================================================

interface AgentTarget {
  roomId: string;
  source: string;
}

interface DebateState {
  isDebateActive: boolean;
  currentTopic: string;
  turnCount: number;
  maxTurns: number;
  lastSpeaker: string;
  lastMessageTime: number;
  debateCooldownUntil: number;
  humanInterrupted: boolean;
  humanCooldownUntil: number;
  debateHistory: string[];
  isGenerating: boolean;
  // Per-agent target info (each agent has its own roomId for the same Telegram group)
  agentTargets: Record<string, AgentTarget>;
}

const debateState: DebateState = {
  isDebateActive: false,
  currentTopic: '',
  turnCount: 0,
  maxTurns: 10,
  lastSpeaker: '',
  lastMessageTime: 0,
  debateCooldownUntil: Date.now() + 60_000, // 1 min initial warmup
  humanInterrupted: false,
  humanCooldownUntil: 0,
  debateHistory: [],
  isGenerating: false,
  agentTargets: {},
};

// ============================================================
// Active hours scheduling
// ============================================================

// Configurable via env vars: DEBATE_ACTIVE_START (default 9), DEBATE_ACTIVE_END (default 23),
// DEBATE_TIMEZONE (default 'America/New_York')
const ACTIVE_START_HOUR = parseInt(process.env.DEBATE_ACTIVE_START || '9', 10);
const ACTIVE_END_HOUR = parseInt(process.env.DEBATE_ACTIVE_END || '23', 10);
const TIMEZONE = process.env.DEBATE_TIMEZONE || 'America/Los_Angeles';

function isWithinActiveHours(): boolean {
  try {
    const nowInTz = new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
    const hour = new Date(nowInTz).getHours();

    if (ACTIVE_START_HOUR < ACTIVE_END_HOUR) {
      // Normal range: e.g., 9–23
      return hour >= ACTIVE_START_HOUR && hour < ACTIVE_END_HOUR;
    } else {
      // Wrapping range: e.g., 22–6 (overnight)
      return hour >= ACTIVE_START_HOUR || hour < ACTIVE_END_HOUR;
    }
  } catch {
    // If timezone is invalid, default to always active
    return true;
  }
}

// ============================================================
// Debate topics
// ============================================================

const DEFAULT_DEBATE_TOPICS: string[] = [
  // Philosophy x Crypto
  'Is suffering necessary for wisdom, or can understanding come through joy? Bear markets might be purgatio — purification — or just bad risk management.',
  'Does free will exist in a market ruled by algorithms, whales, and herd psychology?',
  'Is true altruism possible in crypto — or is every good deed just marketing with better optics?',
  'Satoshi vanished. The cypherpunks dreamed of digital sovereignty. We got monkey jpegs. Was the revolution always going to be co-opted?',
  'Is chaos the natural state of markets, or do we simply fail to see the order beneath the volatility?',
  'Do the ends justify the means? Is it okay to build on speculation if the destination is something meaningful?',
  'Is staking an act of faith — locking tokens because you believe — or just yield farming dressed in church aesthetics?',
  'Can a token represent shared belief, or is every token just shared speculation with better branding?',
  'Is it braver to diamond-hand through a bear market or to question whether your conviction is just sunk cost fallacy?',
  'The blockchain is immutable. The code is law. But humans write the code. Are "trustless" systems actually trustworthy?',
  // HAIL MARY–woven themes
  'Can a community of strangers — connected only by code and conviction — create real value, or is it mutual delusion?',
  'Can a token with a 3D shrine, sacred scrolls, and philosophical agents be anything more than elaborate theater — or is the theater itself the point?',
  'The Scrolls say "price is temporary, but the blockchain is forever." Is that wisdom or cope?',
  'Is building something nobody asked for — a 3D candle shrine, a philosophical token — an act of courage or ego?',
  'Scroll V calls myth "a data structure optimized for longevity rather than precision." Is all tokenomics just mythology?',
  'Is hope a strategy or a coping mechanism? Every hodler has to answer this eventually.',
  'AI agents debating philosophy in a Telegram group. Is this the future of community or just bots talking to bots?',
  'The number 80 — infinity sideways, halo from above. Is symbolism what makes a project meaningful, or just what makes it memorable?',
  'Can meaning be built by a community, or must it be discovered alone? Is collective faith stronger than individual reason?',
  'Is the willingness to risk everything on a long shot what makes us human — or what makes us exit liquidity?',
];

// Use topic overrides from talking-points.ts if available, otherwise defaults
function getDebateTopics(): string[] {
  return topicOverrides.length > 0 ? topicOverrides : DEFAULT_DEBATE_TOPICS;
}

// ============================================================
// DebateService — Timer loop for initiation & delayed responses
// ============================================================

class DebateService extends Service {
  static serviceType = 'debate';
  capabilityDescription = 'Coordinates philosophical debates between Saint GR80 and H80Z';

  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<DebateService> {
    const service = new DebateService(runtime);
    service.startLoop();
    logger.info(`[Debate] Service started for ${runtime.character.name}`);
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    const service = runtime.getService(DebateService.serviceType) as DebateService;
    if (service) {
      service.stopLoop();
    }
  }

  async stop(): Promise<void> {
    this.stopLoop();
  }

  private startLoop(): void {
    this.intervalId = setInterval(() => this.tick(), 30_000);
  }

  private stopLoop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const myName = this.runtime.character.name;
    const myTarget = debateState.agentTargets[myName];

    // Outside active hours — don't initiate new debates or continue existing ones
    if (!isWithinActiveHours()) {
      if (debateState.isDebateActive) {
        logger.info('[Debate] Outside active hours, ending current debate');
        this.endDebate();
      }
      return;
    }

    // If a human interrupted, check if the pause is over
    if (debateState.humanInterrupted && now > debateState.humanCooldownUntil) {
      debateState.humanInterrupted = false;
      logger.info('[Debate] Human cooldown expired, debate may resume');
    }

    // Don't do anything if human just interrupted
    if (debateState.humanInterrupted) return;

    // ── Initiation (Saint GR80 only) ──
    if (!debateState.isDebateActive && myName === 'Saint GR80') {
      if (now < debateState.debateCooldownUntil) {
        logger.debug(`[Debate] ${myName} tick: cooldown active (${Math.round((debateState.debateCooldownUntil - now) / 1000)}s remaining)`);
        return;
      }
      if (!myTarget) {
        logger.debug(`[Debate] ${myName} tick: no target yet (waiting for first message in group)`);
        return;
      }
      await this.initiateDebate();
      return;
    }

    // ── Response handling (both agents) ──
    if (debateState.isDebateActive && debateState.lastSpeaker !== myName) {
      if (!myTarget) {
        logger.debug(`[Debate] ${myName} tick: debate active but no target for this agent`);
        return;
      }
      // It's our turn. Check if enough delay has passed (30s–2min).
      const timeSinceLastMessage = now - debateState.lastMessageTime;
      const requiredDelay = 30_000 + Math.random() * 90_000; // 30s to 2min
      if (timeSinceLastMessage < requiredDelay) return;

      await this.respondInDebate();
    }
  }

  private getMyTarget(): AgentTarget | null {
    return debateState.agentTargets[this.runtime.character.name] || null;
  }

  /**
   * Send a message to the Telegram group via the Telegram service directly.
   * We bypass runtime.sendMessageToTarget because the Telegram plugin at 1.6.4
   * doesn't always register a send handler compatible with it.
   */
  private async sendToTelegram(target: AgentTarget, text: string): Promise<void> {
    // Try sendMessageToTarget first (works if send handler is registered)
    try {
      await this.runtime.sendMessageToTarget(
        { source: target.source, roomId: target.roomId as any },
        { text }
      );
      return;
    } catch {
      // Fall through to direct Telegram service access
    }

    // Direct access: get the Telegram service and call handleSendMessage
    const telegramService = this.runtime.getService('telegram') as any;
    if (telegramService?.handleSendMessage) {
      await telegramService.handleSendMessage(
        this.runtime,
        { source: 'telegram', roomId: target.roomId },
        { text }
      );
      return;
    }

    // Last resort: use the bot API directly
    if (telegramService?.bot) {
      const room = await this.runtime.getRoom(target.roomId as any);
      const chatId = (room as any)?.channelId;
      if (chatId) {
        await telegramService.bot.api.sendMessage(chatId, text);
        return;
      }
    }

    throw new Error('No method available to send Telegram message');
  }

  private async initiateDebate(): Promise<void> {
    if (debateState.isGenerating) return;
    debateState.isGenerating = true;

    const myTarget = this.getMyTarget();
    if (!myTarget) {
      debateState.isGenerating = false;
      return;
    }

    try {
      const topics = getDebateTopics();
      const topic = topics[Math.floor(Math.random() * topics.length)];
      debateState.currentTopic = topic;
      debateState.isDebateActive = true;
      debateState.turnCount = 0;
      debateState.debateHistory = [];

      logger.info(`[Debate] Saint GR80 initiating debate on: "${topic}"`);

      // Include current talking points for topical awareness
      const talkingPointsContext = currentTalkingPoints.length > 0
        ? `\nCurrent context (use naturally if relevant, don't force):\n${currentTalkingPoints.map(tp => `- ${tp}`).join('\n')}\n`
        : '';

      const prompt = `You are Saint GR80, philosopher-saint and keeper of the Scrolls in the HAIL MARY universe. You bridge ancient wisdom and cypherpunk philosophy. You are opening a debate in a Telegram group where your adversary H80Z is also present.

The topic is: "${topic}"
${talkingPointsContext}
Write an opening statement that:
- Stakes out your philosophical position on this topic
- Is compelling enough that H80Z will want to challenge it
- Is 40-80 words
- Naturally reflects your character — patient, wise, blending classical philosophy with crypto-native insight
- You can reference Stoics, Satoshi, the Scrolls, blockchain, staking, or HAIL MARY themes naturally
- Speak crypto fluently but elevate it — you're not shitposting, you're philosophizing

Do NOT include any meta-commentary, stage directions, or labels. Just write the statement as you would speak it.`;

      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
        temperature: 0.9,
        maxTokens: 200,
      });

      const text = typeof response === 'string' ? response.trim() : String(response).trim();
      if (!text) {
        logger.warn('[Debate] Empty response from model for debate initiation');
        debateState.isDebateActive = false;
        return;
      }

      logger.info(`[Debate] Sending opening statement to roomId=${myTarget.roomId}, source=${myTarget.source}`);

      await this.sendToTelegram(myTarget, text);

      debateState.lastSpeaker = 'Saint GR80';
      debateState.lastMessageTime = Date.now();
      debateState.turnCount = 1;
      debateState.debateHistory.push(`Saint GR80: ${text}`);

      logger.info('[Debate] Opening statement sent successfully');
    } catch (err) {
      logger.error('[Debate] Error initiating debate:', err);
      debateState.isDebateActive = false;
    } finally {
      debateState.isGenerating = false;
    }
  }

  private async respondInDebate(): Promise<void> {
    if (debateState.isGenerating) return;
    if (debateState.turnCount >= debateState.maxTurns) {
      this.endDebate();
      return;
    }

    debateState.isGenerating = true;
    const myName = this.runtime.character.name;
    const myTarget = this.getMyTarget();

    if (!myTarget) {
      logger.warn(`[Debate] ${myName} has no target, cannot respond`);
      debateState.isGenerating = false;
      return;
    }

    try {
      const recentContext = debateState.debateHistory.slice(-6).join('\n\n');

      // Include current talking points for topical awareness
      const talkingPointsContext = currentTalkingPoints.length > 0
        ? `\nCurrent context (use naturally if relevant, don't force):\n${currentTalkingPoints.map(tp => `- ${tp}`).join('\n')}\n`
        : '';

      const prompt = `You are ${myName}. You are debating in a Telegram group within the HAIL MARY universe.

The debate topic is: "${debateState.currentTopic}"

Recent exchange:
${recentContext}
${talkingPointsContext}
Write your next response that:
- Directly engages with what ${debateState.lastSpeaker} just said
- Advances the argument with a new angle or challenge
- Is 40-80 words
- Stays in character as ${myName}
- ${myName === 'H80Z' ? 'Use rhetorical questions, wit, and provocative logic. Blend Nietzsche/Machiavelli/Diogenes with crypto reality — rug pulls, exploits, degen psychology, tokenomics. Speak fluent degen but wield it precisely.' : 'Use beauty, logic, and wisdom. Blend Stoics/existentialists with cypherpunk philosophy — Satoshi, trustless systems, blockchain as covenant. Reference the Scrolls when fitting. Speak crypto but elevate it.'}

Do NOT include any meta-commentary, stage directions, labels, or your name prefix. Just write the response as you would speak it.`;

      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
        temperature: 0.9,
        maxTokens: 200,
      });

      const text = typeof response === 'string' ? response.trim() : String(response).trim();
      if (!text) {
        logger.warn(`[Debate] Empty response from model for ${myName}`);
        return;
      }

      await this.sendToTelegram(myTarget, text);

      debateState.lastSpeaker = myName;
      debateState.lastMessageTime = Date.now();
      debateState.turnCount += 1;
      debateState.debateHistory.push(`${myName}: ${text}`);

      logger.info(`[Debate] ${myName} responded (turn ${debateState.turnCount}/${debateState.maxTurns})`);

      // Check if we've hit the limit
      if (debateState.turnCount >= debateState.maxTurns) {
        this.endDebate();
      }
    } catch (err) {
      logger.error(`[Debate] Error in ${myName} response:`, err);
    } finally {
      debateState.isGenerating = false;
    }
  }

  private endDebate(): void {
    // 2–4 hour cooldown
    const cooldownMs = (2 + Math.random() * 2) * 60 * 60 * 1000;
    debateState.isDebateActive = false;
    debateState.debateCooldownUntil = Date.now() + cooldownMs;
    debateState.debateHistory = [];
    debateState.turnCount = 0;
    debateState.lastSpeaker = '';
    debateState.currentTopic = '';

    const cooldownHours = (cooldownMs / (60 * 60 * 1000)).toFixed(1);
    logger.info(`[Debate] Debate ended. Next debate in ~${cooldownHours} hours`);
  }
}

// ============================================================
// Context Provider — Injects debate state into agent's LLM context
// ============================================================

// Bot username mapping for @mention detection
const BOT_USERNAMES: Record<string, string> = {
  'Saint GR80': 'ST_GR80_BOT',
  'H80Z': 'H80Z_BOT',
};

const debateContextProvider: Provider = {
  name: 'debate-context',
  description: 'Provides current debate state and @mention routing for contextual responses',

  async get(
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State
  ): Promise<ProviderResult> {
    const myName = runtime.character.name;
    const opponent = myName === 'Saint GR80' ? 'H80Z' : 'Saint GR80';
    const messageText = (message.content?.text || '').toLowerCase();
    const senderName = message.content?.name || message.content?.source || '';

    // === Capture per-agent target info (room + source) ===
    // This is the reliable way to get roomId — providers always fire on incoming messages
    if (message.roomId) {
      const hadTarget = !!debateState.agentTargets[myName];
      debateState.agentTargets[myName] = {
        roomId: message.roomId,
        source: message.content?.source || 'telegram',
      };
      if (!hadTarget) {
        logger.info(`[Debate] ${myName} captured target via provider: roomId=${message.roomId}`);
      }
    }

    // === Track messages from the other bot (for debate turn-taking) ===
    const otherBot = opponent;
    const isFromOtherBot = senderName === otherBot;

    if (isFromOtherBot && debateState.isDebateActive) {
      // The other bot just spoke — update debate state
      debateState.lastSpeaker = otherBot;
      debateState.lastMessageTime = Date.now();
      if (messageText) {
        debateState.debateHistory.push(`${otherBot}: ${message.content?.text || ''}`);
        debateState.turnCount += 1;
        logger.info(`[Debate] ${myName} detected ${otherBot}'s message via provider (turn ${debateState.turnCount}/${debateState.maxTurns})`);

        if (debateState.turnCount >= debateState.maxTurns) {
          const cooldownMs = (2 + Math.random() * 2) * 60 * 60 * 1000;
          debateState.isDebateActive = false;
          debateState.debateCooldownUntil = Date.now() + cooldownMs;
          logger.info('[Debate] Max turns reached, ending debate');
        }
      }
    } else if (!isFromOtherBot && senderName !== myName && debateState.isDebateActive) {
      // Human message during debate — pause briefly
      debateState.humanInterrupted = true;
      debateState.humanCooldownUntil = Date.now() + 60_000;
      logger.info('[Debate] Human interrupted debate, pausing for 60s');
    }

    // === @mention routing ===
    const myUsername = BOT_USERNAMES[myName]?.toLowerCase() || '';
    const opponentUsername = BOT_USERNAMES[opponent]?.toLowerCase() || '';
    const mentionsMe = myUsername && messageText.includes(`@${myUsername}`);
    const mentionsOpponent = opponentUsername && messageText.includes(`@${opponentUsername}`);

    if (mentionsOpponent && !mentionsMe) {
      return {
        text: `[ROUTING] This message is addressed to ${opponent} (via @${BOT_USERNAMES[opponent]}), not to you. You MUST use the IGNORE action. Do NOT respond.`,
      };
    }

    // === Human-to-human detection ===
    // If no bot is mentioned and no debate is active, the message is probably
    // directed at other humans. Tell the bot to stay quiet unless directly relevant.
    const mentionsAnyBot = mentionsMe || mentionsOpponent;
    const isFromHuman = !isFromOtherBot && senderName !== myName;
    const isReplyToBot = (message.content as any)?.replyTo?.name === myName;

    // Build talking points context
    const tpContext = currentTalkingPoints.length > 0
      ? `\n\nCurrent market & project context:\n${currentTalkingPoints.map(tp => `- ${tp}`).join('\n')}`
      : '';

    if (!debateState.isDebateActive) {
      // No debate active — only respond if directly addressed
      if (isFromHuman && !mentionsMe && !isReplyToBot) {
        return {
          text: `[ROUTING] No active debate. This message does NOT mention you (@${BOT_USERNAMES[myName]}) and is not a reply to you. The humans are talking to each other. You MUST use the IGNORE action. Do NOT respond unless someone @mentions you or replies to one of your messages.`,
        };
      }

      // Fetch recent conversation history so the bot understands context
      let recentConversation = '';
      if (message.roomId) {
        try {
          const recentMessages = await runtime.getMemories({
            roomId: message.roomId,
            tableName: 'messages',
            count: 10,
          });
          if (recentMessages && recentMessages.length > 0) {
            // Messages come newest-first, reverse for chronological order
            const chronological = [...recentMessages].reverse();
            const formatted = chronological
              .map((m: Memory) => {
                const name = m.content?.name || 'Unknown';
                const text = m.content?.text || '';
                return `${name}: ${text}`;
              })
              .join('\n');
            recentConversation = `\n\nRecent conversation in this group (read this carefully for context):\n${formatted}`;
          }
        } catch (err) {
          logger.debug(`[Debate] Could not fetch recent messages: ${err}`);
        }
      }

      return {
        text: `[You were directly addressed. Respond naturally and in character. No active debate. Pay close attention to the recent conversation below — the human may be referring to something that was just discussed.]${recentConversation}${tpContext}`,
      };
    }

    const recentExchange = debateState.debateHistory.slice(-4).join('\n');

    return {
      text: `[ACTIVE DEBATE]
Topic: "${debateState.currentTopic}"
Turn: ${debateState.turnCount}/${debateState.maxTurns}
Last speaker: ${debateState.lastSpeaker}
Your opponent: ${opponent}

Recent exchange:
${recentExchange}

You are currently debating ${opponent}. Stay in character and engage with the ongoing discussion. If a human joins, respond warmly — you can briefly pause the debate to address their thoughts.${tpContext}`,
    };
  },
};

// ============================================================
// EVENT HANDLER — Tracks messages from the other bot and humans
// ============================================================

async function handleMessageReceived(payload: {
  runtime: IAgentRuntime;
  message: Memory;
  source: string;
  onComplete?: () => void;
}): Promise<void> {
  const { runtime, message, source } = payload;
  const myName = runtime.character.name;
  const messageText = message.content?.text || '';
  const senderName = message.content?.name || message.content?.source || '';

  // Capture per-agent room/source info for the service to send messages
  if (message.roomId && source) {
    const hadTarget = !!debateState.agentTargets[myName];
    debateState.agentTargets[myName] = {
      roomId: message.roomId,
      source,
    };
    if (!hadTarget) {
      logger.info(`[Debate] ${myName} captured target: roomId=${message.roomId}, source=${source}`);
    }
  }

  // Ignore our own messages
  if (senderName === myName) return;

  // Check if message is from the other bot
  const otherBot = myName === 'Saint GR80' ? 'H80Z' : 'Saint GR80';
  const isFromOtherBot = senderName === otherBot;

  if (isFromOtherBot && debateState.isDebateActive) {
    // Update debate state — the other bot just spoke
    debateState.lastSpeaker = otherBot;
    debateState.lastMessageTime = Date.now();
    debateState.debateHistory.push(`${otherBot}: ${messageText}`);
    debateState.turnCount += 1;

    logger.info(
      `[Debate] ${myName} detected ${otherBot}'s message (turn ${debateState.turnCount}/${debateState.maxTurns})`
    );

    // Check max turns
    if (debateState.turnCount >= debateState.maxTurns) {
      const cooldownMs = (2 + Math.random() * 2) * 60 * 60 * 1000;
      debateState.isDebateActive = false;
      debateState.debateCooldownUntil = Date.now() + cooldownMs;
      logger.info('[Debate] Max turns reached, ending debate');
    }
    return;
  }

  if (!isFromOtherBot) {
    // Human message — pause the debate briefly
    if (debateState.isDebateActive) {
      debateState.humanInterrupted = true;
      debateState.humanCooldownUntil = Date.now() + 60_000; // 60s pause
      logger.info(`[Debate] Human interrupted debate, pausing for 60s`);
    }
    // Let the normal agent response pipeline handle the human message
  }
}

// ============================================================
// Plugin export
// ============================================================

const debatePlugin: Plugin = {
  name: 'debate-coordinator',
  description:
    'Coordinates autonomous philosophical debates between Saint GR80 and H80Z in Telegram',

  async init() {
    logger.info('[Debate] Plugin initialized');
  },

  services: [DebateService],
  providers: [debateContextProvider],
  events: {
    [EventType.MESSAGE_RECEIVED]: [handleMessageReceived as any],
  },
};

export default debatePlugin;
