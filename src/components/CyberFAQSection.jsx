'use client';
import { useState, useEffect, useRef } from 'react';
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

  // FAQ data with terminal-style queries
  const faqData = [
    {
      id: 'QUERY_001',
      command: '> QUERY: Token.Information',
      title: 'What is RL80"?',
      response: ` ACCESSING DATABASE... 
      
Our flagship protocol combines cutting-edge DeFi technology with divine inspiration. Built on immutable smart contracts, it offers unparalleled staking rewards and community governance.

Key features include:
• Automated yield optimization
// • Sacred tokenomics blessed by Our Lady
• Intuitive interface for both degens and normies

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque sed porta tortor, vel pellentesque felis. Fusce nibh neque, posuere sit amet lobortis id, lacinia eget velit. Nulla eget metus laoreet, semper arcu et, mollis sem. Vestibulum diam turpis, euismod in pharetra eget, gravida ut purus.`,
      status: '[DATA.RETRIEVED]',
      subQuestions: [
        {
          id: 'SUB_001_A',
          command: '>> SUB.QUERY: Tokenomics.Details',
          title: 'What are the tokenomics?',
          response: `LOADING TOKENOMICS MODULE...

Total Supply: 1,000,000,000 RL80
Initial Distribution:
• 40% - Community rewards & staking
• 25% - Liquidity pools
• 20% - Treasury (time-locked)
• 10% - Team (vested 2 years)
• 5% - Marketing & partnerships

Deflationary mechanics with 2% burn on transfers

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed pellentesque laoreet ex, a condimentum mi fringilla non. Nunc porttitor, augue eget condimentum vulputate, dolor felis mollis odio, ac feugiat lacus nulla euismod odio.`,
          status: '[TOKENOMICS.LOADED]'
        },
        {
          id: 'SUB_001_B',
          command: '>> SUB.QUERY: Contract.Addresses',
          title: 'What are the contract addresses?',
          response: `FETCHING CONTRACT DATA...

Main Contract: 0x8080...RL80 (Ethereum)
Staking Contract: 0x7777...STAKE
Liquidity Pool: Uniswap V3
Bridge Contract: 0x9999...BRIDGE

All contracts audited by CertiK and Quantstamp`,
          status: '[CONTRACTS.VERIFIED]'
        },
        {
          id: 'SUB_001_C',
          command: '>> SUB.QUERY: Tech.Stack',
          title: 'What technology powers RL80?',
          response: `ANALYZING TECH INFRASTRUCTURE...

Built on:
• Ethereum blockchain (ERC-20)
• Solidity 0.8.19
• OpenZeppelin contracts v4.9
• Chainlink oracles for price feeds
• IPFS for metadata storage
• Layer 2 integration via Arbitrum`,
          status: '[TECH.ANALYZED]'
        }
      ]
    },
    {
      id: 'QUERY_002', 
      command: '> QUERY: Security.Details',
      title: 'Trust, Safety, & Transparency',
      response: ` LOADING SECURITY MODULE...

Digital assets are delivered instantly to your wallet address. No physical shipping required. 

Transaction details:
• Instant blockchain confirmation
• Gas-optimized smart contracts
• Real-time tracking via Etherscan
• 24/7 availability across all timezones

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum lorem tortor, suscipit porta ex vestibulum, vulputate ultrices neque. Donec eleifend ex ultrices quam finibus euismod nec ac sem. Pellentesque sed porta tortor, vel pellentesque felis.`,
      status: '[PROTOCOL.ACTIVE]',
      subQuestions: [
        {
          id: 'SUB_002_A',
          command: '>> SUB.QUERY: Audit.Reports',
          title: 'What security audits have been performed?',
          response: `RETRIEVING AUDIT RECORDS...

Completed Audits:
• CertiK - Full smart contract audit (Score: 95/100)
• Quantstamp - Security assessment passed
• PeckShield - DeFi vulnerability scan clear
• Halborn - Penetration testing complete

All reports publicly available on GitHub

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce nibh neque, posuere sit amet lobortis id, lacinia eget velit. Nulla eget metus laoreet, semper arcu et, mollis sem.`,
          status: '[AUDITS.VERIFIED]'
        },
        {
          id: 'SUB_002_B',
          command: '>> SUB.QUERY: Risk.Management',
          title: 'How are user funds protected?',
          response: `INITIALIZING SAFETY PROTOCOLS...

Protection Measures:
• Multi-signature treasury (3/5 signers required)
• Time-locked withdrawals (48hr delay)
• Emergency pause functionality
• Insurance fund (5% of fees)
• Regular security updates
• Bug bounty program up to $100k`,
          status: '[SAFETY.ENGAGED]'
        },
        {
          id: 'SUB_002_C',
          command: '>> SUB.QUERY: Transparency.Metrics',
          title: 'How transparent is the protocol?',
          response: `ACCESSING TRANSPARENCY DATA...

Full Transparency:
• Open-source code on GitHub
• Real-time analytics dashboard
• Weekly community updates
• Monthly financial reports
• All team wallets public
• Governance votes on-chain`,
          status: '[TRANSPARENCY.100%]'
        }
      ]
    },
    {
      id: 'QUERY_003',
      command: '> QUERY: Rewards',
      title: 'Staking & Rewards',
      response: ` ACCESSING STAKING PROTOCOL...

All transactions are final and immutable on the blockchain. However, our Lady provides spiritual returns that are infinite.

Policy highlights:
• Permanent value accrual through staking
• Community support available 24/7
• Bug bounty program for protocol improvements

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum diam turpis, euismod in pharetra eget, gravida ut purus. Sed pellentesque laoreet ex, a condimentum mi fringilla non.`,
      status: '[TERMS.LOADED]',
      subQuestions: [
        {
          id: 'SUB_003_A',
          command: '>> SUB.QUERY: APY.Current',
          title: 'What are the current staking returns?',
          response: `CALCULATING CURRENT APY...

Staking Tiers:
• Bronze (1k+ RL80): 15% APY
• Silver (10k+ RL80): 25% APY
• Gold (100k+ RL80): 40% APY
• Divine (1M+ RL80): 80% APY

Compounded daily, rewards in RL80
No lock-up period required

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc porttitor, augue eget condimentum vulputate, dolor felis mollis odio, ac feugiat lacus nulla euismod odio. Vestibulum lorem tortor, suscipit porta ex vestibulum.`,
          status: '[APY.CALCULATED]'
        },
        {
          id: 'SUB_003_B',
          command: '>> SUB.QUERY: Rewards.Distribution',
          title: 'How are rewards distributed?',
          response: `LOADING DISTRIBUTION LOGIC...

Reward Sources:
• 50% from protocol fees
• 30% from liquidation penalties
• 20% from partner protocols

Distribution:
• Automatic daily compounding
• Claimable anytime
• No withdrawal fees`,
          status: '[DISTRIBUTION.ACTIVE]'
        },
        {
          id: 'SUB_003_C',
          command: '>> SUB.QUERY: Boost.Mechanisms',
          title: 'How can I boost my rewards?',
          response: `ANALYZING BOOST OPTIONS...

Reward Multipliers:
• NFT holders: +10% boost
• LP providers: +15% boost
• Governance participants: +5% boost
• Referral program: +2% per referral
• Long-term staking (90+ days): +20%

Boosts stack up to 50% maximum`,
          status: '[BOOSTS.AVAILABLE]'
        }
      ]
    },
    {
      id: 'QUERY_004',
      command: '> QUERY: Burn.Protocol',
      title: 'Candle Burning',
      response: ` INITIALIZING METANARRATIVE...

Accepted currencies:
• ETH (Ethereum)
• USDC / USDT / DAI
• Credit card via third-party providers
• All transactions secured by blockchain cryptography`,
      status: '[GATEWAY.READY]',
      subQuestions: [
        {
          id: 'SUB_004_A',
          command: '>> SUB.QUERY: Burn.Mechanics',
          title: 'How does the burn mechanism work?',
          response: `LOADING BURN PROTOCOL...

Burn Mechanics:
• 2% of every transaction burned forever
• Weekly community burn events
• 50% of penalty fees burned
• Deflationary supply model

Total Burned: 42,080,000 RL80
Burn rate increasing monthly`,
          status: '[BURN.ACTIVE]'
        },
        {
          id: 'SUB_004_B',
          command: '>> SUB.QUERY: Ritual.Significance',
          title: 'What is the ritual significance?',
          response: `ACCESSING SACRED PROTOCOLS...

Digital Candle Ritual:
• Each burn represents a prayer
• Community intentions amplified
• Sacred geometry in burn patterns
• Aligned with lunar cycles
• Blessed by Our Lady's grace

Spiritual ROI: ∞`,
          status: '[RITUAL.BLESSED]'
        },
        {
          id: 'SUB_004_C',
          command: '>> SUB.QUERY: Burn.Impact',
          title: 'How does burning affect token value?',
          response: `CALCULATING ECONOMIC IMPACT...

Deflationary Effects:
• Reduced circulating supply
• Increased scarcity over time
• Price pressure upward
• Holder value appreciation
• Sustainable tokenomics

Projected supply in 2025: 800M RL80`,
          status: '[IMPACT.POSITIVE]'
        }
      ]
    },
    {
      id: 'QUERY_005',
      command: '> QUERY: Multi-Agent.Cooperative',
      title: 'Trading Desk',
      response: ` LOADING TRADING SYSTEM ...

Smart contracts are audited and verified. Your investment is protected by:
• Multi-sig treasury
• Time-locked liquidity
• Community governance
• Divine providence of Our Lady`,
      status: '[WARRANTY.ACTIVE]',
      subQuestions: [
        {
          id: 'SUB_005_A',
          command: '>> SUB.QUERY: Trading.Strategies',
          title: 'What trading strategies are available?',
          response: `ANALYZING TRADING ALGORITHMS...

Available Strategies:
• DCA (Dollar Cost Averaging)
• Grid trading bot
• Arbitrage detection
• Liquidity provision auto-balancer
• Stop-loss/Take-profit automation
• AI sentiment-based trading`,
          status: '[STRATEGIES.LOADED]'
        },
        {
          id: 'SUB_005_B',
          command: '>> SUB.QUERY: Bot.Performance',
          title: 'How do the trading bots perform?',
          response: `FETCHING PERFORMANCE DATA...

Historical Performance:
• Average monthly return: 12-18%
• Win rate: 73%
• Maximum drawdown: 15%
• Sharpe ratio: 2.4
• Active traders: 4,200+

Past performance ≠ future results`,
          status: '[PERFORMANCE.TRACKED]'
        },
        {
          id: 'SUB_005_C',
          command: '>> SUB.QUERY: Fee.Structure',
          title: 'What are the trading fees?',
          response: `LOADING FEE SCHEDULE...

Trading Desk Fees:
• Spot trading: 0.1%
• Bot usage: 20% of profits
• No subscription fees
• Gas costs optimized
• Volume discounts available
• RL80 holders: 50% fee reduction`,
          status: '[FEES.DISPLAYED]'
        }
      ]
    },
        {
      id: 'QUERY_006',
      command: '> QUERY: Charity.module',
      title: 'Charity',
      response: ` CONNECTING TO CHARITY SYSTEM..

Our protocol dedicates resources to meaningful causes:
• 5% of protocol fees to charity
• Community-voted recipients
• Transparent on-chain donations
• Monthly impact reports

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque sed porta tortor, vel pellentesque felis. Fusce nibh neque, posuere sit amet lobortis id, lacinia eget velit. Nulla eget metus laoreet, semper arcu et, mollis sem.`,
      status: '[SUPPORT.ONLINE]',
      subQuestions: [
        {
          id: 'SUB_006_A',
          command: '>> SUB.QUERY: Charity.Programs',
          title: 'What charitable initiatives exist?',
          response: `LOADING CHARITY MODULE...

Active Programs:
• 5% of fees to selected charities
• Monthly community vote on recipients
• Disaster relief fund
• Education sponsorships
• Open-source development grants

Total donated: $2.8M USD`,
          status: '[CHARITY.ACTIVE]'
        },
        {
          id: 'SUB_006_B',
          command: '>> SUB.QUERY: Impact.Metrics',
          title: 'What is the social impact?',
          response: `CALCULATING IMPACT METRICS...

Community Impact:
• 15 schools funded
• 500+ developers supported
• 10,000 meals provided
• 50 wells built in Africa
• 100% transparent allocation
• Verified by third-party auditors`,
          status: '[IMPACT.MEASURED]'
        },
        {
          id: 'SUB_006_C',
          command: '>> SUB.QUERY: Participation.Guide',
          title: 'How can I participate in charity?',
          response: `ACCESSING PARTICIPATION PROTOCOLS...

Get Involved:
• Stake RL80 for automatic contribution
• Vote on charity proposals
• Submit new charity candidates
• Join volunteer programs
• NFT charity auctions
• Direct donation matching`,
          status: '[PARTICIPATION.OPEN]'
        }
      ]
    },
    
    {
      id: 'QUERY_007',
      command: '> QUERY: Legal.Compliance',
      title: 'Legal',
      response: ` CONNECTING TO LEGAL ADVISOR..

Legal framework and compliance:
• Fully compliant with DeFi regulations
• KYC/AML procedures in place
• Regular legal audits
• Terms of service enforced
• Privacy policy GDPR compliant

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla eget metus laoreet, semper arcu et, mollis sem. Vestibulum lorem tortor, suscipit porta ex vestibulum, vulputate ultrices neque. Donec eleifend ex ultrices quam finibus euismod nec ac sem.`,
      status: '[SUPPORT.ONLINE]',
      subQuestions: [
        {
          id: 'SUB_007_A',
          command: '>> SUB.QUERY: Regulatory.Status',
          title: 'What is the regulatory compliance?',
          response: `CHECKING COMPLIANCE STATUS...

Regulatory Compliance:
• SEC no-action letter pending
• FinCEN MSB registered
• EU MiCA compliant
• KYC/AML procedures active
• Legal opinions obtained
• Jurisdictional restrictions applied`,
          status: '[COMPLIANCE.VERIFIED]'
        },
        {
          id: 'SUB_007_B',
          command: '>> SUB.QUERY: Terms.Service',
          title: 'What are the terms of service?',
          response: `LOADING LEGAL DOCUMENTS...

Key Terms:
• 18+ years required
• Non-US persons only
• No financial advice provided
• User assumes all risks
• Arbitration clause included
• Governed by Cayman law`,
          status: '[TERMS.DISPLAYED]'
        },
        {
          id: 'SUB_007_C',
          command: '>> SUB.QUERY: Privacy.Policy',
          title: 'How is my data protected?',
          response: `ACCESSING PRIVACY PROTOCOLS...

Data Protection:
• No personal data stored on-chain
• GDPR compliant
• End-to-end encryption
• No data sold to third parties
• Right to deletion honored
• Regular security audits`,
          status: '[PRIVACY.SECURED]'
        }
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

  // Typewriter effect for responses
  const typewriterEffect = (text, index) => {
    setIsTyping(true);
    setTypedText('');
    let charIndex = 0;
    
    const typeInterval = setInterval(() => {
      if (charIndex < text.length) {
        setTypedText(text.substring(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
      }
    }, 20); // Slightly slower for better reliability

    return () => clearInterval(typeInterval);
  };

  // Typewriter effect for sub-question responses
  const subTypewriterEffect = (text, parentIndex, subIndex) => {
    const key = `${parentIndex}-${subIndex}`;
    setIsSubTyping(prev => ({ ...prev, [key]: true }));
    setSubTypedText(prev => ({ ...prev, [key]: '' }));
    let charIndex = 0;
    
    const typeInterval = setInterval(() => {
      if (charIndex < text.length) {
        setSubTypedText(prev => ({ ...prev, [key]: text.substring(0, charIndex + 1) }));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsSubTyping(prev => ({ ...prev, [key]: false }));
      }
    }, 20);

    return () => clearInterval(typeInterval);
  };

  const handleQueryClick = (index) => {
    if (activeQuery === index) {
      setActiveQuery(null);
      setTypedText('');
      setActiveSubQuery({});
      setSubTypedText({});
    } else {
      setActiveQuery(index);
      typewriterEffect(faqData[index].response, index);
      setActiveSubQuery({});
      setSubTypedText({});
    }
  };

  const handleSubQueryClick = (e, parentIndex, subIndex) => {
    e.stopPropagation(); // Prevent event bubbling to parent
    const key = `${parentIndex}-${subIndex}`;
    if (activeSubQuery[key]) {
      setActiveSubQuery(prev => ({ ...prev, [key]: false }));
      setSubTypedText(prev => ({ ...prev, [key]: '' }));
    } else {
      setActiveSubQuery(prev => ({ ...prev, [key]: true }));
      const subQuestion = faqData[parentIndex].subQuestions[subIndex];
      subTypewriterEffect(subQuestion.response, parentIndex, subIndex);
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
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#00ff00',
              fontFamily: 'monospace',
              opacity: 0.7,
              letterSpacing: '2px'
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
          
   <SkewedHeading 
      lines={["FAQ::TERMINAL"]}
      // colors={["#d4af37", "#f4e4c1", "#ffd700"]}
          colors={["#00ff00"]}
      fontSize={{ mobile: "2.5rem", desktop: "3rem" }}
      isMobile={isMobile}
    />
          
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
                    animation: 'transmissionGlitch1 3.7s infinite linear, transmissionGlitch2 5.3s infinite linear, transmissionGlitch3 7.1s infinite linear'
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
              <div key={faq.id} style={{ marginBottom: '15px' }}>
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
                        {typedText}
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
                                        {subTypedText[subKey] || ''}
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