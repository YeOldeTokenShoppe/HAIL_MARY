"use client";

import React from 'react';
import Link from 'next/link';

const Footer = ({ isMobile = false }) => {
  // Helper function to get responsive values
  const getResponsiveValue = (mobile, tablet, tabletLandscape, desktop) => {
    if (isMobile) return mobile;
    return desktop;
  };

  return (
    <footer style={{
      marginTop: '8rem',
      padding: '8rem 2rem 2rem 2rem',
      background: 'linear-gradient(to bottom, rgba(234, 124, 14, 0.0), rgba(14, 84, 234, 0.6))',
      color: '#ffffff',
      textAlign: 'center',
      position: 'relative',
      bottom: '-1.2rem',
      zIndex: 1
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Footer Title with Coin */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
             fontFamily: 'Cyber, monospace',
          gap: '2rem',
          marginTop: isMobile ? '1rem' : '3rem',
        }}>
          {/* Coin positioned above title */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
          }}>
            {/* <CircularCTA
              text="• PREME EMERE • CLICK TO BUY • PREME EMERE • CLICK TO BUY • PREME EMERE • CLICK TO BUY"
              href="/trade"
              accentColor="#00ff00"
              bgColor="none"
              size={200}
              textSize={isMobile ? 7 : 7}
            /> */}
          </div>
                     <h1 className='custom-title footer-title'
              id="main-title"
              style={{ 
              position: "relative",
              // left: isMobile ? "5%" : "10%",
              color: "#d4af37",
                // color: "#00ff00",
                  // colors={["#00ff00"]}
              textShadow: `
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
              fontSize: getResponsiveValue("3rem", "3rem", "3rem", "3rem"),
              fontWeight: 900,
              lineHeight: 0.8,
              transform: isMobile ? "rotate(-5deg)" : "rotate(-8deg) skew(-15deg)",
              zIndex: 10,
              whiteSpace: isMobile ? 'normal' : 'nowrap',
              cursor: 'pointer',
              margin: 0,
              pointerEvents: 'auto',
            }}>
              <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
              <span className="title-line" style={{ display: 'block', position: 'relative' }}>
                <span style={{ fontSize: isMobile ? "1.2rem" : "1.5rem" }}>of    </span>
                Perpetual
              </span>
              <span className="title-line" style={{ display: 'block', marginLeft: isMobile ? "0rem" : "0rem", position: 'relative' }}>Profit</span>
            </h1>
        </div>
        
        {/* Divider */}
        <div style={{
          width: '100px',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
          margin: '1.5rem auto'
        }} />
        
        {/* Contact Link */}
        <div style={{
          marginBottom: '2rem'
        }}>
          <Link href="/contact" style={{
            color: '#d4af37',
            textDecoration: 'none',
            fontSize: '1.2rem',
            fontFamily: 'Cyber, monospace',
            transition: 'all 0.3s ease',
            textShadow: '0 0 5px rgba(212, 175, 55, 0.3)',
            display: 'inline-block',
            padding: '0.5rem 1.5rem',
            border: '1px solid rgba(212, 175, 55, 0.5)',
            borderRadius: '20px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.1)';
            e.currentTarget.style.textShadow = '0 0 10px rgba(212, 175, 55, 0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.textShadow = '0 0 5px rgba(212, 175, 55, 0.3)';
          }}>
            Contact
          </Link>
        </div>
        
        {/* Blessing Text */}
        <p style={{
          fontSize: '1rem',
          fontStyle: 'italic',
          opacity: 0.8,
          marginBottom: '1.5rem',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
          "May your gains be eternal and your losses forgotten"
        </p>
        
        {/* Copyright */}
        <p style={{
          fontSize: '0.9rem',
          opacity: 0.6,
          fontFamily: 'Cyber, monospace'
        }}>
          © 2025 All rights reserved.
        </p>
        
        {/* Decorative Elements */}
        <div style={{
          marginTop: '1.5rem',
          fontSize: '1.5rem',
          color: '#d4af37',
          opacity: 0.7
        }}>
          ✦ ✦ ✦
        </div>
      </div>
    </footer>
  );
};

export default Footer;