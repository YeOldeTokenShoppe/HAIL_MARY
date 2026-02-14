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
	•	Burn tokens for symbolic acts of sacrifice and deflationary impact, or to earn Illumin80 status

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
• Pay with credit card or debit card
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
0x30D01555d88c76500a82754A1D53cAc082A6CB75

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

RL80 is a renounced ERC-20 token on Base with 0% tax on all transactions.

Ownership has been permanently renounced. No admin can modify the contract. No hidden minting. No backdoors. No custody of your funds.

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
RL80 is a standard ERC-20 token on Base with a permanently renounced contract and 0% tax on all transactions.

KEY BEHAVIORS:
• ✅ Capped supply — 80 billion tokens
• ✅ No minting after launch
• ✅ No blacklist or freeze functions
• ✅ 0% tax on ALL transactions (buy, sell, and transfer)
• ✅ Contract ownership permanently renounced
• ✅ No admin can modify the contract

RENOUNCED STATUS:
The contract has been permanently renounced. This means no one — including the original deployer — can change fees, mint tokens, freeze wallets, or modify any contract behavior. The code is immutable.
`,
          status: '[TOKEN.VERIFIED]'
        },
        {
          id: 'SUB_002_D',
          command: '>> SUB.QUERY: Design.Philosophy',
          title: 'Design Philosophy',
          response: `LOADING CORE PRINCIPLES...

RL80 follows three principles:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. IMMUTABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Contract ownership permanently renounced
• 0% tax on all transactions
• No admin functions remain
• Code is frozen forever

No one can change anything. The contract runs exactly as written.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. MINIMAL TRUST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• No admin can mint
• No admin can seize wallets
• No hidden upgradeability
• Core behavior is deterministic

There are no admin keys. The contract is fully autonomous.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. TRANSPARENCY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Everything happens on-chain:
• Token transfers
• Burns
• Supply tracking

Anyone can verify in a block explorer.
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
❌ No admin keys (contract renounced)
❌ No "owner can drain funds" functions
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
• A fixed-supply, deflationary token
• With 0% tax on all transactions
• Contract permanently renounced — no admin, no changes
• Enforced by open-source smart contracts, with no trust assumptions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Simple. Immutable. Verifiable.

Rules are enforced by code.
No one holds the keys.
Trust is eliminated by design.

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

Every burn permanently reduces the token supply, increasing scarcity for all holders. The more you burn, the higher you rank on the leaderboard.

`,
      status: '[REQUIREMENTS.LISTED]',
      subQuestions: [
        {
          id: 'SUB_003_A',
          command: '>> SUB.QUERY: Burn.Protocol',
          title: 'How do I burn a candle?',
          response: `RETRIEVING INSTRUCTIONS...

To burn a candle, visit the /illumin80 page and simply click the button, fill out a quick form, and sign your digital wallet transaction.

Candles melt over 24 hours. When fully melted, they expire and are removed from the scene. Burn again to maintain your presence on the shrine and climb the leaderboard.
`,
          status: '[INSTRUCTIONS.LISTED]'
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

RL80 uses a built-in chat room on the site as an alternative to Discord or Telegram.

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
• Token burns and trades may be taxable events
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