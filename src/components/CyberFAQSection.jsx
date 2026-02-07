'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import SkewedHeading from '@/components/SkewedHeading';

export default function CyberFAQSection({ isMobile = false }) {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { threshold: 0.3 });
  const [activeQuery, setActiveQuery] = useState(null);
  const [activeSubQuery, setActiveSubQuery] = useState({});
  const [typedText, setTypedText] = useState('');
  const [subTypedText, setSubTypedText] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [isSubTyping, setIsSubTyping] = useState({});
  const [scanlinePos, setScanlinePos] = useState(0);
  const [sessionId, setSessionId] = useState('LOADING');

  // Track which sections have already been animated (show instantly on re-open)
  const [animatedQueries, setAnimatedQueries] = useState({});
  const [animatedSubQueries, setAnimatedSubQueries] = useState({});

  // Refs to store interval IDs for proper cleanup
  const typewriterIntervalRef = useRef(null);
  const subTypewriterIntervalsRef = useRef({});

  // Helper function to render text with clickable links
  const renderTextWithLinks = (text) => {
    if (!text) return null;

    // URL regex pattern
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlPattern);

    return parts.map((part, index) => {
      if (part.match(urlPattern)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: '#00ffff',
              textDecoration: 'underline',
              wordBreak: 'break-all',
              cursor: 'pointer'
            }}
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // FAQ data with terminal-style queries
  const faqData = [
    {
      id: 'QUERY_000',
      command: '> QUERY: Crypto.Ethics',
      title: 'Is Crypto Evil?',
      response: ` ACCESSING MORAL FRAMEWORK...

No.

Crypto is a tool — and like any tool, it reflects the intent of the people using it.

Speculation, scams, and hype cycles make headlines, but those are human failures, not protocol failures. We don't call email evil because of spam, or the internet evil because of fraud. We improve the systems and keep building.

At its core, cryptocurrency began with Bitcoin as a simple idea:
money that doesn't require permission, middlemen, or blind trust.

Open ledgers. Verifiable rules. Math instead of promises.

Platforms like Ethereum extended that idea — allowing code to handle savings, trading, and coordination transparently, where anyone can audit the logic.

That's not corruption.
That's accountability.

Markets rise and fall. Narratives sour. Bears arrive.
But the principles remain:
\t•\tself-custody
\t•\topen access
\t•\tcensorship resistance
\t•\tprogrammable fairness

Crypto isn't a religion or a casino.
It's infrastructure.

And like all infrastructure, it quietly becomes useful long before it becomes popular.

RL80 builds on that quieter layer — not hype, not promises, just mechanisms that run exactly as written.

Trust less. Verify more. Light a candle if you like.
`,
      status: '[ETHICS.RESOLVED]',
      subQuestions: []
    },
    {
      id: 'QUERY_001',
      command: '> QUERY: Token.Information',
      title: 'What is RL80"?',
      response: ` ACCESSING DATABASE... 
      
RL80 is the on-chain expression of Our Lady of Perpetual Profit — a watcher of markets and protector of portfolios across centuries, now instantiated in code.
It uses transparent mechanics, community participation, and creative presentation to explore how trust, incentives, and belief systems shape financial behavior.

`,
      status: '[DATA.RETRIEVED]',
      subQuestions: [
        {
          id: 'SUB_001_A',
          command: '>> SUB.QUERY: Utility.Details',
          title: 'What can I do with RL80?',
          response: `LOADING UTILITY MODULE...

You can simply hold RL80, or you can actively engage with its features.
Nothing is required, and no action is framed as an obligation. The system is designed so that meaning and utility emerge from how the community chooses to participate.
Depending on how you choose to engage, RL80 allows you to:
	•	Hold as a long-term signal of alignment
	•	Stake to participate in rewards
	•	Burn tokens for symbolic acts of sacrifice and deflationary impact, or to earn Illumin80 status. 

`,
          status: '[UTILITY.LOADED]'
        },
        {
          id: 'SUB_001_B',
          command: '>> SUB.QUERY: Memetic.value',
          title: 'IS RL80 a meme token?',
          response: `FETCHING META NARRATIVE...

          While RL80 embraces humor, myth, and iconography, the project prioritizes interaction, longevity, and system behavior over attention cycles.

          RL80 offers what might be called 'light utility'.
          Its ritual burning mechanism and visible acts of participation add light to a shared digital shrine—small gestures of intention made within a system that, like markets themselves, often feels unseen, impersonal, and beyond individual control.`,
          status: '[NARRATIVE.DEFINED]'
        },
        {
          id: 'SUB_001_C',
          command: '>> SUB.QUERY: BURN.Mechanism',
          title: 'Why would I burn RL80 tokens?',
          response: `ANALYZING BURN MECHANISM...

      Burning is the primary utility of RL80.

      It serves as a way to clarify intention through action. Any amount may be burned—participation is intentionally accessible, inexpensive, and voluntary. What matters is not scale, but presence.

      The act parallels traditional candle votives offered to the Virgin Mary: a small, personal gesture made visible within a shared space. In RL80, each burn adds light to the shrine.

      Every burn permanently reduces the fixed token supply, thus increasing token value. In doing so, an offering becomes a universal goodwill gesture—one that strengthens the system for all participants rather than extracting value from others.

      On the Illumin80 page, the total number of candles burning and tokens burned to date form a living display of collective engagement—a quiet, real-time signal of sentiment, conviction, and attention over time.
`,
          status: '[MECHANISM.ANALYZED]'
        },
        {
          id: 'SUB_001_D',
          command: '>> SUB.QUERY: Purchase.Protocol',
          title: 'How do I buy RL80?',
          response: `LOADING ACQUISITION PROTOCOLS...

RL80 is available on the Base network. There are several ways to acquire it:

OPTION 1: BUY WITH CREDIT/DEBIT CARD (Easiest)
• Use our built-in purchase widget on the site
• Pay with credit card, debit card, or bank transfer
• No existing crypto or wallet required
• A non-custodial wallet is automatically created for you
• Tokens are delivered directly to your new wallet
• You'll receive instructions to access and secure your wallet

OPTION 2: SWAP ETH FOR RL80
• If you already have ETH, use our swap feature
• Connect your existing wallet (MetaMask, Coinbase, etc.)
• Swap ETH for RL80 directly on the site

OPTION 3: BUY VIA UNISWAP
• For experienced users with existing wallets
• Go to Uniswap and connect to Base network
• Search for RL80 or paste the contract address
• Swap ETH or other tokens for RL80

CONTRACT ADDRESS (Base):
[Contract address will be displayed here - verify before transacting]

IMPORTANT: Always verify you have the correct token contract to avoid scams.
`,
          status: '[ACQUISITION.READY]'
        }
      ]
    },
    {
      id: 'QUERY_002',
      command: '> QUERY: Contract.Overview',
      title: 'How RL80 Works (Plain-English Contract Overview)',
      response: ` LOADING CONTRACT ARCHITECTURE...

RL80 is powered by three simple on-chain contracts.
Each has one job only, keeping responsibilities separated for safety and transparency.

No hidden minting.
No backdoors.
No custody of your funds.

Just math and code.
`,
      status: '[CONTRACTS.VERIFIED]',
      subQuestions: [
        {
          id: 'SUB_002_A',
          command: '>> SUB.QUERY: Token.Contract',
          title: 'The Token — RL80',
          response: `LOADING TOKEN SPECIFICATIONS...

WHAT IT DOES:
RL80 is a standard ERC-20 token with a small trading fee that funds the ecosystem.

KEY BEHAVIORS:
• ✅ Capped supply — 80 billion tokens
• ✅ No minting after launch
• ✅ No blacklist or freeze functions
• ✅ Wallet-to-wallet transfers have 0% fee
• ✅ Only buys and sells through the liquidity pool pay a small fee (≈4%)

WHY THERE'S A FEE:
The fee supports:
• Liquidity growth
• Staking rewards
• Marketing & operations

This keeps the project sustainable without selling treasury tokens.

LAUNCH PROTECTION:
At launch, sell fees are temporarily higher and decay over the first hour to discourage bots and snipers.

After that → normal fees.
`,
          status: '[TOKEN.VERIFIED]'
        },
        {
          id: 'SUB_002_B',
          command: '>> SUB.QUERY: Staking.Contract',
          title: 'Staking — RL80Staking',
          response: `LOADING STAKING ARCHITECTURE...

WHAT IT DOES:
Lets holders stake RL80 and earn ETH rewards collected from trading fees.

HOW IT WORKS:
1. Stake RL80
2. Wait 7 days (lock period)
3. Earn ETH rewards over time
4. Claim anytime after the lock

IMPORTANT DETAILS:
• ✅ You always keep custody of your tokens (no third-party risk)
• ✅ Rewards are distributed fairly based on stake size
• ✅ Rewards are streamed continuously (not lottery style)
• ✅ Emergency unstake available if the contract is paused
• ✅ No staking fees

WHERE REWARDS COME FROM:
Trading fees → swapped to ETH → sent to the staking contract for distribution to stakers.

No inflation or token printing.
Rewards come from actual trading activity, not from issuing new tokens to pay existing holders.

Rewards vary with trading activity — higher volume generates more rewards, while quieter markets generate less.`,
          status: '[STAKING.VERIFIED]'
        },
        {
          id: 'SUB_002_C',
          command: '>> SUB.QUERY: Splitter.Contract',
          title: 'Fee Splitter — RewardsSplitter',
          response: `LOADING SPLITTER MECHANICS...

WHAT IT DOES:
Converts collected fees into ETH and distributes them.

FLOW:
Trading fees → swap to ETH → splits between:
• Treasury
• Stakers
• Marketing

SAFETY FEATURES:
• ✅ Cannot custody user funds
• ✅ Distribution percentages are transparent
• ✅ Fails gracefully (one recipient can't block others)
• ✅ No manual "trust me" transfers
• ✅ Configuration can be permanently locked once stable, removing administrative changes
• ✅ Execution is automated and becomes permissionless if swaps are not triggered

This means funds move by rules, not promises.
`,
          status: '[SPLITTER.VERIFIED]'
        },
        {
          id: 'SUB_002_D',
          command: '>> SUB.QUERY: Design.Philosophy',
          title: 'Design Philosophy',
          response: `LOADING CORE PRINCIPLES...

RL80 follows three principles:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. SEPARATION OF POWERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Token handles transfers
• Staking handles rewards
• Splitter handles fees

No single contract controls everything.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. MINIMAL TRUST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• No admin can mint
• No admin can seize wallets
• No hidden upgradeability
• Core behavior is deterministic

Admins only manage configuration (fees, shares, etc.), not your funds.


Administrative permissions exist only for operational configuration
during early stages (fee routing, swap thresholds, exchange integration).
These permissions cannot mint tokens, seize wallets, or withdraw user funds.

As the ecosystem stabilizes, configuration can be permanently locked
and administrative control minimized.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. TRANSPARENCY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Everything happens on-chain:
• Rewards
• Swaps
• Treasury funding
• Staking balances

Anyone can verify in a block explorer.
Execution can be triggered by anyone if automation fails, ensuring distribution cannot be blocked.
Operational controls exist to maintain stability during early operation,
not to change outcomes or override the rules enforced by the contracts.
`,
          status: '[PHILOSOPHY.DEFINED]'
        },
        {
          id: 'SUB_002_E',
          command: '>> SUB.QUERY: What.NOT',
          title: 'What RL80 Does NOT Do',
          response: `LOADING SECURITY GUARANTEES...

For clarity:

❌ No minting after launch
❌ No wallet freezing
❌ No hidden taxes
❌ No "owner can drain funds" functions
❌ No staking rug mechanisms
❌ No custody of your assets

If you hold RL80 in your wallet, it's yours.
`,
          status: '[GUARANTEES.CONFIRMED]'
        },
        {
          id: 'SUB_002_F',
          command: '>> SUB.QUERY: Summary',
          title: 'Summary',
          response: `GENERATING SUMMARY...

RL80 is:
• A fixed-supply token
• With small trading fees
• That fund staking rewards and growth
• Enforced by open-source smart contracts, with no trust assumptions and execution triggered on-chain.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Simple. Predictable. Verifiable.

Rules are enforced by code.
Operations are guided by transparency.
Trust is minimized by design.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`,
          status: '[SUMMARY.COMPLETE]'
        }
      ]
    },
    {
      id: 'QUERY_003',
      command: '> QUERY: Special.Status',
      title: 'What is The Illumin80?',
      response: ` LOADING LUMINARY MODULE...

The Illumin80 is anyone who lights a candle on the shrine. By burning RL80 tokens and offering a prayer, message, or intention, you become part of the Illumin80.

STAKING MULTIPLIER:
• The top 20% of cumulative token burners qualify for a 1.2x multiplier on staking rewards
• Evaluated monthly
• Multiplier applies for the following month
• Rankings may change as participation grows

`,
      status: '[REQUIREMENTS.LISTED]',
      subQuestions: [
        {
          id: 'SUB_003_A',
          command: '>> SUB.QUERY: Staking.Multiplier',
          title: 'What is the 1.2x staking multiplier?',
          response: `LOADING MULTIPLIER DETAILS...

The top 20% of cumulative token burners receive a 1.2x multiplier on all staking rewards.

EXAMPLE:
• Standard staker earns 100 ETH in rewards
• Top 20% burner earns 120 ETH for the same stake

HOW IT WORKS:
• Multiplier applies automatically when you rank in the top 20% of burners
• Rankings are evaluated monthly based on cumulative burn totals
• If you qualify this month, multiplier applies next month
• Multiplier stacks with your proportional stake — bigger stake + top 20% status = maximum rewards

This rewards long-term believers who demonstrate commitment through burning.
`,
          status: '[MULTIPLIER.ACTIVE]'
        },
        {
          id: 'SUB_003_B',
          command: '>> SUB.QUERY: Qualification',
          title: 'How do I qualify for the staking multiplier?',
          response: `LOADING QUALIFICATION CRITERIA...

STAKING MULTIPLIER QUALIFICATION:
• Anyone who lights a candle is Illumin80
• The top 20% of cumulative token burners earn a 1.2x staking multiplier
• Rankings are evaluated monthly
• Multiplier applies for the following month

IMPORTANT NOTES:
• It's cumulative — all your burns count toward your total
• Rankings may shift as more participants join
• You don't lose past burns, but others may catch up
• Check your ranking on the /illumin80 leaderboard

The threshold adjusts dynamically. As the community grows, you may need to burn more to maintain top 20% status.
`,
          status: '[QUALIFICATION.LOADED]'
        },
        {
          id: 'SUB_003_C',
          command: '>> SUB.QUERY: Burn.Protocol',
          title: 'How do I burn a candle?',
          response: `RETRIEVING INSTRUCTIONS...

To burn a candle, visit the /illumin80 page and simply click the button, fill out a quick form, and sign your digital wallet transaction.

Candles melt over 24 hours. When fully melted, they expire and are removed from the scene. Burn again to maintain your presence on the shrine and build toward Illumin80 status.
`,
          status: '[INSTRUCTIONS.LISTED]'
        }
      ]
    },
    {
      id: 'QUERY_004',
      command: '> QUERY: Rewards',
      title: 'Staking & Rewards',
      response: ` ACCESSING STAKING PROTOCOL...

Staking lets you deposit RL80 into the staking vault to participate in the system's reward stream. While staked, your tokens remain yours, but they are locked in the staking contract until your unlock period ends after 7 days from your last staking deposit.

RL80 uses a phased rollout for staking rewards. Staking is open from day one, but rewards activate progressively as the protocol matures.

`,
      status: '[TERMS.LOADED]',
      subQuestions: [
        {
          id: 'SUB_004_A',
          command: '>> SUB.QUERY: Phased.Rollout',
          title: 'How does the phased rewards system work?',
          response: `LOADING PHASE CONFIGURATION...

RL80 staking rewards are distributed according to a 4-phase rollout:

PHASE 1: LIQUIDITY BUILD (Current)
• Staking is OPEN — stake early to secure your position
• No rewards distributed yet
• All rewards accrued are queued for Phase 2
• Early stakers are first in line when rewards activate

PHASE 2: PILOT DIVIDENDS
• 1% of transaction tax flows to staking rewards
• Rewards paid in ETH
• Protocol begins testing reward distribution at scale

PHASE 3: STAKING DOMINANT
• 2% of transaction tax flows to staking rewards
• Full staking rewards activated
• Mature protocol stage

PHASE 4: ZERO TAX MODE (Optional)
• 0% transaction tax
• Protocol becomes self-sustaining
• Staking rewards cease; withdraw anytime

This phased approach ensures liquidity is established before rewards begin flowing, creating a more stable foundation for long-term stakers.
`,
          status: '[PHASES.LOADED]'
        },
        {
          id: 'SUB_004_B',
          command: '>> SUB.QUERY: APY.Current',
          title: 'What are the current staking returns?',
          response: `CALCULATING ...

RL80 staking does not offer a fixed or guaranteed rate of return.

CURRENT STATUS: Phase 1 (Pre-Rewards)
• Staking is open, but rewards have not yet activated
• Stake now to secure your position for Phase 2

WHEN REWARDS ACTIVATE (Phase 2+):
Rewards are paid in ETH and depend on how much ETH is routed into the staking contract from the RL80 tax infrastructure. The amount you earn is proportional to your share of the total staked supply.

Because rewards come from real on-chain activity (taxes converted to ETH via the rewards splitter), the effective return varies over time and is influenced by market conditions and token flow.

You can view your pending rewards in the staking interface before claiming.
`,
          status: '[REWARDS.CALCULATED]'
        },
        {
          id: 'SUB_004_C',
          command: '>> SUB.QUERY: Rewards.Distribution',
          title: 'Where do staking rewards come from?',
          response: `LOADING DISTRIBUTION LOGIC...

Staking rewards are paid in ETH. When rewards are active (Phase 2+), ETH is routed into the staking contract from RL80's transaction tax via a distributor module.

TAX ALLOCATION BY PHASE:
• Phase 1: 0% to staking (liquidity focus)
• Phase 2: 1% to staking (pilot rewards)
• Phase 3: 2% to staking (full rewards)
• Phase 4: 0% to staking (zero tax mode)

The distributor swaps collected RL80 for ETH and forwards the staking allocation to the rewards contract for distribution to stakers.
`,
          status: '[DISTRIBUTION.CONFIGURED]'
        },
        {
          id: 'SUB_004_D',
          command: '>> SUB.QUERY: Reward.Mechanism',
          title: 'How are rewards calculated?',
          response: `ANALYZING ...

Rewards are distributed proportionally based on how much RL80 you have staked and for how long. The contract uses a cumulative per-token accounting model so rewards remain fair across deposits and withdrawals.

STANDARD CALCULATION:
Your share = (Your Staked Amount / Total Staked) × Rewards Distributed

ILLUMIN80 BONUS:
Members with Illumin80 status receive a 1.2x multiplier on all staking rewards. Qualify by ranking in the top 20% of cumulative token burners (evaluated monthly).

Early stakers who position themselves in Phase 1 will be included in the first reward distributions when Phase 2 activates.
`,
          status: '[REWARDS.CALCULATED]'
        },
        {
          id: 'SUB_004_E',
          command: '>> SUB.QUERY: LOCK.Mechanism',
          title: 'Is there a lockup?',
          response: `ANALYZING ...

Yes. Staked RL80 has a 7-day lock period. Each new staking deposit resets your unlock timer.

This applies in all phases — even in Phase 1 when rewards haven't activated yet. Your tokens are locked per standard staking rules regardless of reward status.
`,
          status: '[LOCKUP.CLARIFIED]'
        },
        {
          id: 'SUB_004_F',
          command: '>> SUB.QUERY: CLAIM.Mechanism',
          title: 'When can I claim rewards?',
          response: `ANALYZING ...

You can claim rewards at any time once they are available (Phase 2+), as long as your accrued rewards meet the minimum claim threshold.

IMPORTANT: During Phase 1, there are no rewards to claim yet. The staking interface will show your staked position, but claimable rewards will be zero until Phase 2 activates.

Because claiming requires an on-chain transaction, a minimum threshold is used to help prevent gas-inefficient micro-claims. You remain in full control of when to claim.
`,
          status: '[CLAIM.READY]'
        },
        {
          id: 'SUB_004_G',
          command: '>> SUB.QUERY: Early.Staking',
          title: 'Why stake early in Phase 1?',
          response: `ANALYZING EARLY STAKER BENEFITS...

Staking during Phase 1 offers several advantages:

• SECURE YOUR POSITION: Be first in line when rewards activate
• NO RUSH: Stake at your own pace before Phase 2 competition
• SAME LOCK RULES: 7-day lock applies — your commitment is real
• QUEUED REWARDS: Early stakers are included from the first distribution
• BUILD ILLUMIN80 STATUS: Burn tokens now to qualify for 1.2x multiplier

Think of Phase 1 staking like getting in line before the doors open. When Phase 2 activates, you're already positioned to receive your proportional share of the first reward distribution.

PRO TIP: Use Phase 1 to both stake AND burn. Qualify for Illumin80 status now, and when rewards activate in Phase 2, you'll receive the 1.2x multiplier on your staking rewards.

This is intentional design, not a delay. Building liquidity first creates a stronger foundation for sustainable rewards.
`,
          status: '[BENEFITS.LOADED]'
        }
      ]
    },
    {
      id: 'QUERY_005',
      command: '> QUERY: Burn.Protocol',
      title: 'Candle Burning',
      response: ` INITIALIZING METANARRATIVE...
To burn a candle, visit the /illumin80 page and follow the on-screen steps.
Burning RL80 is optional and accessible—any amount may be burned to participate. Each burn lights a candle and adds your message to the shrine.

Each candle burns for 24 hours.

Only one candle may be active per wallet at a time.
If you burn again before your candle expires, your new candle replaces the existing one—renewing your light rather than stacking visibility.
      `,
      status: '[PROTOCOL.READY]',
      subQuestions: [
        {
          id: 'SUB_005_A',
          command: '>> SUB.QUERY: Burn.Mechanics',
          title: 'How does the burn mechanism work?',
          response: `LOADING BURN PROTOCOL...
        
When RL80 tokens are burned, they are sent to the 0x000… address (often called the burn address).

This address has no private key and cannot be accessed by anyone. Tokens sent there are permanently removed from circulation and cannot be recovered, spent, or reassigned.

Burning is irreversible by design.

`,
          status: '[BURN.ACTIVE]'
        },
        {
          id: 'SUB_005_B',
          command: '>> SUB.QUERY: Ritual.Significance',
          title: 'What is the ritual significance?',
          response: `ACCESSING SACRED PROTOCOLS...

Digital Candle Ritual:
• Each candle represents a prayer, confession, or appreciation
• Community intentions amplified
• Sentiment analysis provided by visual display and statistical summary, as well as a periodic AI analysis of general message content.

Spiritual ROI: ∞`,

          status: '[RITUAL.CONFIRMATION]'
        },
        {
          id: 'SUB_005_C',
          command: '>> SUB.QUERY: Burn.Impact',
          title: 'How does burning affect token value?',
          response: `CALCULATING ECONOMIC IMPACT...

Deflationary Effects:
• Reduced circulating supply
• Increased scarcity over time
• Price pressure upward
• Holder value appreciation
• Sustainable tokenomics

INITIAL SUPPLY: 80B RL80`,
          status: '[IMPACT.POSITIVE]'
        }
      ]
    },
    {
      id: 'QUERY_CHAT',
      command: '> QUERY: Chat.Room',
      title: 'Chat Room',
      response: ` LOADING COMMUNICATION PROTOCOLS...

RL80 uses a built-in chat room on the site rather than Discord or Telegram.

This is a deliberate safety decision. Discord and Telegram are the most common platforms where crypto scammers operate — impersonating admins, sending phishing links in DMs, and running fake "support" channels.

By keeping community chat on-site, we eliminate those attack vectors entirely. There are no DMs to exploit, no fake mod accounts, and no third-party servers to impersonate. What you see is what you get — one chat room, on the official site, in plain view.

Chat messages are not saved — when you leave the page, they're gone. This is intentional. No chat logs means no data to mine, leak, or weaponize.

Your safety matters more than platform convenience.
`,
      status: '[CHAT.SECURED]',
      subQuestions: []
    },

    {
      id: 'QUERY_006',
      command: '> QUERY: Legal.Compliance',
      title: 'Legal and Tax Info',
      response: ` CONNECTING TO LEGAL ADVISOR...

Legal framework and compliance:

• Terms of Service and Privacy Policy enforced
• 18+ age requirement for all users
• AI-generated content and financial disclaimers in effect

 `,
      status: '[LEGAL.ONLINE]',
      subQuestions: [
        {
          id: 'SUB_006_A',
          command: '>> SUB.QUERY: Disclaimers',
          title: 'What are the key disclaimers?',
          response: `LOADING DISCLAIMERS...

FINANCIAL DISCLAIMER:
• RL80 does NOT provide financial, investment, or trading advice
• All AI-generated analysis is for informational purposes only
• Cryptocurrency trading involves substantial risk of loss
• Past performance is not indicative of future results
• You are solely responsible for your own trading decisions

AI CONTENT DISCLAIMER:
• AI agent outputs may contain errors or inaccuracies
• AI analysis should not be the sole basis for financial decisions
• AI agents are experimental tools for educational purposes

BLOCKCHAIN DISCLAIMER:
• Wallet security is your responsibility
• All blockchain transactions are irreversible
• We do not have custody of your funds or assets
`,
          status: '[DISCLAIMERS.LOADED]'
        },
        {
          id: 'SUB_006_B',
          command: '>> SUB.QUERY: Terms.Service',
          title: 'What are the terms of service?',
          response: `LOADING TERMS OF SERVICE...

Key Terms:
• 18+ years of age required
• No financial advice provided - informational only
• User assumes all risks related to cryptocurrency
• All sales and donations are final
• We reserve the right to terminate accounts
• Binding arbitration for dispute resolution

View full Terms of Service:
https://app.termly.io/policy-viewer/policy.html?policyUUID=350b7b1c-556c-490e-b0ee-a07f5b52be86
`,
          status: '[TERMS.DISPLAYED]'
        },
        {
          id: 'SUB_006_C',
          command: '>> SUB.QUERY: Privacy.Policy',
          title: 'How is my data protected?',
          response: `ACCESSING PRIVACY PROTOCOLS...

Data Protection:
• Wallet addresses collected when connected
• User-generated content stored in Firebase
• AI providers (OpenAI, Anthropic, xAI) process interactions
• Authentication handled by Clerk
• No personal data sold to third parties
• Right to data deletion honored upon request
• Contact: 411@rl80.com

View full Privacy Policy:
https://app.termly.io/policy-viewer/policy.html?policyUUID=c79eb066-d5de-4656-b606-9802510fa0eb
`,
          status: '[PRIVACY.SECURED]'
        },
        {
          id: 'SUB_006_D',
          command: '>> SUB.QUERY: Tax.Info',
          title: 'What about taxes?',
          response: `LOADING TAX INFORMATION...

TAX NOTICE:
• You are responsible for reporting crypto transactions
• Token burns, trades, and rewards may be taxable events
• Consult a qualified tax professional in your jurisdiction
• We do not provide tax advice
• Keep records of all transactions for tax purposes

This is not tax advice. Tax treatment varies by jurisdiction.
`,
          status: '[TAX.INFO.LOADED]'
        }
      ]
    },
    {
      id: 'QUERY_007',
      command: '> QUERY: Safety.Protocol',
      title: 'Anti-Scam & Safety',
      response: ` LOADING SECURITY PROTOCOLS...

RL80 takes community safety seriously. This project is built on transparency, not hype. Please read the following guidelines to protect yourself from scams and impersonation.

REMEMBER: When in doubt, verify everything through our official channels.
`,
      status: '[SECURITY.ACTIVE]',
      subQuestions: [
        {
          id: 'SUB_007_A',
          command: '>> SUB.QUERY: Official.Channels',
          title: 'What are the official channels?',
          response: `VERIFYING OFFICIAL SOURCES...

OFFICIAL CHANNELS:
• Website: https://rl80.com
• X (Twitter): @rl80token
• Email: 411@rl80.com

IMPORTANT: We do NOT have a Discord or Telegram.
Any Discord or Telegram claiming to be RL80 is a scam.

If you see anyone promoting an RL80 Discord, Telegram, or alternative website, report them immediately and do not engage.
`,
          status: '[CHANNELS.VERIFIED]'
        },
        {
          id: 'SUB_007_B',
          command: '>> SUB.QUERY: DM.Policy',
          title: 'Will RL80 ever DM me?',
          response: `LOADING CONTACT POLICY...

NO. We will NEVER contact you privately.

• No DMs on X (Twitter)
• No private messages on any platform
• No "special offers" or "exclusive access" via private chat
• No requests for wallet info, seed phrases, or private keys

Anyone claiming to represent RL80 in your DMs is a scammer.
Do not engage. Block and report immediately.
`,
          status: '[POLICY.CLEAR]'
        },
        {
          id: 'SUB_007_C',
          command: '>> SUB.QUERY: Wallet.Safety',
          title: 'How do I protect my wallet?',
          response: `LOADING WALLET SECURITY PROTOCOLS...

WALLET SAFETY GUIDELINES:
• NEVER share your seed phrase or private keys with anyone
• NEVER enter your seed phrase on any website or form
• NEVER approve wallet transactions you don't understand
• ALWAYS verify contract addresses before interacting
• ALWAYS use hardware wallets for large holdings if possible

If someone asks for your seed phrase for ANY reason—even to "verify" your wallet or "fix" an issue—it is a scam.

Your seed phrase = your funds. Share it with no one.
`,
          status: '[WALLET.SECURED]'
        },
        {
          id: 'SUB_007_D',
          command: '>> SUB.QUERY: Community.Guidelines',
          title: 'How should I interact with the community?',
          response: `LOADING COMMUNITY PROTOCOLS...

COMMUNITY GUIDELINES:
• Be skeptical of unsolicited offers, "alpha," or airdrops
• Verify links before clicking—scammers use lookalike URLs
• Don't trust screenshots of wallets, transactions, or profits
• Question anyone promising guaranteed returns
• Report suspicious accounts to @rlaborare on X

REMEMBER: Real community members help each other stay safe.
If something feels off, trust your instincts.
`,
          status: '[COMMUNITY.GUIDELINES]'
        },
        {
          id: 'SUB_007_E',
          command: '>> SUB.QUERY: No.Guarantees',
          title: 'Are profits guaranteed?',
          response: `LOADING FINANCIAL REALITY CHECK...

NO. There are NO guaranteed profits.

• Cryptocurrency is volatile and speculative
• Past performance does not predict future results
• You can lose some or all of your investment
• Anyone promising guaranteed returns is lying

RL80 does not promise financial returns. It offers a transparent system with observable mechanics. How you engage is your choice, and so are the risks.

INVEST ONLY WHAT YOU CAN AFFORD TO LOSE.
`,
          status: '[REALITY.CHECK]'
        },
        {
          id: 'SUB_007_F',
          command: '>> SUB.QUERY: Report.Scam',
          title: 'How do I report a scam or impersonation?',
          response: `LOADING REPORT PROTOCOL...

TO REPORT SCAMS OR IMPERSONATION:
• Tweet or DM @rl80token on X with details
• Email 411@rl80.com with screenshots if possible
• Block and report the scammer on the platform

We actively monitor for impersonation and will issue warnings through our official X account when scams are detected.

Help us protect the community by reporting suspicious activity.
`,
          status: '[REPORT.READY]'
        },
//         {
//           id: 'SUB_007_G',
//           command: '>> SUB.QUERY: Design.Philosophy',
//           title: 'Why no Discord or Telegram?',
//           response: `LOADING DESIGN PHILOSOPHY...

// We intentionally avoid Discord and Telegram because:

// • These platforms are common vectors for scams
// • Private groups enable impersonation and manipulation
// • "Alpha" channels create information asymmetry
// • Moderation is difficult at scale

// RL80 is designed for transparency. Everything you need is public: the website, the contract, the tokenomics, and official announcements on X.

// This is a feature, not a limitation.
// `,
//           status: '[PHILOSOPHY.LOADED]'
//         }
      ]
    }
  ];

  // Animate scanline and set session ID
  useEffect(() => {
    // Generate session ID only on client side
    setSessionId(Math.random().toString(36).substring(2, 8).toUpperCase());
    
    const interval = setInterval(() => {
      setScanlinePos(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Cleanup all typewriter intervals on unmount
  useEffect(() => {
    return () => {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
      }
      Object.values(subTypewriterIntervalsRef.current).forEach(intervalId => {
        if (intervalId) clearInterval(intervalId);
      });
    };
  }, []);

  // Typewriter effect for responses
  // Typewriter effect for main query responses
  const typewriterEffect = useCallback((text, queryIndex) => {
    // Clear any existing interval first
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }

    setIsTyping(true);
    setTypedText('');
    let charIndex = 0;

    typewriterIntervalRef.current = setInterval(() => {
      if (charIndex < text.length) {
        setTypedText(text.substring(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
        setIsTyping(false);
        // Mark this query as animated
        setAnimatedQueries(prev => ({ ...prev, [queryIndex]: true }));
      }
    }, 15);
  }, []);

  // Typewriter effect for sub-question responses
  const subTypewriterEffect = useCallback((text, parentIndex, subIndex) => {
    const key = `${parentIndex}-${subIndex}`;

    // Clear any existing interval for this key first
    if (subTypewriterIntervalsRef.current[key]) {
      clearInterval(subTypewriterIntervalsRef.current[key]);
      subTypewriterIntervalsRef.current[key] = null;
    }

    setIsSubTyping(prev => ({ ...prev, [key]: true }));
    setSubTypedText(prev => ({ ...prev, [key]: '' }));
    let charIndex = 0;

    subTypewriterIntervalsRef.current[key] = setInterval(() => {
      if (charIndex < text.length) {
        setSubTypedText(prev => ({ ...prev, [key]: text.substring(0, charIndex + 1) }));
        charIndex++;
      } else {
        clearInterval(subTypewriterIntervalsRef.current[key]);
        subTypewriterIntervalsRef.current[key] = null;
        setIsSubTyping(prev => ({ ...prev, [key]: false }));
        // Mark this sub-query as animated
        setAnimatedSubQueries(prev => ({ ...prev, [key]: true }));
      }
    }, 15);
  }, []);

  const handleQueryClick = (index) => {
    if (activeQuery === index) {
      // Closing - clear all intervals
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      // Clear all sub-intervals
      Object.keys(subTypewriterIntervalsRef.current).forEach(key => {
        if (subTypewriterIntervalsRef.current[key]) {
          clearInterval(subTypewriterIntervalsRef.current[key]);
          subTypewriterIntervalsRef.current[key] = null;
        }
      });
      setActiveQuery(null);
      setTypedText('');
      setIsTyping(false);
      setActiveSubQuery({});
      setSubTypedText({});
      setIsSubTyping({});
    } else {
      // Capture scroll offset relative to clicked element before layout changes
      const element = document.getElementById(faqData[index].id);
      const offsetBefore = element ? element.getBoundingClientRect().top : null;

      // Opening new section - clear any existing intervals first
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      Object.keys(subTypewriterIntervalsRef.current).forEach(key => {
        if (subTypewriterIntervalsRef.current[key]) {
          clearInterval(subTypewriterIntervalsRef.current[key]);
          subTypewriterIntervalsRef.current[key] = null;
        }
      });
      setActiveQuery(index);
      setActiveSubQuery({});
      setSubTypedText({});
      setIsSubTyping({});

      // Check if already animated - show instantly, otherwise animate
      if (animatedQueries[index]) {
        setTypedText(faqData[index].response);
        setIsTyping(false);
      } else {
        typewriterEffect(faqData[index].response, index);
      }

      // After state update and render, restore scroll so the clicked item stays in place
      if (element && offsetBefore !== null) {
        requestAnimationFrame(() => {
          const offsetAfter = element.getBoundingClientRect().top;
          const drift = offsetAfter - offsetBefore;
          if (Math.abs(drift) > 1) {
            window.scrollBy(0, drift);
          }
        });
      }
    }
  };

  const handleSubQueryClick = (e, parentIndex, subIndex) => {
    e.stopPropagation();
    const key = `${parentIndex}-${subIndex}`;
    if (activeSubQuery[key]) {
      // Closing - clear this sub-interval
      if (subTypewriterIntervalsRef.current[key]) {
        clearInterval(subTypewriterIntervalsRef.current[key]);
        subTypewriterIntervalsRef.current[key] = null;
      }
      setActiveSubQuery(prev => ({ ...prev, [key]: false }));
      setSubTypedText(prev => ({ ...prev, [key]: '' }));
      setIsSubTyping(prev => ({ ...prev, [key]: false }));
    } else {
      // Capture scroll offset relative to clicked element before layout changes
      const clickedEl = e.currentTarget;
      const offsetBefore = clickedEl.getBoundingClientRect().top;

      setActiveSubQuery(prev => ({ ...prev, [key]: true }));
      const subQuestion = faqData[parentIndex].subQuestions[subIndex];

      // Check if already animated - show instantly, otherwise animate
      if (animatedSubQueries[key]) {
        setSubTypedText(prev => ({ ...prev, [key]: subQuestion.response }));
        setIsSubTyping(prev => ({ ...prev, [key]: false }));
      } else {
        subTypewriterEffect(subQuestion.response, parentIndex, subIndex);
      }

      // After state update and render, restore scroll so the clicked sub-item stays in place
      requestAnimationFrame(() => {
        const offsetAfter = clickedEl.getBoundingClientRect().top;
        const drift = offsetAfter - offsetBefore;
        if (Math.abs(drift) > 1) {
          window.scrollBy(0, drift);
        }
      });
    }
  };

  return (
    <motion.div
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.8 }}
      style={{
        position: 'relative',
        margin: '4rem auto',
        marginBottom: isMobile ? '4rem' : '12rem',
        // width: isMobile ? '95%' : '90%',
        maxWidth: '1200px',
        zIndex: 1,
        pointerEvents: 'auto'
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 20, 0, 0.4))',
        border: '2px solid #00ff00',
        borderRadius: '0',
        padding: isMobile ? '20px 15px' : '30px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 0 40px rgba(0, 255, 0, 0.3), inset 0 0 40px rgba(0, 255, 0, 0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        

        {/* Grid pattern overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0, 255, 0, 0.02) 2px,
              rgba(0, 255, 0, 0.02) 4px
            ),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 2px,
              rgba(0, 255, 0, 0.02) 2px,
              rgba(0, 255, 0, 0.02) 4px
            )
          `,
          pointerEvents: 'none',
        }} />

        {/* Terminal header */}
        <div style={{
          marginBottom: '30px',
          paddingBottom: '15px',
          borderBottom: '1px solid rgba(0, 255, 0, 0.3)',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            display: 'flex',
            justifyContent: isMobile ? 'center' : 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '8px' : '0'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#00ff00',
              fontFamily: 'monospace',
              opacity: 0.7,
              letterSpacing: '2px',
              textAlign: 'center'
            }}>
              [ORACLE.DIVINE.WISDOM.v2.0]
            </div>
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#00ff00',
                boxShadow: '0 0 10px #00ff00',
                animation: 'pulse 2s infinite'
              }} />
              <span style={{
                fontSize: '10px',
                color: '#00ff00',
                fontFamily: 'monospace',
                opacity: 0.7
              }}>
                CONNECTED
              </span>
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%'
          }}>
            <SkewedHeading 
              lines={["FAQ::TERMINAL"]}
              // colors={["#d4af37", "#f4e4c1", "#ffd700"]}
              colors={["#00ff00"]}
              fontSize={{ mobile: "2.5rem", desktop: "3rem" }}
              isMobile={isMobile}
            />
          </div>
          
          <div style={{
            textAlign: 'center',
            marginTop: '10px',
            fontSize: '12px',
            color: '#00ff00',
            fontFamily: 'monospace',
            opacity: 0.5,
            letterSpacing: '1px'
          }}>
            {'< ACCESS.GRANTED :: QUERY.MODE.ACTIVE >'}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: isMobile ? '20px' : '40px',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'flex-start',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Virgin Mary card with cyber enhancements */}
          <div style={{
            flex: isMobile ? '1' : '0 0 300px',
            position: 'relative',
            alignSelf: isMobile ? 'center' : 'flex-start'
          }}>
            <div style={{
              position: 'relative',
              padding: '10px',
              background: 'rgba(0, 0, 0, 0.6)',
              border: '2px solid #00ff00',
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              {/* Corner brackets */}
              <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                width: '20px',
                height: '20px',
                borderTop: '2px solid #ffd700',
                borderLeft: '2px solid #ffd700',
              }} />
              <div style={{
                position: 'absolute',
                top: '0',
                right: '0',
                width: '20px',
                height: '20px',
                borderTop: '2px solid #ffd700',
                borderRight: '2px solid #ffd700',
              }} />
              <div style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                width: '20px',
                height: '20px',
                borderBottom: '2px solid #ffd700',
                borderLeft: '2px solid #ffd700',
              }} />
              <div style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                width: '20px',
                height: '20px',
                borderBottom: '2px solid #ffd700',
                borderRight: '2px solid #ffd700',
              }} />
              
              <div style={{
                position: 'relative',
                width: '100%',
                borderRadius: '5px',
                overflow: 'hidden'
              }}>
                <img 
                  src="/queenOfHearts1.jpg"
                  alt="Our Lady - Divine Oracle" 
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: '5px',
                    filter: 'brightness(1.2) contrast(1.3) saturate(1.2) drop-shadow(2px 0px 0px rgba(255, 0, 100, 0.5)) drop-shadow(-2px 0px 0px rgba(0, 255, 255, 0.5))',
                    boxShadow: '0 0 30px rgba(255, 215, 0, 0.3), 0 0 60px rgba(0, 255, 0, 0.2)',
                    // animation: 'transmissionGlitch1 3.7s infinite linear, transmissionGlitch2 5.3s infinite linear, transmissionGlitch3 7.1s infinite linear'
                  }}
                />
                
                {/* Transmission interference lines */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: `
                    repeating-linear-gradient(
                      0deg,
                      transparent 0px,
                      transparent 2px,
                      rgba(0, 255, 0, 0.02) 2px,
                      rgba(0, 255, 0, 0.02) 4px
                    )
                  `,
                  animation: 'scanlines 0.1s infinite linear',
                  pointerEvents: 'none',
                  zIndex: 2
                }} />
                
                {/* Signal disruption bars */}
                <div style={{
                  position: 'absolute',
                  top: '20%',
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  animation: 'signalBar1 4.2s infinite linear, signalBarRandom1 6.8s infinite linear',
                  pointerEvents: 'none',
                  zIndex: 3
                }} />
                
                <div style={{
                  position: 'absolute',
                  top: '60%',
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: 'rgba(0, 255, 255, 0.6)',
                  animation: 'signalBar2 7.4s infinite linear, signalBarRandom2 9.1s infinite linear',
                  pointerEvents: 'none',
                  zIndex: 3
                }} />
              </div>
              
              {/* Holographic overlay effect */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(45deg, transparent 30%, rgba(0, 255, 0, 0.1) 50%, transparent 70%)',
                animation: 'holographicScan 3s linear infinite',
                pointerEvents: 'none',
              }} />
              
              {/* Oracle status */}
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '5px 15px',
                background: 'rgba(0, 0, 0, 0.9)',
                border: '1px solid #ffd700',
                borderRadius: '20px',
                fontSize: '11px',
                color: '#ffd700',
                fontFamily: 'monospace',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
              }}>
                [ORACLE.ACTIVE]
              </div>
            </div>
            
            {/* Sacred Terminal Label */}
            <div style={{
              marginTop: '15px',
              textAlign: 'center',
              fontSize: '10px',
              color: '#ffd700',
              fontFamily: 'monospace',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              opacity: 0.7
            }}>
              :: DIVINE.GUIDANCE.PROTOCOL ::
            </div>
          </div>

          {/* FAQ Queries */}
          <div style={{
            flex: 1,
            width: '100%'
          }}>
            {faqData.map((faq, index) => (
              <div key={faq.id} id={faq.id} style={{ marginBottom: '15px', overflowAnchor: 'none' }}>
                <motion.div
                  onClick={() => handleQueryClick(index)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    padding: '15px',
                    background: activeQuery === index 
                      ? 'rgba(0, 255, 0, 0.15)' 
                      : 'rgba(0, 0, 0, 0.4)',
                    border: activeQuery === index 
                      ? '2px solid #00ff00' 
                      : '1px solid rgba(0, 255, 0, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{
                        fontSize: '10px',
                        color: '#00ff00',
                        fontFamily: 'monospace',
                        marginBottom: '5px',
                        opacity: 0.6
                      }}>
                        {faq.command}
                      </div>
                      <div style={{
                        fontSize: isMobile ? '14px' : '16px',
                        color: '#fff',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        letterSpacing: '1px'
                      }}>
                        {faq.title}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      {activeQuery === index && (
                        <span style={{
                          fontSize: '10px',
                          color: '#00ff00',
                          fontFamily: 'monospace',
                          opacity: 0.7
                        }}>
                          {faq.status}
                        </span>
                      )}
                      <span style={{
                        fontSize: '20px',
                        color: '#00ff00',
                        transform: activeQuery === index ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 0.3s ease'
                      }}>
                        ▼
                      </span>
                    </div>
                  </div>
                  
                  {activeQuery === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{
                        marginTop: '15px',
                        paddingTop: '15px',
                        borderTop: '1px solid rgba(0, 255, 0, 0.2)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Animated scanline for this answer only */}
                      <div style={{
                        position: 'absolute',
                        top: `${scanlinePos}%`,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent, rgba(0, 255, 0, 0.6), transparent)',
                        opacity: 0.8,
                        pointerEvents: 'none',
                        zIndex: 2
                      }} />
                      
                      <div style={{
                        color: '#00ff00',
                        fontFamily: 'monospace',
                        fontSize: isMobile ? '12px' : '14px',
                        lineHeight: '1.8',
                        whiteSpace: 'pre-line',
                        position: 'relative',
                        zIndex: 1
                      }}>
                        {renderTextWithLinks(typedText)}
                        {isTyping && <span style={{ 
                          animation: 'blink 0.5s infinite',
                          marginLeft: '2px'
                        }}>_</span>}
                      </div>

                      {/* Sub-questions section */}
                      {!isTyping && faq.subQuestions && faq.subQuestions.length > 0 && (
                        <div style={{
                          marginTop: '20px',
                          paddingTop: '20px',
                          borderTop: '1px dashed rgba(0, 255, 0, 0.3)'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#ffd700',
                            fontFamily: 'monospace',
                            marginBottom: '15px',
                            letterSpacing: '2px',
                            textTransform: 'uppercase',
                            opacity: 0.8
                          }}>
                            [SUB.QUERIES.AVAILABLE]
                          </div>
                          
                          {faq.subQuestions.map((subQ, subIndex) => {
                            const subKey = `${index}-${subIndex}`;
                            const isSubActive = activeSubQuery[subKey];
                            
                            return (
                              <div key={subQ.id} style={{ marginBottom: '10px' }}>
                                <motion.div
                                  onClick={(e) => handleSubQueryClick(e, index, subIndex)}
                                  whileHover={{ scale: 1.01 }}
                                  whileTap={{ scale: 0.99 }}
                                  style={{
                                    padding: '12px',
                                    background: isSubActive
                                      ? 'rgba(255, 215, 0, 0.1)'
                                      : 'rgba(0, 0, 0, 0.3)',
                                    border: isSubActive
                                      ? '1px solid #ffd700'
                                      : '1px solid rgba(255, 215, 0, 0.2)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    borderRadius: '4px'
                                  }}
                                >
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}>
                                    <div>
                                      <div style={{
                                        fontSize: '9px',
                                        color: '#ffd700',
                                        fontFamily: 'monospace',
                                        marginBottom: '3px',
                                        opacity: 0.6
                                      }}>
                                        {subQ.command}
                                      </div>
                                      <div style={{
                                        fontSize: isMobile ? '13px' : '14px',
                                        color: '#fff',
                                        fontFamily: 'monospace',
                                        letterSpacing: '0.5px'
                                      }}>
                                        {subQ.title}
                                      </div>
                                    </div>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}>
                                      {isSubActive && (
                                        <span style={{
                                          fontSize: '9px',
                                          color: '#ffd700',
                                          fontFamily: 'monospace',
                                          opacity: 0.7
                                        }}>
                                          {subQ.status}
                                        </span>
                                      )}
                                      <span style={{
                                        fontSize: '16px',
                                        color: '#ffd700',
                                        transform: isSubActive ? 'rotate(180deg)' : 'rotate(0)',
                                        transition: 'transform 0.3s ease'
                                      }}>
                                        ▼
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {isSubActive && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.3 }}
                                      style={{
                                        marginTop: '12px',
                                        paddingTop: '12px',
                                        borderTop: '1px solid rgba(255, 215, 0, 0.2)'
                                      }}
                                    >
                                      <div style={{
                                        color: '#ffd700',
                                        fontFamily: 'monospace',
                                        fontSize: isMobile ? '11px' : '13px',
                                        lineHeight: '1.6',
                                        whiteSpace: 'pre-line',
                                        opacity: 0.9
                                      }}>
                                        {renderTextWithLinks(subTypedText[subKey] || '')}
                                        {isSubTyping[subKey] && <span style={{
                                          animation: 'blink 0.5s infinite',
                                          marginLeft: '2px'
                                        }}>_</span>}
                                      </div>
                                    </motion.div>
                                  )}
                                </motion.div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal footer */}
        <div style={{
          marginTop: '30px',
          paddingTop: '15px',
          borderTop: '1px solid rgba(0, 255, 0, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            fontSize: '10px',
            color: '#00ff00',
            fontFamily: 'monospace',
            opacity: 0.5
          }}>
            TERMINAL.SESSION.ID: {sessionId}
          </div>
          <div style={{
            fontSize: '10px',
            color: '#ffd700',
            fontFamily: 'monospace',
            opacity: 0.5
          }}>
            VERIFIED.BY.OUR.LADY
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 10px currentColor;
          }
          50% {
            opacity: 0.5;
            box-shadow: 0 0 20px currentColor;
          }
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        
        @keyframes holographicScan {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes transmissionGlitch1 {
          0%, 97%, 100% { opacity: 1; }
          98% { opacity: 0.4; }
          99% { opacity: 0.8; }
        }
        
        @keyframes transmissionGlitch2 {
          0%, 92%, 100% { 
            filter: brightness(1.2) contrast(1.3) saturate(1.2) drop-shadow(2px 0px 0px rgba(255, 0, 100, 0.5)) drop-shadow(-2px 0px 0px rgba(0, 255, 255, 0.5));
          }
          93% { 
            filter: brightness(1.8) contrast(2.0) saturate(2.0) drop-shadow(6px 0px 0px rgba(255, 0, 100, 1.0)) drop-shadow(-6px 0px 0px rgba(0, 255, 255, 1.0));
          }
          94% { 
            filter: brightness(0.8) contrast(0.9) saturate(0.5) drop-shadow(1px 0px 0px rgba(255, 0, 100, 0.2)) drop-shadow(-1px 0px 0px rgba(0, 255, 255, 0.2));
          }
          95% { 
            filter: brightness(1.6) contrast(1.8) saturate(1.8) drop-shadow(4px 0px 0px rgba(255, 0, 100, 0.8)) drop-shadow(-4px 0px 0px rgba(0, 255, 255, 0.8));
          }
        }
        
        @keyframes transmissionGlitch3 {
          0%, 88%, 100% { transform: translateX(0px); }
          /* 89% { transform: translateX(2px); } */
          /* 90% { transform: translateX(-1px); } */
          /* 91% { transform: translateX(1px); } */
          /* 92% { transform: translateX(0px); } */
        }
        
        @keyframes scanlines {
          0% { transform: translateY(0px); }
          100% { transform: translateY(4px); }
        }
        
        @keyframes signalBar1 {
          0%, 94%, 100% { opacity: 0; }
          95% { opacity: 0.8; transform: translateX(20%); }
          96% { opacity: 0.6; transform: translateX(-10%); }
          97% { opacity: 0; }
        }
        
        @keyframes signalBarRandom1 {
          0%, 83%, 100% { opacity: 0; }
          84% { opacity: 1; transform: translateX(-25%); }
          85% { opacity: 0.5; transform: translateX(15%); }
          86% { opacity: 0; }
        }
        
        @keyframes signalBar2 {
          0%, 91%, 100% { opacity: 0; }
          92% { opacity: 0.7; transform: translateY(-2px); }
          93% { opacity: 0.3; transform: translateY(1px); }
          94% { opacity: 0; }
        }
        
        @keyframes signalBarRandom2 {
          0%, 79%, 100% { opacity: 0; }
          80% { opacity: 0.9; transform: translateY(-4px); }
          81% { opacity: 0.4; transform: translateY(2px); }
          82% { opacity: 0; }
        }
        
      `}</style>
    </motion.div>
  );
}