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
      
RL80 is the on-chain expression of Our Lady of Perpetual Profit—a watcher of markets across centuries, now instantiated in code.
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
	•	Burn tokens for symbolic acts, recognition, or access to special features
	•	Interact with creative, on-chain displays that reflect community activity

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
          response: `ANALYZING IGNITION MECHANISM...

      Burning is the primary utility of RL80.

      It serves as a way to clarify intention through action. Any amount may be burned—participation is intentionally accessible, inexpensive, and voluntary. What matters is not scale, but presence.

      The act parallels traditional candle votives offered to the Virgin Mary: a small, personal gesture made visible within a shared space. In RL80, each burn adds light to the shrine.

      Every burn permanently reduces the fixed token supply. In doing so, an offering becomes a universal goodwill gesture—one that strengthens the system for all participants rather than extracting value from others.

      On the Illumin80 page, the total number of candles burning and tokens burned to date form a living display of collective engagement—a quiet, real-time signal of sentiment, conviction, and attention over time.
`,
          status: '[MECHANISM.ANALYZED]'
        }
      ]
    },
    {
      id: 'QUERY_002', 
      command: '> QUERY: Special.Status',
      title: 'What is The Illumin80?',
      response: ` LOADING LUMINARY MODULE...

The Illumin80 refers to participants who have chosen to actively engage with RL80 by staking or burning tokens.

`,
      status: '[REQUIREMENTS.LISTED]',
      subQuestions: [
        {
          id: 'SUB_002_A',
          command: '>> SUB.QUERY: Burn.Protocol',
          title: 'How do I burn a candle?',
          response: `RETRIEVING INSTRUCTIONS...

To burn a candle, visit the /illumin80 page and follow the on-screen steps.
Detailed burning instructions are available below.
`,
          status: '[INSTRUCTIONS.LISTED]'
        },
        {
          id: 'SUB_002_B',
          command: '>> SUB.QUERY: Staking.Protocol',
          title: 'How do I stake RL80?',
          response: `CREATING SUMMARY...
Staking RL80 allows you to participate in longer-term system mechanics.
Detailed staking instructions are available in the next module.
`,
          status: '[INSTRUCTIONS.SUMMARIZED]'
        },

      ]
    },
    {
      id: 'QUERY_003',
      command: '> QUERY: Rewards',
      title: 'Staking & Rewards',
      response: ` ACCESSING STAKING PROTOCOL...

Staking lets you deposit RL80 into the staking vault to participate in the system’s reward stream. While staked, your tokens remain yours, but they are locked in the staking contract until your unlock period ends.

`,
      status: '[TERMS.LOADED]',
      subQuestions: [
        {
          id: 'SUB_003_A',
          command: '>> SUB.QUERY: APY.Current',
          title: 'What are the current staking returns?',
          response: `CALCULATING ...
          
RL80 staking does not offer a fixed or guaranteed rate of return.

Rewards are paid in ETH and depend on how much ETH is routed into the staking contract from the RL80 tax and rewards infrastructure. The amount you earn is proportional to your share of the total staked supply and the timing of distributions—but it is not a set yield like a bank interest rate.

Because rewards come from real on-chain activity (e.g., taxes converted to ETH via the rewards splitter), the effective return can vary over time and is influenced by market conditions and token flow.

You can view your pending rewards in the staking interface before claiming.

 `,
          status: '[REWARDS.CALCULATED]'
        },
        {
          id: 'SUB_003_B',
          command: '>> SUB.QUERY: Rewards.Distribution',
          title: 'Where do staking rewards come from?',
          response: `LOADING DISTRIBUTION LOGIC...

Staking rewards are paid in ETH. ETH is routed into the staking contract from RL80’s tax flow via a distributor module that swaps collected RL80 for ETH and forwards a share to stakers.
`,
          status: '[DISTRIBUTION.ACTIVE]'
        },
        {
          id: 'SUB_003_C',
          command: '>> SUB.QUERY: Reward.Mechanism',
          title: 'How are rewards calculated?',
          response: `ANALYZING ...

Rewards are distributed proportionally based on how much RL80 you have staked and for how long. The contract uses a cumulative per-token accounting model so rewards remain fair across deposits and withdrawals.

 `,
          status: '[REWARDS.CALCULATED]'
        },
                {
          id: 'SUB_003_D',
          command: '>> SUB.QUERY: LOCK.Mechanism',
          title: 'Is there a lockup?',
          response: `ANALYZING ...

Yes. Staked RL80 has a 7-day lock. Staking again extends your unlock time forward.
 `,
          status: '[LOCKUP.CLARIFIED]'
        }
        ,
                {
          id: 'SUB_003_E',
          command: '>> SUB.QUERY: CLAIM.Mechanism',
          title: 'When can I claim?',
          response: `ANALYZING ...

You can claim at any time while the contract is active, as long as your claim meets the minimum claim threshold (to reduce gas-inefficient micro-claims).
 `,
          status: '[REWARDS.CALCULATED]'
        }
        ,
                {
          id: 'SUB_003_F',
          command: '>> SUB.QUERY: CLAIM.Mechanism',
          title: 'What happens if rewards arrive when TVL is low?',
          response: `ANALYZING ...

Yes. You can claim your staking rewards whenever you choose, as long as your accrued rewards meet the minimum claim amount.

Because claiming requires an on-chain transaction, a minimum threshold is used to help prevent gas-inefficient micro-claims. You remain in full control of when to claim. `,
          status: '[REWARDS.CALCULATED]'
        }
      ]
    },
    {
      id: 'QUERY_004',
      command: '> QUERY: Burn.Protocol',
      title: 'Candle Burning',
      response: ` INITIALIZING METANARRATIVE...
To burn a candle, visit the /illumin80 page and follow the on-screen steps.
Burning RL80 is optional and accessible—any amount may be burned to participate. Each burn lights a candle and adds your message to the shrine.

Each candle burns for 7 days.

Only one candle may be active per wallet at a time.
If you burn again before your candle expires, your new candle replaces the existing one—renewing your light rather than stacking visibility.
      `,
      status: '[PROTOCOL.READY]',
      subQuestions: [
        {
          id: 'SUB_004_A',
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
          id: 'SUB_004_B',
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

INITIAL SUPPLY: 80B RL80`,
          status: '[IMPACT.POSITIVE]'
        }
      ]
    },
    
    {
      id: 'QUERY_005',
      command: '> QUERY: Legal.Compliance',
      title: 'Legal and Tax Info',
      response: ` CONNECTING TO LEGAL ADVISOR..

Legal framework and compliance:


• Terms of service enforced


 `,
      status: '[SUPPORT.ONLINE]',
      subQuestions: [
        {
          id: 'SUB_007_A',
          command: '>> SUB.QUERY: Regulatory.Status',
          title: 'What is the regulatory compliance?',
          response: `CHECKING COMPLIANCE STATUS...

`,
          status: '[COMPLIANCE.VERIFIED]'
        },
        {
          id: 'SUB_007_B',
          command: '>> SUB.QUERY: Terms.Service',
          title: 'What are the terms of service?',
          response: `LOADING LEGAL DOCUMENTS...

Key Terms:
• 18+ years required
• No financial advice provided
• User assumes all risks
`,
          status: '[TERMS.DISPLAYED]'
        },
        {
          id: 'SUB_007_C',
          command: '>> SUB.QUERY: Privacy.Policy',
          title: 'How is my data protected?',
          response: `ACCESSING PRIVACY PROTOCOLS...

Data Protection:
• No personal data stored on-chain
• No data sold to third parties
• Right to deletion honored
`,
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