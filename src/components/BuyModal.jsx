'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useConnect } from 'wagmi';
import dynamic from 'next/dynamic';
// useEvmAccounts surfaces the user's EOA(s). Required for ExportWalletModal:
// for accounts that have a smart account, wagmi's address is the smart
// account (a contract, no exportable key) — only the owner EOA can be
// exported. New users with createOnLogin:'eoa' have only an EOA and the
// EOA matches the wagmi address; users from earlier rounds with smart
// accounts get the EOA owner here.
import { useEvmAccounts, useCurrentUser } from '@coinbase/cdp-hooks';
// Load CDP React components client-only — the package reads localStorage at
// module init, which throws ReferenceError during Next SSR and turns every
// page importing BuyModal into a 404. ssr:false defers evaluation to the
// browser. Mirrors the CDPReactProvider treatment in Providers.jsx.
const AuthButton = dynamic(
  () => import('@coinbase/cdp-react').then((m) => ({ default: m.AuthButton })),
  { ssr: false },
);
const SignInModal = dynamic(
  () => import('@coinbase/cdp-react').then((m) => ({ default: m.SignInModal })),
  { ssr: false },
);
const SignInModalTrigger = dynamic(
  () => import('@coinbase/cdp-react').then((m) => ({ default: m.SignInModalTrigger })),
  { ssr: false },
);
const CopyAddress = dynamic(
  () => import('@coinbase/cdp-react').then((m) => ({ default: m.CopyAddress })),
  { ssr: false },
);
const ExportWalletModal = dynamic(
  () => import('@coinbase/cdp-react').then((m) => ({ default: m.ExportWalletModal })),
  { ssr: false },
);
import { useLanguage } from './LanguageProvider';
import { useWalletAuth } from '@/components/WalletAuthProvider';
import SwapForm from './SwapForm';
import PhoneVerification from './PhoneVerification';

const CONNECTORS = [
  { id: 'coinbaseWalletSDK', label: 'COINBASE' },
  { id: 'metaMaskSDK', label: 'METAMASK' },
  { id: 'walletConnect', label: 'WALLETCONNECT' },
];

