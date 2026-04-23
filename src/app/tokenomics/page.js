"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import SkewedHeading from "@/components/SkewedHeading";
import CyberStatsSection from '@/components/CyberStatsSection';
import CyberTokenomicsSection from '@/components/CyberTokenomicsSection';
import CyberFAQSection from '@/components/CyberFAQSection';
import CoinLoader from '@/components/CoinLoader';
import { useMusic } from '@/components/MusicContext';
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import NavControlsHome from '@/components/NavControlsHome';
import MobileBottomNav from '@/components/MobileBottomNav';
import CyberNav from '@/components/CyberNav';
import Link from 'next/link';
import Footer from '@/components/Footer';
import BuyModal from '@/components/BuyModal';


export default function TokenomicsPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSceneLoading, setIsSceneLoading] = useState(true);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [showMusicControls, setShowMusicControls] = useState(false);
  const [emoji, setEmoji] = useState("😇");
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsMobileDevice(width <= 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

    // Emoji animation
  useEffect(() => {
    const emojiInterval = setInterval(() => {
      setEmoji((prevEmoji) => (prevEmoji === "😇" ? "😈" : "😇"));
    }, 3000);
    return () => clearInterval(emojiInterval);
  }, []);

  // Since this page doesn't have a 3D model, we can set loading to false after fonts load
  useEffect(() => {
    if (fontLoaded) {
      setTimeout(() => {
        setIsSceneLoading(false);
      }, 500); // Small delay for smooth transition
    }
  }, [fontLoaded]);

  // Get user auth state
  const { user, isSignedIn } = useUser();

  // Get music context functions
  const {
    play,
    pause,
    isPlaying: contextIsPlaying,
    nextTrack,
    currentTrack,
    is80sMode,
    setIs80sMode
  } = useMusic();
    

    
      // Font loading effect
      useEffect(() => {
        const checkFont = async () => {
          try {
            await document.fonts.load("1em 'UnifrakturCook'");
            await document.fonts.load("1em 'UnifrakturMaguntia'");
            await document.fonts.load("1em 'Fjalla One'");
            setFontLoaded(true);
            document.body.classList.add('fonts-loaded');
          } catch (e) {
            setTimeout(() => {
              setFontLoaded(true);
              document.body.classList.add('fonts-loaded');
            }, 1000);
          }
        };
        checkFont();
      }, []);

  return (
    <>   
    
    <CoinLoader loading={isSceneLoading} />
    
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(ellipse at 50% 0%, rgba(0, 60, 40, 0.4) 0%, transparent 50%),
        radial-gradient(ellipse at 90% 25%, rgba(0, 50, 35, 0.2) 0%, transparent 35%),
        radial-gradient(ellipse at 10% 50%, rgba(0, 45, 30, 0.15) 0%, transparent 30%),
        radial-gradient(ellipse at 80% 85%, rgba(90, 50, 120, 0.2) 0%, transparent 35%),
        radial-gradient(ellipse at 20% 95%, rgba(120, 80, 40, 0.15) 0%, transparent 30%),
        radial-gradient(ellipse at 50% 100%, rgba(80, 50, 100, 0.25) 0%, transparent 45%),
        linear-gradient(180deg,
          #040a07 0%,
          #050c09 8%,
          #060e0a 20%,
          #07100b 35%,
          #080f0c 50%,
          #0a0d10 65%,
          #0c0a12 78%,
          #100a14 88%,
          #120a16 100%
        )
      `,
      padding: '80px 20px 40px',
    }}>
     
      {/* Our Lady of Perpetual Profit Logo (Desktop) / RL80 (Mobile) */}
      {!isSceneLoading && !isMobile && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 'auto',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          {mounted && !isSceneLoading && (
                <div
                  style={{
                    position: "absolute",
                    top: "20px",
                    right: "20px",
                    zIndex: 9,
                    pointerEvents: "auto"
                  }}
                >
                  <NavControlsHome
                    isPlaying={contextIsPlaying}
                    onPlayMusic={() => play()}
                    onStopMusic={() => pause()}
                    onSkipTrack={() => nextTrack()}
                    onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
                    onUserClick={() => {}}
                    isUserSignedIn={!!user}
                    isMenuOpen={isMenuOpen}
                    is80sMode={is80sMode}
                    onToggle80sMode={() => setIs80sMode(!is80sMode)}
                    onBuyClick={() => setShowBuyModal(true)}
                    isMobile={isMobileDevice}
                    show80sButton={false}
                  />
                </div>
                )}
                
          <div style={{
            position: 'relative',
            display: 'flex',
            // flexDirection: 'column',
            width: '100%',
            paddingTop: '2rem',
            pointerEvents: 'none',
            left: '2rem',
            // top: '2rem'
          }}>
            
           <h1 className='custom-title'
            id="main-title"
            // onClick={() => router?.push('/about')}
            style={{ 
              pointerEvents: 'auto',  // Enable clicks on the title
              color: is80sMode ? "#ffffff" : "#d4af37",
              fontFamily: 'UnifrakturCook, serif',
              textShadow: is80sMode 
                ? `
                  0 0 20px rgba(201, 55, 255, 0.9),
                  0 0 40px rgba(201, 55, 255, 0.8),
                  0 0 60px rgba(201, 55, 255, 0.7),
                  4px 4px 12px rgba(201, 55, 255, 1),
                  -2px -2px 8px rgba(255, 0, 255, 0.8),
                  0 0 100px rgba(201, 55, 255, 0.5)
                `
                : `
                  rgba(83, 61, 74, 0.9) 1px 1px,
                  rgba(83, 61, 74, 0.9) 2px 2px,
                  rgba(83, 61, 74, 0.8) 3px 3px,
                  rgba(83, 61, 74, 0.8) 4px 4px,
                  rgba(83, 61, 74, 0.7) 5px 5px,
                  rgba(83, 61, 74, 0.7) 6px 6px,
                  rgba(83, 61, 74, 0.6) 7px 7px,
                  rgba(83, 61, 74, 0.6) 8px 8px,
                  rgba(255, 192, 203, 0.4) -1px -1px 5px,
                  rgba(0, 0, 0, 0.8) 10px 10px 15px
                `,
              fontSize: "3rem",
              fontWeight: 900,
              lineHeight: 0.8,
              transform: "rotate(-8deg) skew(-15deg)",
              cursor: 'pointer',
              margin: 0,
              marginBottom: '20px',
            }}
          >
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>
              <span style={{ fontSize: "2rem" }}>of    </span>
              Perpetual
            </span>
            <span className="title-line" style={{ display: 'block', marginLeft: "4rem", position: 'relative' }}>Profit</span>
          </h1>

          </div>
        </div>
      )}
      
      {/* RL80 Logo - Mobile Only */}
      {!isSceneLoading && isMobile && (
        <>
          {/* Mobile Bottom Nav */}
          <MobileBottomNav
            isPlaying={contextIsPlaying}
            onPlayMusic={() => play()}
            onStopMusic={() => pause()}
            onSkipTrack={() => nextTrack()}
            onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
            onUserClick={() => {}}
            isUserSignedIn={!!user}
            isMenuOpen={isMenuOpen}
            is80sMode={is80sMode}
            userImage={user?.imageUrl}
            onBuyClick={() => setShowBuyModal(true)}
            isMobile
            show80sButton={false}
            darkMode
          />

          {/* RL80 Logo */}
          <div style={{
            position: "absolute",
            top: "20px", 
            left: "0.5rem",
            borderRadius: "8px",
            padding: "10px",
            pointerEvents: "auto",
            zIndex: 1,
          }}>
            <div 
              id="text"
              className="logo-text"
                   style={{
                position: "relative",
                fontFamily: "'UnifrakturMaguntia', serif",
                fontSize: "3rem",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              <Link href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
                RL80
              </Link>
              {Array.from({length: 100}).map((_, i) => {
                const index = i + 1;
                return (
                 <div
                    key={index}
                    className="text__copy"
                    style={{
                      position: "absolute",
                      pointerEvents: "none",
                      zIndex: -1,
                      top: 0,
                      left: 0,
                      color: is80sMode 
                        ? `rgba(${201 - index * 2}, ${55 - index * 3}, ${256 - index * 2})` 
                        : `rgba(${255 - index * 2}, ${255 - index * 3}, ${255 - index * 2})`,
                      filter: "blur(0.1rem)",
                      transform: `translate(
                        ${index * 0.1}rem, 
                        ${index * 0.1}rem
                      ) scale(${1 + index * 0.01})`,
                      opacity: (1 / index) * 1.5,
                    }}
                  >
                    RL80
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

            <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          style={{
            position: 'relative',
            margin: '4rem auto',
            width: isMobile ? '95%' : '90%',
            maxWidth: '1200px',
            zIndex: 1,
            pointerEvents: 'auto'
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 20, 0, 0.4))',
            border: '2px solid #00ff00',
            borderRadius: '0',
            padding: isMobile ? '30px 20px' : '40px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 40px rgba(0, 255, 0, 0.3), inset 0 0 40px rgba(0, 255, 0, 0.05)',
            position: 'relative',
            overflow: 'visible'
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

            {/* Glow effect */}
            <div style={{
              content: '',
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'radial-gradient(circle, rgba(0, 255, 0, 0.05) 0%, transparent 70%)',
              animation: 'statsRotate 30s linear infinite',
              zIndex: 0
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Section Header - Cyber-Gothic Fusion */}
              <div style={{
                textAlign: 'center',
                marginBottom: '40px',
                position: 'relative'
              }}>
                {/* Terminal frame top */}
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: isMobile ? '11px' : '13px',
                  color: '#00ff00',
                  textAlign: 'center',
                  marginBottom: '15px',
                  opacity: 0.6,
                  letterSpacing: '2px'
                }}>
                  {'< '} SYSTEM://PROTOCOL/ECONOMICS {' >'}
                </div>
                
                {/* Gothic heading with cyber gradient */}
        {/* <SkewedHeading 
    lines={["TOKENOMICS"]}
    colors={["#00ff00"]} 
    fontSize={{ mobile: "2.5rem", desktop: "3rem" }}
    isMobile={isMobile}
    useGradient={true}
    gradientColors={['#ffd700', '#00ff00']} // Gold to green gradient
  /> */}
                <SkewedHeading 
    lines={["TOKENOMICS"]}
    // colors={["#d4af37", "#f4e4c1", "#ffd700"]}
        colors={["#00ff00"]}
    fontSize={{ mobile: "2.5rem", desktop: "3rem" }}
    isMobile={isMobile}
  />

                
                {/* ASCII decorative elements */}
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#00ff00',
                  textAlign: 'center',
                  opacity: 0.4,
                  marginTop: '10px',
                  marginBottom: '15px',
                  letterSpacing: '1px'
                }}>
                  ═══════════╬═══════════
                </div>
                
                {/* Subtitle with terminal brackets */}
                <p style={{
                  color: '#888',
                  fontSize: isMobile ? '0.8em' : '0.9em',
                  fontFamily: 'monospace',
                  letterSpacing: '2px',
                  textTransform: 'uppercase'
                }}>
                  [[ OUR LADY OF PERPETUAL PROFIT :: RL80 ]]
                </p>
              </div>

              {/* Stats Cards - Live On-Chain Data */}
              <div style={{ marginBottom: '50px' }}>
                <CyberStatsSection isMobile={isMobile} />
              </div>

              {/* Tokenomics Content - Cyber Style */}
              <div style={{ marginBottom: '50px' }}>
                <CyberTokenomicsSection isMobile={isMobile} />
              </div>
              
              {/* Old tokenomics section - keeping for reference, can be removed later */}
              <div style={{ display: 'none' }}>
                {/* Left Side - Pie Chart */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <div style={{
                    position: 'relative',
                    marginBottom: '30px'
                  }}>
                    <div style={{
                      position: 'relative',
                      width: isMobile ? '240px' : '280px',
                      height: isMobile ? '240px' : '280px',
                      margin: '0 auto'
                    }}>
                      {/* Pie Chart */}
                      <div style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: `conic-gradient(
                          from 0deg,
                          #00ff00 0deg 306deg,
                          #ffd700 306deg 342deg,
                          #d946ef 342deg 360deg
                        )`,
                        position: 'relative',
                        top: '2rem',
                        filter: 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.5))'
                      }}>
                        {/* Center circle with text */}
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: isMobile ? '120px' : '140px',
                          height: isMobile ? '120px' : '140px',
                          borderRadius: '50%',
                          background: 'rgba(0, 0, 0, 0.9)',
                          border: '2px solid rgba(0,255,0,0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <div style={{
                            fontSize: isMobile ? '2em' : '2.5em',
                            fontWeight: '800',
                            color: '#FFD700',
                            lineHeight: '1'
                          }}>
                            80B
                          </div>
                          <div style={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: isMobile ? '0.7em' : '0.8em',
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                          }}>
                            Total Supply
                          </div>
                        </div>
                      </div>
                      
                      {/* External labels */}
                      <div style={{
                        position: 'absolute',
                        top: '5%',
                        right: '-25px',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        borderRadius: '4px',
                        border: '1px solid #00ff00',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#00ff00',
                          marginBottom: '2px'
                        }}>
                          85%
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.9)',
                          whiteSpace: 'nowrap'
                        }}>
                          Liquidity Pool
                        </div>
                      </div>
                      
                      <div style={{
                        position: 'absolute',
                        top: '5%',
                        left: '-15px',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        borderRadius: '4px',
                        border: '1px solid #ffd700',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#ffd700',
                          marginBottom: '2px'
                        }}>
                          10%
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.9)',
                          whiteSpace: 'nowrap'
                        }}>
                          Treasury
                        </div>
                      </div>
                      
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        left: '35%',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        borderRadius: '4px',
                        border: '1px solid #d946ef',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#d946ef',
                          marginBottom: '2px'
                        }}>
                          5%
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.9)',
                          whiteSpace: 'nowrap'
                        }}>
                          Marketing / CEX
                        </div>
                      </div>
                    </div>
                    
                    {/* Distribution Label */}
                    <div style={{
                      textAlign: 'center',
                      marginTop: '40px'
                    }}>
                      <div style={{
                        fontSize: '1.1em',
                        fontWeight: '600',
                        color: '#FFD700',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        Distribution
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right Side - Tax Structure */}
                <div style={{
                  display: 'grid',
                  gap: '25px'
                }}>
                  {/* Tax Structure Box */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 215, 0, 0.2)',
                    borderRadius: '20px',
                    padding: '25px'
                  }}>
                    <h2 style={{
                      fontFamily: 'monospace',
                      fontSize: '1.2em',
                      fontWeight: 'bold',
                      marginBottom: '20px',
                      color: '#00ff00',
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                      textShadow: '0 0 10px rgba(0, 255, 0, 0.5)'
                    }}>
                      TAX STRUCTURE
                    </h2>
                    
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-around',
                      marginBottom: '25px'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: '3em',
                          fontWeight: '800',
                          color: '#00ff00',
                          textShadow: '0 0 15px rgba(0, 255, 0, 0.5)',
                          lineHeight: '1'
                        }}>
                          4%
                        </div>
                        <div style={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.9em',
                          marginTop: '5px'
                        }}>
                          Buy / Sell Tax
                        </div>
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                      gap: '15px'
                    }}>
                      <div style={{
                        background: 'rgba(255, 215, 0, 0.05)',
                        border: '1px solid rgba(255, 215, 0, 0.2)',
                        borderRadius: '12px',
                        padding: '15px',
                        textAlign: 'center',
                        transition: 'all 0.3s ease'
                      }}>
                        <div style={{ 
                          marginBottom: '8px',
                          color: '#00ff00',
                          display: 'flex',
                          justifyContent: 'center',
                          filter: 'drop-shadow(0 0 8px rgba(0, 255, 0, 0.5))'
                        }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/>
                            <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/>
                            <path d="m2 16 6 6"/>
                            <circle cx="16" cy="9" r="2.9"/>
                            <circle cx="6" cy="5" r="3"/>
                          </svg>
                        </div>
                        <div style={{
                          fontSize: '1.5em',
                          fontWeight: '700',
                          color: '#00ff00',
                          marginBottom: '5px'
                        }}>
                          2%
                        </div>
                        <div style={{
                          fontSize: '0.8em',
                          color: 'rgba(255, 255, 255, 0.7)'
                        }}>
                          Staking Rewards
                        </div>
                      </div>
                      
                      <div style={{
                        background: 'rgba(255, 215, 0, 0.05)',
                        border: '1px solid rgba(255, 215, 0, 0.2)',
                        borderRadius: '12px',
                        padding: '15px',
                        textAlign: 'center',
                        transition: 'all 0.3s ease'
                      }}>
                        <div style={{ 
                          marginBottom: '8px',
                          color: '#00ff00',
                          display: 'flex',
                          justifyContent: 'center',
                          filter: 'drop-shadow(0 0 8px rgba(0, 255, 0, 0.5))'
                        }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/>
                            <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>
                          </svg>
                        </div>
                        <div style={{
                          fontSize: '1.5em',
                          fontWeight: '700',
                          color: '#00ff00',
                          marginBottom: '5px'
                        }}>
                          1.5%
                        </div>
                        <div style={{
                          fontSize: '0.8em',
                          color: 'rgba(255, 255, 255, 0.7)'
                        }}>
                          Auto-Liquidity
                        </div>
                      </div>
                      
                      <div style={{
                        background: 'rgba(255, 215, 0, 0.05)',
                        border: '1px solid rgba(255, 215, 0, 0.2)',
                        borderRadius: '12px',
                        padding: '15px',
                        textAlign: 'center',
                        transition: 'all 0.3s ease'
                      }}>
                        <div style={{ 
                          marginBottom: '8px',
                          color: '#00ff00',
                          display: 'flex',
                          justifyContent: 'center',
                          filter: 'drop-shadow(0 0 8px rgba(0, 255, 0, 0.5))'
                        }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 11 18-5v12L3 14v-3z"/>
                            <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
                          </svg>
                        </div>
                        <div style={{
                          fontSize: '1.5em',
                          fontWeight: '700',
                          color: '#00ff00',
                          marginBottom: '5px'
                        }}>
                          0.5%
                        </div>
                        <div style={{
                          fontSize: '0.8em',
                          color: 'rgba(255, 255, 255, 0.7)'
                        }}>
                          Marketing
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
           

          {/* End of hidden old tokenomics section */}
                    <CyberFAQSection isMobile={isMobile} />
        </motion.div>



                              



      <style jsx global>{`
        @font-face {
          font-family: 'UnifrakturCook';
          src: url('/fonts/UnifrakturCook-Bold.ttf') format('truetype');
          font-weight: bold;
          font-style: normal;
          font-display: swap;
        }
        
        @font-face {
          font-family: 'UnifrakturMaguntia';
          src: url('/fonts/UnifrakturMaguntia-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        
        .logo-text {
          font-family: 'UnifrakturMaguntia', 'UnifrakturCook', serif !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .custom-title {
          font-family: 'UnifrakturCook', 'UnifrakturMaguntia', serif !important;
          visibility: visible !important;
          opacity: 1 !important;
          display: block !important;
        }

        .footer-title {
          font-family: 'UnifrakturCook', serif !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        .custom-title span {
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        @keyframes statsRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .spinning-record {
          animation: spin 3s linear infinite;
        }
      `}</style>

      {/* CyberNav Menu Panel */}
      <CyberNav
        is80sMode={is80sMode}
        position="fixed"
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        showButton={false}
      />

      {/* Buy Modal */}
      <BuyModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />

      <Footer is80sMode={is80sMode} />
    </div>
    </>
  );
}