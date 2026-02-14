'use client';
import React, { useState, useRef, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

const CONTRACT_ADDRESS = "0x30D01555d88c76500a82754A1D53cAc082A6CB75";

export default function CyberTokenomicsSection({ isMobile }) {
  const [activeCard, setActiveCard] = useState(null);
  const [copied, setCopied] = useState(false);
  const chartRef = useRef(null);
  const isInView = useInView(chartRef, { once: true, threshold: 0.3 });
  const [chartData, setChartData] = useState(null);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Initial token distribution (fixed, not phase-dependent)
  const tokenDistribution = {
    title: 'TOKEN DISTRIBUTION',
    subtitle: 'INITIAL SUPPLY ALLOCATION',
    total: '80B',
    data: [
      {
        id: 'TOKEN001',
        title: 'LIQUIDITY POOL',
        percentage: 80,
        amount: '64B',
        color: '#00ff00',
        description: 'Locked liquidity ensuring deep markets and stable trading from day one',
        details: [
          'Permanently locked LP',
          'DEX liquidity depth',
          'Price stability foundation',
          'Slippage minimization'
        ],
        status: 'LOCKED',
        securityLevel: 'MAXIMUM',
      },
      {
        id: 'TOKEN002',
        title: 'TREASURY',
        percentage: 12,
        amount: '9.6B',
        color: '#ffd700',
        description: 'Strategic reserves for development, partnerships, and ecosystem growth',
        details: [
          'Development funding',
          'Partnership acquisitions',
          'Emergency reserves',
          'Ecosystem expansion'
        ],
        status: 'SECURED',
        securityLevel: 'HIGH',
      },
      {
        id: 'TOKEN003',
        title: 'MARKETING',
        percentage: 8,
        amount: '6.4B',
        color: '#d946ef',
        description: 'Growth acceleration, exchange listings, and community building',
        details: [
          'CEX listing fees',
          'Influencer campaigns',
          'Community events',
          'Brand awareness'
        ],
        status: 'ACTIVE',
        securityLevel: 'STANDARD',
      },
    ],
  };

  const tokenomicsData = tokenDistribution.data;

  // Set up Chart.js data when component mounts and comes into view
  useEffect(() => {
    if (isInView) {
      setChartData({
        labels: tokenDistribution.data.map(item => item.title),
        datasets: [
          {
            data: tokenDistribution.data.map(item => item.percentage),
            backgroundColor: tokenDistribution.data.map(item => item.color),
            borderColor: tokenDistribution.data.map(item => item.color),
            borderWidth: 2,
            hoverBorderWidth: 4,
          },
        ],
      });
    }
  }, [isInView]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    animation: {
      animateRotate: true,
      animateScale: false,
      duration: 1500,
      easing: 'easeOutQuart',
      delay: (context) => {
        return context.dataIndex * 300;
      },
    },
    elements: {
      arc: {
        borderWidth: 2,
        hoverBorderWidth: 4,
      },
    },
    interaction: {
      intersect: false,
    },
  };

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Contract Renounced + Zero Tax Banner */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.9)',
        border: '2px solid #00ff00',
        borderRadius: '5px',
        padding: isMobile ? '16px' : '20px 25px',
        marginBottom: '30px',
        boxShadow: '0 0 25px rgba(0, 255, 0, 0.5), inset 0 0 15px rgba(0, 255, 0, 0.05)',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '10px',
          flexWrap: 'wrap',
        }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            background: 'rgba(0, 255, 0, 0.15)',
            border: '1px solid #00ff00',
            borderRadius: '3px',
            color: '#00ff00',
            fontSize: isMobile ? '11px' : '13px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}>
            CONTRACT RENOUNCED
          </span>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            background: 'rgba(255, 215, 0, 0.15)',
            border: '1px solid #ffd700',
            borderRadius: '3px',
            color: '#ffd700',
            fontSize: isMobile ? '11px' : '13px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}>
            0% TAX
          </span>
        </div>
        <p style={{
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: isMobile ? '11px' : '12px',
          fontFamily: 'monospace',
          lineHeight: '1.5',
          margin: 0,
        }}>
          Ownership has been permanently renounced. All transaction taxes have been removed. No admin can modify the contract.
        </p>
      </div>

      <div style={{
        background: 'rgba(5, 10, 15, 0.9)',
        border: '1px solid rgba(0, 255, 170, 0.7)',
        borderRadius: '5px',
        padding: isMobile ? '12px' : '15px 20px',
        marginBottom: '30px',
        boxShadow: '0 0 15px rgba(0, 255, 170, 0.7)',
      }}>
        {/* Contract Address Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '10px',
        }}>
          <div style={{
            color: '#ffd700',
            fontSize: isMobile ? '10px' : '11px',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            RL80 Contract Address (Base)
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#00ff00',
              animation: 'pulse 1.5s infinite',
            }} />
            <span style={{
              color: '#00ff00',
              fontFamily: 'monospace',
              fontSize: isMobile ? '9px' : '10px',
              letterSpacing: '0.5px',
            }}>
              VERIFIED
            </span>
          </div>
        </div>

        {/* Copyable Contract Address */}
        <div
          onClick={copyToClipboard}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '10px 12px',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '4px',
            border: '1px solid rgba(0, 255, 170, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 255, 170, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(0, 255, 170, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
            e.currentTarget.style.borderColor = 'rgba(0, 255, 170, 0.3)';
          }}
        >
          <code style={{
            color: '#0fa',
            fontSize: isMobile ? '10px' : '13px',
            fontFamily: 'monospace',
            letterSpacing: '0.5px',
            wordBreak: 'break-all',
          }}>
            {CONTRACT_ADDRESS}
          </code>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            background: copied ? 'rgba(0, 255, 0, 0.2)' : 'rgba(0, 255, 170, 0.15)',
            borderRadius: '3px',
            border: copied ? '1px solid #00ff00' : '1px solid rgba(0, 255, 170, 0.4)',
            flexShrink: 0,
            transition: 'all 0.2s ease',
          }}>
            <span style={{
              color: copied ? '#00ff00' : '#0fa',
              fontSize: '10px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
            }}>
              {copied ? '✓ COPIED' : 'COPY'}
            </span>
          </div>
        </div>

        {/* Verification Warning */}
        <div style={{
          marginTop: '10px',
          padding: '8px 10px',
          background: 'rgba(255, 215, 0, 0.08)',
          borderRadius: '3px',
          borderLeft: '3px solid #ffd700',
        }}>
          <div style={{
            color: 'rgba(255, 215, 0, 0.9)',
            fontSize: isMobile ? '9px' : '10px',
            fontFamily: 'monospace',
            lineHeight: '1.4',
          }}>
            Always verify the contract address before buying. Only purchase RL80 through official links or by pasting this exact address.
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        <div>
          <h3 style={{
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: 'bold',
            backgroundImage: 'linear-gradient(135deg, #66ff00 0%, #00ff00 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '8px',
            fontFamily: 'Fjalla One !important',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textAlign: 'center',
            filter: 'drop-shadow(0 0 10px rgba(0, 255, 0, 0.5))',
          }}>
            :: {tokenDistribution.title} ::
          </h3>
          <div style={{
            textAlign: 'center',
            marginBottom: '20px',
            color: 'rgba(0, 255, 0, 0.8)',
            fontSize: '11px',
            fontFamily: 'monospace',
            letterSpacing: '1px',
          }}>
            {tokenDistribution.subtitle}
          </div>

          <div style={{ position: 'relative', marginBottom: '30px' }}>
            <div
              ref={chartRef}
              style={{
                position: 'relative',
                width: isMobile ? '280px' : '320px',
                height: isMobile ? '280px' : '320px',
                margin: '0 auto'
              }}
            >
              {/* Chart.js Animated Donut Chart */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                filter: 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.5))',
                borderRadius: '50%',
              }}>
                {chartData && (
                  <Pie
                    data={chartData}
                    options={chartOptions}
                    style={{
                      filter: 'drop-shadow(0 0 20px rgba(0, 255, 170, 0.3))',
                    }}
                  />
                )}

                {/* Center text overlay with background */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  background: 'rgba(0, 0, 0, 0.8)',
                  borderRadius: '50%',
                  width: isMobile ? '100px' : '120px',
                  height: isMobile ? '100px' : '120px',
                  border: '2px solid rgba(0, 255, 0, 0.3)',
                  backdropFilter: 'blur(10px)',
                }}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      fontSize: isMobile ? '1.8em' : '2.2em',
                      fontWeight: '800',
                      color: '#ffd700',
                      lineHeight: '1',
                      textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
                      fontFamily: 'monospace',
                    }}
                  >
                    80B
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    style={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: isMobile ? '0.55em' : '0.65em',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      fontFamily: 'monospace',
                      marginTop: '2px',
                      textAlign: 'center',
                    }}
                  >
                    TOTAL
                  </motion.div>
                </div>
              </div>

              {tokenomicsData.map((item, index) => {
                const totalPercentage = tokenomicsData.reduce((sum, d) => sum + d.percentage, 0);
                const previousPercentage = tokenomicsData.slice(0, index).reduce((sum, d) => sum + d.percentage, 0);
                const segmentCenter = previousPercentage + (item.percentage / 2);

                const angleInDegrees = (segmentCenter / totalPercentage) * 360 - 90;
                const angleInRadians = (angleInDegrees * Math.PI) / 180;

                const radius = 58;
                const centerX = 50;
                const centerY = 50;
                const x = centerX + radius * Math.cos(angleInRadians);
                const y = centerY + radius * Math.sin(angleInRadians);

                const isRightSide = x > 50;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 * index }}
                    style={{
                      position: 'absolute',
                      top: `${y}%`,
                      left: isRightSide ? 'auto' : `${x - 15}%`,
                      right: isRightSide ? `${100 - x - 15}%` : 'auto',
                      transform: 'translateY(-50%)',
                      padding: '10px 15px',
                      background: 'rgba(0, 0, 0, 0.9)',
                      borderRadius: '8px',
                      border: `1px solid ${item.color}`,
                      backdropFilter: 'blur(10px)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: `0 0 20px ${item.color}40`,
                    }}
                    whileHover={{
                      scale: 1.05,
                      boxShadow: `0 0 30px ${item.color}60`,
                    }}
                    onClick={() => setActiveCard(activeCard === item.id ? null : item.id)}
                  >
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: item.color,
                      marginBottom: '4px',
                      fontFamily: 'monospace'
                    }}>
                      {`${item.percentage}%`}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.9)',
                      whiteSpace: 'nowrap',
                      fontFamily: 'monospace',
                      letterSpacing: '1px'
                    }}>
                      {item.title}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: item.color,
                      marginTop: '2px',
                      fontFamily: 'monospace'
                    }}>
                      {item.amount}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {activeCard && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'rgba(10, 15, 25, 0.95)',
                border: `1px solid ${tokenomicsData.find(d => d.id === activeCard)?.color}`,
                borderRadius: '10px',
                padding: '20px',
                marginBottom: '30px',
                boxShadow: `0 0 30px ${tokenomicsData.find(d => d.id === activeCard)?.color}40`,
              }}
            >
              {(() => {
                const card = tokenomicsData.find(d => d.id === activeCard);
                return (
                  <>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '15px'
                    }}>
                      <h4 style={{
                        color: card.color,
                        fontSize: '16px',
                        fontFamily: 'Blackletter, serif !important',
                        margin: 0
                      }}>
                        {card.title}
                      </h4>
                      <span style={{
                        color: '#f55',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}>
                        SEC: {card.securityLevel}
                      </span>
                    </div>
                    <p style={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: '12px',
                      marginBottom: '15px',
                      fontFamily: 'monospace',
                      lineHeight: '1.5'
                    }}>
                      {card.description}
                    </p>
                    <div style={{
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                      paddingTop: '15px'
                    }}>
                      {card.details.map((detail, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: card.color,
                            flexShrink: 0
                          }} />
                          <span style={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                          }}>
                            {detail}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '15px',
                      paddingTop: '15px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <span style={{
                        color: '#0fa',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}>
                        ALLOCATION: {card.amount}
                      </span>
                      <span style={{
                        color: card.status === 'LOCKED' ? '#f55' : '#0fa',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}>
                        STATUS: {card.status}
                      </span>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}
        </div>
      </div>

      {/* TL;DR Section */}
      <div style={{
        marginTop: '3rem',
        padding: isMobile ? '20px' : '25px 30px',
        background: 'rgba(5, 10, 15, 0.95)',
        border: '1px solid rgba(0, 255, 170, 0.5)',
        borderRadius: '8px',
        boxShadow: '0 0 25px rgba(0, 255, 170, 0.15)',
      }}>
        <h3 style={{
          fontSize: isMobile ? '16px' : '18px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #ffd700 0%, #00ff00 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '20px',
          fontFamily: 'Fjalla One, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          textAlign: 'center',
          filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.4))',
        }}>
          RL80 Tokenomics — TL;DR
        </h3>

        <div style={{
          display: 'grid',
          gap: '12px',
        }}>
          {[
            { icon: '🔒', text: 'Fixed supply — 80B forever', color: '#ffd700' },
            { icon: '✓', text: 'Contract renounced — no admin, no changes, fully immutable', color: '#00ff00' },
            { icon: '✓', text: '0% tax on ALL transactions (buy, sell, and transfer)', color: '#00ff00' },
            { icon: '🔥', text: 'Deflationary — tokens burned permanently via candle offerings', color: '#0fa' },
            { icon: '🛡️', text: 'No minting • No wallet freezes • No hidden taxes • No admin keys', color: '#ffd700' },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {item.icon && (
                <span style={{
                  fontSize: '14px',
                  width: '22px',
                  textAlign: 'center',
                }}>
                  {item.icon}
                </span>
              )}
              <span style={{
                color: item.color,
                fontSize: isMobile ? '12px' : '13px',
                fontFamily: 'monospace',
                letterSpacing: '0.5px',
              }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(0, 255, 170, 0.2)',
          textAlign: 'center',
        }}>
          <span style={{
            color: '#0fa',
            fontSize: isMobile ? '11px' : '12px',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            fontStyle: 'italic',
          }}>
            Simple, immutable, on-chain.
          </span>
        </div>
      </div>

      {/* Verification Links */}
      <div style={{
        marginTop: '2rem',
        padding: '20px',
        background: 'rgba(5, 10, 15, 0.9)',
        border: '1px solid rgba(0, 255, 170, 0.3)',
        borderRadius: '5px',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '15px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '11px',
          fontFamily: 'monospace',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          Verify Contract
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}>
          <a
            href={`https://basescan.org/token/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 15px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 170, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(0, 255, 170, 0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <img
              src="/images/baseScan.svg"
              alt="BaseScan"
              style={{
                height: '24px',
                width: 'auto',
                filter: 'brightness(0.9)',
              }}
            />
          </a>
          <a
            href="https://dexscreener.com/base/0x40d827acdbefd8ef46953e2b1ac87b8697b82203"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 15px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 170, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(0, 255, 170, 0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <img
              src="/images/dexscreener.webp"
              alt="DexScreener"
              style={{
                height: '24px',
                width: 'auto',
                filter: 'brightness(0.9)',
              }}
            />
          </a>
          <a
            href="https://tokensniffer.com/token/base/0x30d01555d88c76500a82754a1d53cac082a6cb75"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 15px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 170, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(0, 255, 170, 0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <img
              src="/images/tokensniffer.webp"
              alt="TokenSniffer"
              style={{
                height: '24px',
                width: 'auto',
                filter: 'brightness(0.9)',
              }}
            />
          </a>

        </div>

      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}
