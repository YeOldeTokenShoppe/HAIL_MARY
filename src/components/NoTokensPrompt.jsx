'use client';

import React from 'react';

const NoTokensPrompt = ({ onBuy, onClose, message = "You need RL80 tokens to continue." }) => {
  return (
    <div
      style={{
        background: 'rgba(20, 20, 30, 0.98)',
        border: '1px solid rgba(0, 245, 212, 0.4)',
        borderRadius: '24px',
        padding: '1rem',
        maxWidth: '420px',
        textAlign: 'center',
        color: '#fff',
        boxShadow: '0 0 60px rgba(0, 245, 212, 0.3)',
        position: 'relative',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button */}
      <button
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'transparent',
          border: 'none',
          color: '#00f5d4',
          fontSize: '2rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        onClick={onClose}
        onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
      >
        ×
      </button>

      {/* Title */}
      <h2 style={{
        fontFamily: "'Orbitron', monospace",
        fontSize: '1.2rem',
        fontWeight: '700',
        color: '#fff',
        textTransform: 'uppercase',
        letterSpacing: '3px',
        marginBottom: '1.5rem',
      }}>
        RL80 TOKENS REQUIRED
      </h2>

      {/* Description */}
      <p style={{
        color: '#00f5d4',
        fontSize: '1.1rem',
        marginBottom: '2rem',
        lineHeight: '1.5',
      }}>
        {message}
      </p>

      {/* Icon */}
      <div style={{ marginBottom: '2rem' }}>
        <img
          src="/images/COIN_TATTOO.webp"
          alt="RL80 Token"
          style={{
            width: '80px',
            height: '80px',
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 20px rgba(0, 245, 212, 0.6))'
          }}
        />
      </div>

      {/* Buy Button */}
      <button
        onClick={onBuy}
        style={{
          padding: '1rem 2rem',
          background: '#00f5d4',
          border: 'none',
          borderRadius: '50px',
          color: '#000',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: 'pointer',
          width: '100%',
          fontFamily: "'Orbitron', monospace",
          letterSpacing: '1px',
          transition: 'all 0.2s',
          marginBottom: '1rem',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(0, 245, 212, 0.9)';
          e.target.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = '#00f5d4';
          e.target.style.transform = 'translateY(0)';
        }}
      >
        Buy RL80 Tokens
      </button>

      {/* Secondary link */}
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '0.9rem',
          cursor: 'pointer',
          padding: '0.5rem 1rem',
          transition: 'color 0.3s',
          textDecoration: 'underline',
        }}
        onMouseEnter={(e) => {
          e.target.style.color = 'rgba(255, 255, 255, 0.8)';
        }}
        onMouseLeave={(e) => {
          e.target.style.color = 'rgba(255, 255, 255, 0.5)';
        }}
      >
        Maybe Later
      </button>
    </div>
  );
};

export default NoTokensPrompt;