const BuyModal = ({ isOpen, onClose }) => {
  const [glitchActive, setGlitchActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSmallPhone, setIsSmallPhone] = useState(false);
  const [onrampStep, setOnrampStep] = useState('idle');
  const [phoneData, setPhoneData] = useState(null);
  const [purchaseCurrency, setPurchaseCurrency] = useState('ETH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLink, setPaymentLink] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [onrampError, setOnrampError] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('GUEST_CHECKOUT_APPLE_PAY');
  const iframeRef = useRef(null);
  // Portal so the modal escapes .shrine-page.neon's forced position: relative
  // rule and the 3D Canvas stacking context — otherwise iPad Safari can
  // composite the WebGL canvas over the backdrop between frames.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { t } = useLanguage();
  const { walletAddress, isEmbeddedWallet } = useWalletAuth();
  const { evmAccounts } = useEvmAccounts();
  const ownerEoaAddress = evmAccounts?.[0]?.address || null;
  const { connectAsync, connectors: wagmiConnectors } = useConnect();
  const { currentUser: cdpUser } = useCurrentUser();
  const [pendingConnectorId, setPendingConnectorId] = useState(null);
  // Hide the METAMASK button when no browser wallet extension is
  // present. With `extensionOnly: true` on the connector, clicking it
  // without an extension just throws — better to never show it. Users
  // without a wallet extension still have CDP signup + WalletConnect.
  const [hasInjectedProvider, setHasInjectedProvider] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      setHasInjectedProvider(true);
    }
  }, []);
  const visibleConnectors = useMemo(
    () => CONNECTORS.filter((c) => c.id !== 'metaMaskSDK' || hasInjectedProvider),
    [hasInjectedProvider],
  );

  const handleConnect = useCallback(async (connectorId) => {
    setOnrampError(null);
    const connector = wagmiConnectors.find((c) => c.id === connectorId);
    if (!connector) {
      setOnrampError(`Connector ${connectorId} not available on this device`);
      return;
    }
    setPendingConnectorId(connectorId);
    try {
      await connectAsync({ connector });
    } catch (err) {
      const userRejected = /reject|denied|user.*cancel/i.test(err?.message || '');
      setOnrampError(userRejected ? null : (err?.shortMessage || err?.message || 'Wallet connect failed'));
    } finally {
      setPendingConnectorId(null);
    }
  }, [connectAsync, wagmiConnectors]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
      setIsSmallPhone(window.innerWidth < 400 || window.innerHeight < 700);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setGlitchActive(false);
        setTimeout(() => setGlitchActive(false), 100);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Lock page scroll (iOS-safe) while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const { body, documentElement: html } = document;
    const prev = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    return () => {
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      body.style.overflow = prev.bodyOverflow;
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Reset onramp state when modal closes
  useEffect(() => {
    if (isOpen) return;
    setOnrampStep('idle');
    setPhoneData(null);
    setPaymentAmount('');
    setPaymentLink(null);
    setOrderData(null);
    setOnrampError(null);
    setTermsAccepted(false);
  }, [isOpen]);

  // Auto-detect Apple Pay vs Google Pay. ApplePaySession.canMakePayments
  // throws on insecure contexts (http://localhost), so guard it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.ApplePaySession?.canMakePayments?.()) {
        setPaymentMethod('GUEST_CHECKOUT_APPLE_PAY');
        return;
      }
    } catch {
      // ApplePaySession exists but throws (e.g., insecure context). Fall through.
      if (window.ApplePaySession) {
        setPaymentMethod('GUEST_CHECKOUT_APPLE_PAY');
        return;
      }
    }
    setPaymentMethod('GUEST_CHECKOUT_GOOGLE_PAY');
  }, []);

  // Advance to phone verification when wallet connects
  useEffect(() => {
    if (!walletAddress || !isOpen) return;
    if (onrampStep === 'idle') setOnrampStep('phone');
  }, [walletAddress, isOpen, onrampStep]);

  // Listen for postMessage events from the payment iframe
  useEffect(() => {
    if (onrampStep !== 'iframe') return;
    const handler = (event) => {
      const name = event?.data?.eventName;
      if (!name || !name.startsWith('onramp_api.')) return;
      const errorMsg = event?.data?.data?.errorMessage;
      switch (name) {
        case 'onramp_api.load_error':
          setOnrampError(errorMsg || 'Payment page failed to load. Please try again.');
          setOnrampStep('error');
          break;
        case 'onramp_api.commit_success':
        case 'onramp_api.polling_success':
          setOnrampStep('success');
          break;
        case 'onramp_api.commit_error':
          setOnrampError(errorMsg || 'Payment could not be completed. Please try again.');
          setOnrampStep('error');
          break;
        case 'onramp_api.cancel':
          setOnrampStep('amount');
          setPaymentLink(null);
          break;
        case 'onramp_api.polling_error':
          setOnrampError('Confirmation timed out. Check your wallet — funds may still arrive.');
          setOnrampStep('error');
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onrampStep]);

  const handlePhoneVerified = useCallback((data) => {
    setPhoneData(data);
    setOnrampStep('amount');
  }, []);

  const handleCreateOrder = useCallback(async () => {
    if (!walletAddress || !phoneData || !paymentAmount || !termsAccepted) return;
    setOnrampStep('submitting');
    setOnrampError(null);
    try {
      const methods = cdpUser?.authenticationMethods || {};
      const email =
        methods.email?.email ||
        methods.google?.email ||
        methods.apple?.email ||
        methods.x?.email;
      if (!email) {
        throw new Error('Verified email not available. Please sign in again with email or a provider that shares your email.');
      }
      const res = await fetch('/api/onramp-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationAddress: walletAddress,
          email,
          phoneVerificationToken: phoneData.phoneVerificationToken,
          paymentMethod,
          purchaseCurrency,
          paymentAmount,
          partnerUserRef: cdpUser?.userId || walletAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let detailMsg = '';
        if (data.detail) {
          try {
            const parsed = JSON.parse(data.detail);
            detailMsg = parsed.errorMessage || parsed.message || data.detail;
          } catch {
            detailMsg = data.detail;
          }
        }
        console.error('CDP order error detail:', data);
        throw new Error(detailMsg || data.error || 'Failed to create order');
      }
      setOrderData(data.order);
      let linkUrl = data.paymentLink?.url;
      if (linkUrl && process.env.NODE_ENV !== 'production') {
        const sandboxFlag = paymentMethod === 'GUEST_CHECKOUT_APPLE_PAY'
          ? 'useApplePaySandbox=true'
          : 'useGooglePaySandbox=true';
        if (!linkUrl.includes(sandboxFlag)) {
          const sep = linkUrl.includes('?') ? '&' : '?';
          linkUrl += `${sep}${sandboxFlag}`;
        }
      }
      setPaymentLink(linkUrl);
      setOnrampStep('iframe');
    } catch (err) {
      console.error('Onramp order failed:', err);
      setOnrampError(err?.message || 'Failed to create order');
      setOnrampStep('error');
    }
  }, [walletAddress, phoneData, paymentAmount, purchaseCurrency, paymentMethod, termsAccepted, cdpUser]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      <style jsx>{`
        @keyframes modalGlitch {
          0%, 100% {
            transform: translate(0);
            filter: hue-rotate(0deg);
          }
          10% {
            transform: translate(-2px, 2px);
            filter: hue-rotate(90deg);
          }
          20% {
            transform: translate(-2px, -2px);
            filter: hue-rotate(180deg);
          }
          30% {
            transform: translate(2px, 2px);
            filter: hue-rotate(270deg);
          }
          40% {
            transform: translate(2px, -2px);
            filter: hue-rotate(360deg);
          }
          50% {
            transform: translate(-1px, 1px);
            filter: hue-rotate(45deg);
          }
        }

        @keyframes textGlitch {
          0%, 100% {
            text-shadow:
              2px 2px #fded00,
              -2px -2px #00e572,
              0 0 20px rgba(255, 24, 76, 0.8);
          }
          25% {
            text-shadow:
              -2px 2px #00e572,
              2px -2px #fded00,
              0 0 30px rgba(139, 0, 255, 0.8);
          }
          50% {
            text-shadow:
              2px -2px #ff184c,
              -2px 2px #8B00FF,
              0 0 25px rgba(253, 237, 0, 0.8);
          }
          75% {
            text-shadow:
              -2px -2px #00e572,
              2px 2px #ff184c,
              0 0 35px rgba(0, 229, 114, 0.8);
          }
        }

        .modal-glitch {
          animation: modalGlitch 0.2s ease-out;
        }

        .title-glitch {
          animation: textGlitch 3s infinite;
        }

        .close-btn {
          --clip: polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%);
          clip-path: var(--clip);
          position: relative;
        }

        .close-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #fded00;
          transform: translate(3px, 0);
          clip-path: var(--clip);
          z-index: -1;
        }

        .close-btn::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #ff184c;
          clip-path: var(--clip);
          z-index: -2;
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(0, 229, 114, 0.3), inset 0 0 20px rgba(0, 229, 114, 0.1);
          }
          50% {
            box-shadow: 0 0 40px rgba(0, 229, 114, 0.5), inset 0 0 30px rgba(0, 229, 114, 0.2);
          }
        }
      `}</style>

      {/* Modal Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#000',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          overscrollBehavior: 'contain',
          // Force own stacking context + GPU layer so iOS/iPad Safari doesn't
          // composite the 3D WebGL canvas over the modal between frames.
          // No `will-change` — browsers sometimes demote/repromote the layer
          // during transitions, which reveals layers behind for a frame.
          isolation: 'isolate',
          contain: 'layout style paint',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}
        onClick={onClose}
      >
        {/* Glitch Lines Effect */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          opacity: glitchActive ? 0.1 : 0,
          transition: 'opacity 0.1s',
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255, 24, 76, 0.3) 2px,
            rgba(255, 24, 76, 0.3) 4px
          )`,
        }} />

        {/* Modal Content */}
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #93276a, #3434a7)',
            clipPath: isSmallPhone ? 'none' : 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
            padding: isSmallPhone ? '0.75rem 0.75rem 0.75rem' : isMobile ? '2.5rem 1.25rem 1.5rem' : '1.75rem 2rem',
            maxWidth: '460px',
            width: isSmallPhone ? '95%' : '90%',
            maxHeight: isSmallPhone ? '90dvh' : isMobile ? '85dvh' : 'calc(90dvh / var(--hm-ui-scale, 1))',
            zoom: 'var(--hm-ui-scale, 1)',
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
            boxSizing: 'border-box',
            boxShadow: glitchActive
              ? '5px 5px 0 #ff184c, -5px -5px 0 #00e572, 0 0 50px rgba(139, 0, 255, 0.5)'
              : '3px 3px 0 #fded00, -3px -3px 0 #00e572, 0 0 30px rgba(255, 24, 76, 0.5)',
            transition: 'box-shadow 0.3s',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cyber Frame Borders */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #ff184c, transparent)',
            }} />
          </div>

          {/* Buy Content */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: isMobile ? '2px' : '3px',
            position: 'relative',
          }}>
            {/* Corner Accents */}
            <div style={{
              position: 'absolute',
              top: '0',
              left: '-8px',
              width: '20px',
              height: '20px',
              borderTop: '2px solid #fded00',
              borderLeft: '2px solid #fded00',
            }} />
            <div style={{
              position: 'absolute',
              top: '0',
              right: '-8px',
              width: '20px',
              height: '20px',
              borderTop: '2px solid #fded00',
              borderRight: '2px solid #fded00',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '0',
              left: '-8px',
              width: '20px',
              height: '20px',
              borderBottom: '2px solid #00e572',
              borderLeft: '2px solid #00e572',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '0',
              right: '-8px',
              width: '20px',
              height: '20px',
              borderBottom: '2px solid #00e572',
              borderRight: '2px solid #00e572',
            }} />

            {/* Close Button — sticky so it stays reachable as modal scrolls */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                alignSelf: 'stretch',
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: isSmallPhone ? '-36px' : isMobile ? '-50px' : '-40px',
                pointerEvents: 'none',
                zIndex: 100,
              }}
            >
              <button
                className="close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                style={{
                  position: 'relative',
                  background: '#000',
                  border: 'none',
                  color: '#000',
                  fontSize: isSmallPhone ? '20px' : isMobile ? '28px' : '24px',
                  width: isSmallPhone ? '36px' : isMobile ? '50px' : '40px',
                  height: isSmallPhone ? '36px' : isMobile ? '50px' : '40px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.3s ease',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.color = '#ff184c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.color = '#000';
                }}
              >
                ✕
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: isSmallPhone ? '10px' : '14px',
              padding: isSmallPhone ? '14px 8px' : '18px 12px',
              width: '100%',
            }}>
              {/* Title with Glitch Effect */}
              <h2 className="title-glitch" style={{
                color: '#fff',
                textAlign: 'center',
                margin: 0,
                fontSize: isSmallPhone ? '1rem' : isMobile ? '1.25rem' : '1.5rem',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: isSmallPhone ? '2px' : '3px',
                fontWeight: '900',
                position: 'relative',
              }}>
                <span style={{ position: 'relative', zIndex: 2 }}>
                  {t('buyModal.title') || 'BUY_RL80_'}
                </span>
                {glitchActive && (
                  <>
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      left: '2px',
                      color: '#ff184c',
                      zIndex: 1,
                      width: '100%',
                      textAlign: 'center',
                    }}>
                      {t('buyModal.title') || 'BUY_RL80_'}
                    </span>
                    <span style={{
                      position: 'absolute',
                      top: '-2px',
                      left: '-2px',
                      color: '#00e572',
                      zIndex: 0,
                      width: '100%',
                      textAlign: 'center',
                    }}>
                      {t('buyModal.title') || 'BUY_RL80_'}
                    </span>
                  </>
                )}
              </h2>

              {/* Two-step process explainer (connected users only) */}
              {walletAddress && (
                <div style={{
                  width: '100%',
                  maxWidth: '320px',
                  padding: isSmallPhone ? '10px 10px' : '12px 14px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(253, 237, 0, 0.3)',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  <p style={{
                    fontFamily: 'monospace',
                    fontSize: isSmallPhone ? '10px' : '11px',
                    fontWeight: '900',
                    letterSpacing: '2px',
                    color: '#fded00',
                    textAlign: 'center',
                    margin: 0,
                    textTransform: 'uppercase',
                  }}>
                    {'>>'} HOW IT WORKS
                  </p>
                  <p style={{
                    fontFamily: 'monospace',
                    fontSize: isSmallPhone ? '10px' : '11px',
                    color: 'rgba(255, 255, 255, 0.85)',
                    textAlign: 'left',
                    lineHeight: '1.5',
                    margin: 0,
                  }}>
                    1. Verify your phone (US only, one-time)
                    <br />
                    2. Buy ETH or USDC with Apple/Google Pay
                    <br />
                    3. Swap below for RL80
                  </p>
                </div>
              )}

              {/* Buy / Connect Section */}
              {!walletAddress ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px',
                  width: '100%',
                  maxWidth: '320px',
                }}>
                  {/* New-to-crypto onboarding section — visually prominent */}
                  <div style={{
                    width: '100%',
                    padding: isSmallPhone ? '10px 10px' : '12px 14px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(253, 237, 0, 0.4)',
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <p style={{
                      fontFamily: 'monospace',
                      fontSize: isSmallPhone ? '10px' : '11px',
                      fontWeight: '900',
                      letterSpacing: '2px',
                      color: '#fded00',
                      textAlign: 'center',
                      margin: 0,
                      textTransform: 'uppercase',
                    }}>
                      {'>>'} NEW TO CRYPTO?
                    </p>
                    <p style={{
                      fontFamily: 'monospace',
                      fontSize: isSmallPhone ? '10px' : '10.5px',
                      color: 'rgba(255, 255, 255, 0.85)',
                      textAlign: 'center',
                      lineHeight: '1.4',
                      margin: 0,
                    }}>
                      Sign up with email or social — we&apos;ll create a wallet for you. No downloads, no seed phrases.
                    </p>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                      <AuthButton
                        signInModal={({ open, setIsOpen, onSuccess }) => (
                          <SignInModal open={open} setIsOpen={setIsOpen} onSuccess={onSuccess}>
                            <SignInModalTrigger>
                              <button
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: isSmallPhone ? '12px' : '13px',
                                  fontWeight: '900',
                                  letterSpacing: '2px',
                                  color: '#000',
                                  background: 'linear-gradient(135deg, #fded00, #ffb700)',
                                  border: 'none',
                                  padding: isSmallPhone ? '9px 18px' : '10px 22px',
                                  cursor: 'pointer',
                                  clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                                  transition: 'all 0.2s ease',
                                  width: '100%',
                                  textTransform: 'uppercase',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                              >
                                Sign Up / Sign In
                              </button>
                            </SignInModalTrigger>
                          </SignInModal>
                        )}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px' }}>OR CONNECT EXISTING WALLET</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    width: '100%',
                  }}>
                        {visibleConnectors.map(({ id, label }) => {
                          const pending = pendingConnectorId === id;
                          return (
                            <button
                              key={id}
                              onClick={() => handleConnect(id)}
                              disabled={!!pendingConnectorId}
                              style={{
                                fontFamily: 'monospace',
                                fontSize: isSmallPhone ? '10px' : '11px',
                                fontWeight: '900',
                                letterSpacing: '1.5px',
                                color: '#000',
                                background: pending
                                  ? 'rgba(100, 100, 100, 0.5)'
                                  : 'linear-gradient(135deg, #00e572, #00c85d)',
                                border: 'none',
                                padding: isSmallPhone ? '8px 12px' : '9px 14px',
                                cursor: pendingConnectorId ? 'wait' : 'pointer',
                                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              {pending ? '...' : label}
                            </button>
                          );
                        })}
                      </div>
                </div>
              ) : (
                <>
                  {isEmbeddedWallet && (
                    <div style={{
                      width: '100%',
                      maxWidth: '320px',
                      padding: isSmallPhone ? '8px 10px' : '10px 12px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(0, 229, 114, 0.35)',
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      marginBottom: '4px',
                    }}>
                      <p style={{
                        fontFamily: 'monospace',
                        fontSize: isSmallPhone ? '10px' : '11px',
                        fontWeight: '900',
                        letterSpacing: '2px',
                        color: '#00e572',
                        margin: 0,
                        textTransform: 'uppercase',
                      }}>
                        {'>>'} YOUR WALLET
                      </p>
                      <CopyAddress address={walletAddress} />
                      {ownerEoaAddress && <ExportWalletModal address={ownerEoaAddress} />}
                      <p style={{
                        fontFamily: 'monospace',
                        fontSize: '9.5px',
                        color: 'rgba(255, 255, 255, 0.55)',
                        lineHeight: '1.4',
                        margin: 0,
                      }}>
                        Funds land here. Export the key any time to move your wallet.
                      </p>
                    </div>
                  )}
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    fontWeight: '900',
                    letterSpacing: '3px',
                    color: 'rgba(0, 229, 114, 0.85)',
                    textTransform: 'uppercase',
                    marginBottom: '-4px',
                  }}>
                    Step 1
                  </span>

                  {/* Phone verification step */}
                  {onrampStep === 'phone' && (
                    <PhoneVerification
                      isSmallPhone={isSmallPhone}
                      isMobile={isMobile}
                      onVerified={handlePhoneVerified}
                    />
                  )}

                  {/* Amount + terms step */}
                  {onrampStep === 'amount' && (
                    <div style={{
                      width: '100%',
                      maxWidth: '320px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      alignItems: 'center',
                    }}>
                      <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                        {['ETH', 'USDC'].map((cur) => (
                          <button
                            key={cur}
                            onClick={() => setPurchaseCurrency(cur)}
                            style={{
                              flex: 1,
                              fontFamily: 'monospace',
                              fontSize: isSmallPhone ? '11px' : '12px',
                              fontWeight: '900',
                              letterSpacing: '2px',
                              color: purchaseCurrency === cur ? '#000' : 'rgba(255,255,255,0.7)',
                              background: purchaseCurrency === cur
                                ? 'linear-gradient(135deg, #00e572, #00c85d)'
                                : 'rgba(255,255,255,0.1)',
                              border: purchaseCurrency === cur
                                ? 'none'
                                : '1px solid rgba(255,255,255,0.2)',
                              padding: isSmallPhone ? '8px' : '10px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {cur}
                          </button>
                        ))}
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                      }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: isSmallPhone ? '18px' : '22px',
                          fontWeight: '900',
                          color: 'rgba(255,255,255,0.5)',
                        }}>
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={paymentAmount}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.]/g, '');
                            if ((val.match(/\./g) || []).length <= 1) {
                              setPaymentAmount(val);
                            }
                          }}
                          style={{
                            flex: 1,
                            fontFamily: 'monospace',
                            fontSize: isSmallPhone ? '18px' : '22px',
                            fontWeight: '700',
                            color: '#fff',
                            background: 'rgba(0, 0, 0, 0.6)',
                            border: '1px solid rgba(0, 229, 114, 0.4)',
                            borderRadius: '4px',
                            padding: isSmallPhone ? '10px 12px' : '12px 14px',
                            outline: 'none',
                            letterSpacing: '1px',
                            boxSizing: 'border-box',
                          }}
                        />
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '10px',
                          color: 'rgba(255,255,255,0.5)',
                          letterSpacing: '1px',
                        }}>
                          USD
                        </span>
                      </div>

                      <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        width: '100%',
                        cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          style={{ marginTop: '2px', accentColor: '#00e572', cursor: 'pointer' }}
                        />
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '9px',
                          color: 'rgba(255,255,255,0.6)',
                          lineHeight: '1.5',
                        }}>
                          I agree to the Coinbase{' '}
                          <a href="https://www.coinbase.com/legal/guest-checkout/us" target="_blank" rel="noopener noreferrer" style={{ color: '#00e572' }}>Terms</a>,{' '}
                          <a href="https://www.coinbase.com/legal/user_agreement" target="_blank" rel="noopener noreferrer" style={{ color: '#00e572' }}>User Agreement</a>, and{' '}
                          <a href="https://www.coinbase.com/legal/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#00e572' }}>Privacy Policy</a>.
                        </span>
                      </label>

                      <button
                        onClick={handleCreateOrder}
                        disabled={!paymentAmount || !termsAccepted || parseFloat(paymentAmount) < 5}
                        style={{
                          fontFamily: 'monospace',
                          fontSize: isSmallPhone ? '13px' : '15px',
                          fontWeight: '900',
                          textTransform: 'uppercase',
                          letterSpacing: '2px',
                          color: '#000',
                          background: (!paymentAmount || !termsAccepted || parseFloat(paymentAmount) < 5)
                            ? 'rgba(100, 100, 100, 0.5)'
                            : 'linear-gradient(135deg, #00e572, #00c85d)',
                          border: 'none',
                          padding: isSmallPhone ? '14px 28px' : '16px 40px',
                          cursor: (!paymentAmount || !termsAccepted || parseFloat(paymentAmount) < 5) ? 'not-allowed' : 'pointer',
                          clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
                          transition: 'all 0.3s ease',
                          animation: (paymentAmount && termsAccepted && parseFloat(paymentAmount) >= 5) ? 'pulse-glow 2s infinite' : 'none',
                          width: '100%',
                        }}
                        onMouseEnter={(e) => {
                          if (paymentAmount && termsAccepted) {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 229, 114, 0.6)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = '';
                        }}
                      >
                        {paymentMethod === 'GUEST_CHECKOUT_APPLE_PAY' ? 'PAY WITH APPLE PAY' : 'PAY WITH GOOGLE PAY'}
                      </button>
                    </div>
                  )}

                  {/* Creating order */}
                  {onrampStep === 'submitting' && (
                    <p style={{
                      fontFamily: 'monospace',
                      fontSize: isSmallPhone ? '12px' : '14px',
                      fontWeight: '900',
                      letterSpacing: '3px',
                      color: '#fded00',
                      textAlign: 'center',
                      animation: 'pulse-glow 1.5s infinite',
                    }}>
                      CREATING ORDER...
                    </p>
                  )}

                  {/* Payment iframe */}
                  {onrampStep === 'iframe' && paymentLink && (
                    <div style={{
                      width: '100%',
                      maxWidth: '320px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      alignItems: 'center',
                    }}>
                      <iframe
                        ref={iframeRef}
                        src={paymentLink}
                        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals"
                        referrerPolicy="no-referrer"
                        allow="payment; camera; microphone; clipboard-write"
                        style={{
                          width: '100%',
                          height: '360px',
                          border: '1px solid rgba(0, 229, 114, 0.3)',
                          borderRadius: '8px',
                          background: 'rgba(0, 0, 0, 0.4)',
                        }}
                      />
                      <p style={{
                        fontFamily: 'monospace',
                        fontSize: '9px',
                        color: 'rgba(255,255,255,0.4)',
                        textAlign: 'center',
                        letterSpacing: '1px',
                        margin: 0,
                      }}>
                        Complete payment above. Do not close this window.
                      </p>
                    </div>
                  )}

                  {/* Success */}
                  {onrampStep === 'success' && (
                    <div style={{
                      width: '100%',
                      maxWidth: '320px',
                      padding: isSmallPhone ? '14px' : '18px',
                      background: 'rgba(0, 229, 114, 0.1)',
                      border: '1px solid rgba(0, 229, 114, 0.4)',
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '28px' }}>&#10003;</span>
                      <p style={{
                        fontFamily: 'monospace',
                        fontSize: isSmallPhone ? '12px' : '14px',
                        fontWeight: '900',
                        letterSpacing: '2px',
                        color: '#00e572',
                        textAlign: 'center',
                        margin: 0,
                        textTransform: 'uppercase',
                      }}>
                        FUNDS ON THE WAY
                      </p>
                      <p style={{
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.7)',
                        textAlign: 'center',
                        lineHeight: '1.5',
                        margin: 0,
                      }}>
                        {purchaseCurrency} will arrive in your wallet shortly. Use Step 2 below to swap for RL80.
                      </p>
                      <button
                        onClick={() => {
                          setOnrampStep('amount');
                          setPaymentLink(null);
                          setOrderData(null);
                          setPaymentAmount('');
                          setTermsAccepted(false);
                        }}
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '10px',
                          color: 'rgba(255,255,255,0.5)',
                          background: 'none',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px',
                          padding: '6px 16px',
                          cursor: 'pointer',
                          letterSpacing: '1px',
                          marginTop: '4px',
                        }}
                      >
                        BUY MORE
                      </button>
                    </div>
                  )}

                  {/* Error */}
                  {onrampStep === 'error' && (
                    <div style={{
                      width: '100%',
                      maxWidth: '320px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <p style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: '#ff4d4d',
                        textAlign: 'center',
                        letterSpacing: '1px',
                        margin: 0,
                      }}>
                        {onrampError}
                      </p>
                      <button
                        onClick={() => {
                          setOnrampStep('amount');
                          setOnrampError(null);
                          setPaymentLink(null);
                        }}
                        style={{
                          fontFamily: 'monospace',
                          fontSize: isSmallPhone ? '12px' : '13px',
                          fontWeight: '900',
                          letterSpacing: '2px',
                          color: '#000',
                          background: 'linear-gradient(135deg, #fded00, #ffb700)',
                          border: 'none',
                          padding: isSmallPhone ? '10px 18px' : '12px 22px',
                          cursor: 'pointer',
                          clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                          transition: 'all 0.2s ease',
                          textTransform: 'uppercase',
                        }}
                      >
                        TRY AGAIN
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                maxWidth: '320px',
              }}>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(253, 237, 0, 0.4))' }} />
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: 'rgba(253, 237, 0, 0.6)',
                  letterSpacing: '3px',
                }}>
                  {t('buyModal.orDivider') || 'OR'}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(253, 237, 0, 0.4), transparent)' }} />
              </div>

              {/* In-app Swap Section — STEP 2 label only when connected,
                  since Step 1 (the Buy button) is also connect-gated. */}
              {walletAddress && (
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  fontWeight: '900',
                  letterSpacing: '3px',
                  color: 'rgba(0, 229, 114, 0.85)',
                  textTransform: 'uppercase',
                }}>
                  Step 2
                </span>
              )}
              <p style={{
                fontFamily: 'monospace',
                fontSize: isSmallPhone ? '11px' : '13px',
                color: 'rgba(255, 255, 255, 0.7)',
                textAlign: 'center',
                lineHeight: '1.6',
                letterSpacing: '0.5px',
                maxWidth: '320px',
              }}>
                {t('buyModal.swapDescription') || 'Already have ETH or USDC? Swap directly for RL80.'}
              </p>

              <SwapForm isSmallPhone={isSmallPhone} isMobile={isMobile} />
            </div>
          </div>

          {/* Info Text */}
          <p style={{
            color: '#00e572',
            textAlign: 'center',
            marginTop: isSmallPhone ? '0.75rem' : '1.5rem',
            fontSize: isSmallPhone ? '8px' : '10px',
            fontFamily: 'monospace',
            letterSpacing: isSmallPhone ? '1px' : '2px',
            textTransform: 'uppercase',
            textShadow: '0 0 10px rgba(0, 229, 114, 0.5)',
          }}>
            {t('buyModal.secureTransaction') || '<SECURE_TRANSACTION_PROTOCOL_ACTIVE>'}
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </>,
    document.body,
  );
};

// Only re-render when isOpen changes. Parent pages re-render on timers
// (e.g. meltProgress every 1s) and pass a fresh `onClose` closure each time;
// without this, the modal's styled-jsx and heavy JSX tree would rebuild on
// every parent tick, contributing to visible flicker on iOS/iPad.
export default React.memo(BuyModal, (prev, next) => prev.isOpen === next.isOpen);
