"use client";
import React, { useState } from 'react';

export default function LighterSetupPage() {
  const [ethPrivateKey, setEthPrivateKey] = useState('');
  const [apiKeyIndex, setApiKeyIndex] = useState(3);
  const [seed, setSeed] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSetup = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/lighter/setup-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ethPrivateKey,
          apiKeyIndex,
          seed: seed || undefined,
          baseUrl: 'https://testnet.zklighter.elliot.ai'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Setup failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ marginBottom: '2rem', color: '#333' }}>Lighter.xyz API Setup</h1>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#555' }}>
            ETH Private Key (from your testnet wallet):
          </label>
          <input
            type="password"
            value={ethPrivateKey}
            onChange={(e) => setEthPrivateKey(e.target.value)}
            placeholder="Your Ethereum private key..."
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '14px'
            }}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '0.25rem' }}>
            This is used to authenticate and create your API key
          </small>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#555' }}>
            API Key Index (2-254):
          </label>
          <input
            type="number"
            value={apiKeyIndex}
            onChange={(e) => setApiKeyIndex(parseInt(e.target.value))}
            min="2"
            max="254"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '14px'
            }}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '0.25rem' }}>
            Default is 3. 0 is reserved for desktop, 1 for mobile
          </small>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#555' }}>
            Seed Phrase (optional):
          </label>
          <input
            type="text"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="Optional seed for deterministic key generation..."
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '14px'
            }}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '0.25rem' }}>
            Leave empty for random generation
          </small>
        </div>

        <button
          onClick={handleSetup}
          disabled={!ethPrivateKey || loading}
          style={{
            padding: '0.75rem 2rem',
            borderRadius: '8px',
            background: loading || !ethPrivateKey ? '#ccc' : 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            border: 'none',
            fontWeight: '600',
            cursor: loading || !ethPrivateKey ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            width: '100%',
            marginBottom: '1rem'
          }}
        >
          {loading ? 'Setting up...' : 'Setup API Key'}
        </button>

        {error && (
          <div style={{
            padding: '1rem',
            borderRadius: '8px',
            background: '#fee',
            border: '1px solid #fcc',
            color: '#c00',
            marginTop: '1rem'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            borderRadius: '8px',
            background: '#f0f9ff',
            border: '1px solid #bfdbfe'
          }}>
            <h3 style={{ color: '#1e40af', marginBottom: '1rem' }}>Setup Successful!</h3>
            
            <p style={{ marginBottom: '1rem', color: '#333' }}>
              Your API key has been generated. Save the following to your <code>.env.local</code> file:
            </p>
            
            <pre style={{
              background: '#1e293b',
              color: '#94a3b8',
              padding: '1rem',
              borderRadius: '6px',
              overflowX: 'auto',
              fontSize: '13px',
              lineHeight: '1.5'
            }}>
              {result.envContent}
            </pre>
            
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '6px'
            }}>
              <strong style={{ color: '#92400e' }}>Important:</strong>
              <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem', color: '#78350f' }}>
                <li>Save these credentials immediately</li>
                <li>Never share your private keys</li>
                <li>The API key private key cannot be recovered if lost</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}