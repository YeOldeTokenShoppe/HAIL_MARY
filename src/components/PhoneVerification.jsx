'use client';

import React, { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'rl80_phone_verification_v1';
const PHONE_VERIFICATION_MAX_DAYS = 60;

function readCachedToken() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.phoneNumber || !parsed?.verifiedAt) return null;
    const days = (Date.now() - new Date(parsed.verifiedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (days >= PHONE_VERIFICATION_MAX_DAYS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedToken(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota or disabled storage — verification still works for this session
  }
}

export default function PhoneVerification({ isSmallPhone, isMobile, onVerified }) {
  const [step, setStep] = useState('checking');
  const [phoneInput, setPhoneInput] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cached = readCachedToken();
    if (cached) {
      onVerified({
        phoneVerificationToken: cached.token,
        phoneNumber: cached.phoneNumber,
        phoneNumberVerifiedAt: cached.verifiedAt,
      });
      return;
    }
    setStep('input');
  }, [onVerified]);

  const handleSendCode = useCallback(async () => {
    if (!/^\d{10}$/.test(phoneInput)) {
      setError('Enter a valid 10-digit US phone number');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const fullNumber = `+1${phoneInput}`;
      const res = await fetch('/api/phone-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: fullNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification code');
      setStep('code');
    } catch (err) {
      setError(err?.message || 'Failed to send verification code');
    } finally {
      setIsSubmitting(false);
    }
  }, [phoneInput]);

  const handleVerifyCode = useCallback(async () => {
    if (!/^\d{4,8}$/.test(code)) {
      setError('Enter the code from your text message');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const fullNumber = `+1${phoneInput}`;
      const res = await fetch('/api/phone-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: fullNumber, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code. Please try again.');
      writeCachedToken({
        token: data.token,
        phoneNumber: data.phoneNumber,
        verifiedAt: data.verifiedAt,
      });
      onVerified({
        phoneVerificationToken: data.token,
        phoneNumber: data.phoneNumber,
        phoneNumberVerifiedAt: data.verifiedAt,
      });
    } catch (err) {
      setError(err?.message || 'Invalid code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [code, phoneInput, onVerified]);

  if (step === 'checking') return null;

  const inputStyle = {
    fontFamily: 'monospace',
    fontSize: isSmallPhone ? '14px' : '16px',
    fontWeight: '700',
    color: '#fff',
    background: 'rgba(0, 0, 0, 0.6)',
    border: '1px solid rgba(0, 229, 114, 0.4)',
    borderRadius: '4px',
    padding: isSmallPhone ? '10px 12px' : '12px 14px',
    outline: 'none',
    letterSpacing: '2px',
    width: '100%',
    boxSizing: 'border-box',
  };

  const buttonStyle = {
    fontFamily: 'monospace',
    fontSize: isSmallPhone ? '12px' : '13px',
    fontWeight: '900',
    letterSpacing: '2px',
    color: '#000',
    background: isSubmitting
      ? 'rgba(100, 100, 100, 0.5)'
      : 'linear-gradient(135deg, #00e572, #00c85d)',
    border: 'none',
    padding: isSmallPhone ? '10px 18px' : '12px 22px',
    cursor: isSubmitting ? 'wait' : 'pointer',
    clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
    transition: 'all 0.2s ease',
    width: '100%',
    textTransform: 'uppercase',
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '320px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
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
        {'>>'} VERIFY PHONE TO BUY
      </p>
      <p style={{
        fontFamily: 'monospace',
        fontSize: isSmallPhone ? '9px' : '10px',
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        lineHeight: '1.4',
        margin: 0,
      }}>
        US phone number required for Apple Pay / Google Pay purchases.
        {step === 'input' ? ' One-time per 60 days.' : ' Check your texts.'}
      </p>

      {step === 'input' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: 'monospace',
              fontSize: isSmallPhone ? '14px' : '16px',
              fontWeight: '700',
              color: 'rgba(255, 255, 255, 0.6)',
              letterSpacing: '2px',
              flexShrink: 0,
            }}>
              +1
            </span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="5551234567"
              value={phoneInput}
              onChange={(e) => {
                setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10));
                setError(null);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendCode(); }}
              style={inputStyle}
              autoFocus
            />
          </div>
          <button
            onClick={handleSendCode}
            disabled={isSubmitting || phoneInput.length < 10}
            style={{
              ...buttonStyle,
              opacity: phoneInput.length < 10 ? 0.5 : 1,
            }}
          >
            {isSubmitting ? 'SENDING...' : 'SEND CODE'}
          </button>
        </>
      )}

      {step === 'code' && (
        <>
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            placeholder="000000"
            value={code}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 8);
              setCode(val);
              setError(null);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyCode(); }}
            style={{ ...inputStyle, textAlign: 'center', letterSpacing: '8px' }}
            autoFocus
          />
          <button
            onClick={handleVerifyCode}
            disabled={isSubmitting || code.length < 4}
            style={{
              ...buttonStyle,
              opacity: code.length < 4 ? 0.5 : 1,
            }}
          >
            {isSubmitting ? 'VERIFYING...' : 'VERIFY'}
          </button>
          <button
            onClick={() => { setStep('input'); setCode(''); setError(null); }}
            style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.5)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '1px',
              padding: '4px',
            }}
          >
            &larr; different number
          </button>
        </>
      )}

      {error && (
        <p style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ff4d4d',
          textAlign: 'center',
          letterSpacing: '1px',
          margin: 0,
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
