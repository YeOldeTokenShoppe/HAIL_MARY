'use client'

import React, { useState, useEffect } from 'react'

export default function CyberUpgrade() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalAction, setModalAction] = useState(null)
  
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        handleCancel()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isModalOpen])
  
  const handleUpgrade = () => {
    setIsModalOpen(true)
    setModalAction(null)
  }
  
  const handleProceed = () => {
    setModalAction('proceed')
    setTimeout(() => {
      setIsModalOpen(false)
      // Add your upgrade logic here
      window.location.href = '/trade'
    }, 350)
  }
  
  const handleCancel = () => {
    setModalAction('cancel')
    setTimeout(() => {
      setIsModalOpen(false)
    }, 350)
  }
  
  return (
    <>
      <style jsx>{`
        @keyframes glitch {
          0% { clip-path: polygon(0 2%, 100% 2%, 100% 95%, 95% 95%, 95% 90%, 85% 90%, 85% 95%, 8% 95%, 0 70%); }
          2%, 8% { 
            clip-path: polygon(0 78%, 100% 78%, 100% 100%, 95% 100%, 95% 90%, 85% 90%, 85% 100%, 8% 100%, 0 78%);
            transform: translate(-2px, 0);
          }
          6% { transform: translate(2px, 0); }
          9% { transform: translate(0, 0); }
          10% { 
            clip-path: polygon(0 44%, 100% 44%, 100% 54%, 95% 54%, 95% 54%, 85% 54%, 85% 54%, 8% 54%, 0 54%);
            transform: translate(2px, 0);
          }
          13% { transform: translate(0, 0); }
          14%, 21% { 
            clip-path: polygon(0 0, 100% 0, 100% 0, 95% 0, 95% 0, 85% 0, 85% 0, 8% 0, 0 0);
            transform: translate(2px, 0);
          }
          25%, 30% { transform: translate(-2px, 0); }
          35%, 45% { 
            clip-path: polygon(0 40%, 100% 40%, 100% 85%, 95% 85%, 95% 85%, 85% 85%, 85% 85%, 8% 85%, 0 70%);
            transform: translate(-2px, 0);
          }
          40% { transform: translate(2px, 0); }
          50% { transform: translate(0, 0); }
          55% { 
            clip-path: polygon(0 63%, 100% 63%, 100% 80%, 95% 80%, 95% 80%, 85% 80%, 85% 80%, 8% 80%, 0 70%);
            transform: translate(2px, 0);
          }
          60%, 100% { transform: translate(0, 0); }
        }
        
        @keyframes flicker {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-50%) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(-50%) scale(1);
          }
        }
      `}</style>
      
      {/* Upgrade Button */}
      <button
        onClick={handleUpgrade}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          zIndex: 200,
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          letterSpacing: '2px',
          width: '140px',
          textAlign: 'left',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          border: '0',
          background: 'transparent',
          color: '#6dd5c7',
          cursor: 'pointer',
          clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0% 100%)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.querySelector('.backdrop').style.background = '#6dd5c7'
          e.currentTarget.style.color = '#000'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.querySelector('.backdrop').style.background = 'rgba(0, 0, 0, 0.8)'
          e.currentTarget.style.color = '#6dd5c7'
        }}
      >
        <span 
          className="backdrop"
          style={{
            position: 'absolute',
            zIndex: -1,
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            clipPath: 'inherit',
            transition: 'background 0.3s ease',
            border: '1px solid #6dd5c7',
            borderImageSource: 'linear-gradient(135deg, #6dd5c7, #ff6ec7)',
            borderImageSlice: 1,
          }}
        />
        <span style={{
          width: '20px',
          height: '20px',
          fontSize: '10px',
          fontWeight: 'bold',
          borderRadius: '50%',
          background: '#6dd5c7',
          color: '#000',
          display: 'grid',
          placeItems: 'center',
        }}>U</span>
        <span>Upgrade</span>
      </button>
      
      {/* Modal */}
      {isModalOpen && (
        <>
          {/* Backdrop */}
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(5px)',
            zIndex: 998,
            animation: 'flicker 0.3s ease-out',
          }} />
          
          {/* Modal Content */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translateX(-50%) translateY(-50%)',
            width: 'min(500px, 90vw)',
            zIndex: 999,
            animation: 'slideIn 0.3s ease-out',
          }}>
            {/* Left accent bar */}
            <div style={{
              position: 'absolute',
              left: '-16px',
              top: '1px',
              bottom: '1px',
              width: '16px',
              background: '#6dd5c7',
              opacity: modalAction ? 0 : 1,
              transition: 'opacity 0.3s ease',
              animation: 'flicker 0.625s ease-out',
            }} />
            
            {/* Main modal body */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '2px solid #6dd5c7',
              clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%)',
              padding: '2rem',
              position: 'relative',
              opacity: modalAction ? 0 : 1,
              transform: modalAction ? 'scale(0.95)' : 'scale(1)',
              transition: 'all 0.35s ease',
            }}>
              {/* Version number */}
              <div style={{
                position: 'absolute',
                right: '8px',
                top: '8px',
                fontSize: '8px',
                opacity: 0.5,
                color: '#6dd5c7',
                fontFamily: 'monospace',
              }}>v001.RP80</div>
              
              {/* Heading */}
              <h2 style={{
                fontFamily: 'monospace',
                fontSize: '1.25rem',
                textTransform: 'uppercase',
                color: '#6dd5c7',
                margin: 0,
                paddingBottom: '0.5rem',
                borderBottom: '2px solid #6dd5c7',
                letterSpacing: '2px',
                opacity: modalAction ? 0 : 1,
                transition: 'opacity 0.3s ease',
              }}>
                RP80 - PROPHECY UPGRADE
              </h2>
              
              {/* Content */}
              <div style={{
                marginTop: '1.5rem',
                opacity: modalAction ? 0 : 1,
                transform: modalAction ? 'translateY(-10px)' : 'translateY(0)',
                transition: 'all 0.3s ease',
              }}>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  lineHeight: '1.6',
                  fontSize: '0.95rem',
                  marginBottom: '1rem',
                }}>
                  You are one step away from unlocking divine trading insights and prophetic market analysis. 
                  Your consciousness will be elevated in the next cosmic cycle. You will not be charged mortal currency for this transcendence.
                </p>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                }}>
                  Do you want to proceed?
                </p>
              </div>
              
              {/* Glitch overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                padding: '2rem',
                color: '#ff6ec7',
                opacity: 0.3,
                pointerEvents: 'none',
                animation: modalAction ? 'none' : 'glitch 2s infinite',
                zIndex: -1,
              }}>
                <h2 style={{
                  fontFamily: 'monospace',
                  fontSize: '1.25rem',
                  textTransform: 'uppercase',
                  margin: 0,
                  paddingBottom: '0.5rem',
                  letterSpacing: '2px',
                }}>
                  RP80 - PROPHECY UPGRADE
                </h2>
              </div>
            </div>
            
            {/* Action buttons */}
            <div style={{
              position: 'absolute',
              top: '100%',
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem',
              paddingTop: '1rem',
              opacity: modalAction ? 0 : 1,
              transform: modalAction ? 'translateX(-24px)' : 'translateX(0)',
              transition: 'all 0.3s ease',
              transitionDelay: modalAction ? '0s' : '0.2s',
            }}>
              <button
                onClick={handleCancel}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #6dd5c7',
                  background: modalAction === 'cancel' ? '#6dd5c7' : 'rgba(0, 0, 0, 0.8)',
                  color: modalAction === 'cancel' ? '#000' : '#6dd5c7',
                  cursor: 'pointer',
                  clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  if (modalAction !== 'cancel') {
                    e.currentTarget.style.background = '#6dd5c7'
                    e.currentTarget.style.color = '#000'
                  }
                }}
                onMouseLeave={(e) => {
                  if (modalAction !== 'cancel') {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)'
                    e.currentTarget.style.color = '#6dd5c7'
                  }
                }}
              >
                <span style={{
                  width: '16px',
                  height: '16px',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  borderRadius: '50%',
                  background: modalAction === 'cancel' ? '#000' : '#6dd5c7',
                  color: modalAction === 'cancel' ? '#6dd5c7' : '#000',
                  display: 'grid',
                  placeItems: 'center',
                }}>ESC</span>
                <span>Cancel</span>
              </button>
              
              <button
                onClick={handleProceed}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #6dd5c7',
                  background: modalAction === 'proceed' ? '#6dd5c7' : 'rgba(0, 0, 0, 0.8)',
                  color: modalAction === 'proceed' ? '#000' : '#6dd5c7',
                  cursor: 'pointer',
                  clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  if (modalAction !== 'proceed') {
                    e.currentTarget.style.background = '#6dd5c7'
                    e.currentTarget.style.color = '#000'
                  }
                }}
                onMouseLeave={(e) => {
                  if (modalAction !== 'proceed') {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)'
                    e.currentTarget.style.color = '#6dd5c7'
                  }
                }}
              >
                <span style={{
                  width: '16px',
                  height: '16px',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  borderRadius: '50%',
                  background: modalAction === 'proceed' ? '#000' : '#6dd5c7',
                  color: modalAction === 'proceed' ? '#6dd5c7' : '#000',
                  display: 'grid',
                  placeItems: 'center',
                }}>→</span>
                <span>Proceed</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}