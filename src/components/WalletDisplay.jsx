'use client';

import { useWalletAuth } from './WalletAuthProvider';
import { useEffect, useState } from 'react';

export function WalletDisplay({ compact = false }) {
  const { 
    walletAddress, 
    tokenBalance, 
    isWalletConnected,
    connectWallet,
    disconnectWallet,
    isConnecting,
    isLoadingBalance,
    tokenInfo
  } = useWalletAuth();
  
  const [tokenSymbol, setTokenSymbol] = useState('TOKEN');

  useEffect(() => {
    // Get token symbol if available
    if (tokenInfo?.symbol) {
      setTokenSymbol(tokenInfo.symbol);
    }
  }, [tokenInfo]);

  if (!isWalletConnected) {
    return (
      <button
        onClick={() => connectWallet('metamask')}
        disabled={isConnecting}
        className="px-4 py-2 bg-gradient-to-r from-[#ff006e] to-[#8338ec] text-white rounded-full font-bold text-xs uppercase tracking-wider hover:scale-105 transition-transform disabled:opacity-50"
        style={{
          boxShadow: '0 0 20px rgba(255, 0, 110, 0.4)',
          fontFamily: 'Orbitron, monospace'
        }}
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ fontFamily: 'Orbitron, monospace' }}>
        <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-cyan-500/30" 
             style={{ boxShadow: '0 0 10px rgba(0, 245, 212, 0.2)' }}>
          <span className="text-cyan-400">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>
        </div>
        {tokenBalance !== null && (
          <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-yellow-500/30"
               style={{ boxShadow: '0 0 10px rgba(255, 238, 0, 0.2)' }}>
            <span className="text-yellow-400">
              {isLoadingBalance ? '...' : `${tokenBalance} ${tokenSymbol}`}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-black/80 backdrop-blur-xl rounded-xl border border-purple-500/30"
         style={{ 
           boxShadow: '0 0 30px rgba(138, 43, 226, 0.3)',
           fontFamily: 'Orbitron, monospace'
         }}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-gray-400">Wallet</span>
          <button
            onClick={disconnectWallet}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Disconnect
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-white font-mono">
            {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
          </span>
        </div>
        
        {tokenBalance !== null && (
          <div className="pt-2 border-t border-purple-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-400">Balance</span>
              <span className="text-lg font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                {isLoadingBalance ? 'Loading...' : `${tokenBalance} ${tokenSymbol}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}