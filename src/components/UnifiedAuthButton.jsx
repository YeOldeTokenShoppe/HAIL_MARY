'use client';

import { useWalletAuth } from './WalletAuthProvider';
import { SignInButton, UserButton } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { ConnectButton } from "thirdweb/react";
import { client } from '@/lib/contract';
import { defineChain } from "thirdweb/chains";
import { inAppWallet } from "thirdweb/wallets/in-app";

const chain = defineChain(8453); // Base

export function UnifiedAuthButton() {
  const {
    user,
    isSignedIn,
    walletAddress,
    tokenBalance,
    isWalletConnected,
    displayName,
    testWallet,
    isTestUser
  } = useWalletAuth();
  const pathname = usePathname();

  // If user is not signed in with Clerk, show sign in
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className="px-6 py-2.5 bg-gradient-to-r from-[#ff006e] to-[#8338ec] text-white rounded-full font-bold text-sm uppercase tracking-wider hover:scale-105 transition-transform"
                style={{
                  boxShadow: '0 0 25px rgba(255, 0, 110, 0.4)',
                  fontFamily: 'Orbitron, monospace'
                }}>
          Sign In
        </button>
      </SignInButton>
    );
  }

  // User is signed in, show unified profile with wallet connection
  return (
    <div className="flex items-center gap-3">
      {/* Wallet connection/display */}
      {!isWalletConnected && !testWallet ? (
        <div style={{ display: 'contents' }}> {/* Use display: contents to avoid creating a wrapper element */}
          <ConnectButton
            client={client}
            chain={chain}
            wallets={[
              inAppWallet({
                auth: {
                  options: ["email", "google", "apple", "facebook"],
                },
              }),
            ]}
            connectButton={{
              label: "Connect Wallet",
              style: {
                background: 'linear-gradient(135deg, #00f5d4, #00bbf9)',
                color: '#000',
                borderRadius: '9999px',
                padding: '10px 20px',
                fontSize: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontFamily: 'Orbitron, monospace',
                boxShadow: '0 0 20px rgba(0, 245, 212, 0.4)',
                border: 'none'
              }
            }}
            detailsButton={{
              style: {
                background: 'rgba(20, 20, 30, 0.98)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(138, 43, 226, 0.4)',
                borderRadius: '16px',
                color: '#fff',
                fontFamily: 'Orbitron, monospace'
              }
            }}
            onConnect={(wallet) => {
              // Wallet is connected, it will auto-sync with Clerk via our provider
            }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="px-3 py-2 bg-black/70 backdrop-blur-md rounded-full border border-cyan-500/40 flex items-center gap-2"
               style={{ 
                 boxShadow: '0 0 15px rgba(0, 245, 212, 0.3)',
                 fontFamily: 'Orbitron, monospace'
               }}>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-cyan-400">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
            {tokenBalance !== null && (
              <>
                <div className="w-px h-4 bg-cyan-500/30" />
                <span className="text-xs text-yellow-400 font-bold">
                  {tokenBalance} RL80
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Clerk User Button with custom content */}
      <div className="relative">
        <UserButton
          afterSignOutUrl={pathname || "/"}
          appearance={{
            elements: {
              userButtonAvatarBox: {
                width: '42px',
                height: '42px',
                border: isWalletConnected ? '2px solid #00f5d4' : '2px solid #ff006e',
                boxShadow: isWalletConnected 
                  ? '0 0 20px rgba(0, 245, 212, 0.5)' 
                  : '0 0 20px rgba(255, 0, 110, 0.5)'
              }
            }
          }}
        >
          {/* Custom user button menu items */}
          <UserButton.MenuItems>
            <UserButton.Action
              label="Wallet Details"
              labelIcon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 18V19C21 20.1 20.1 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.9 3.89 3 5 3H19C20.1 3 21 3.9 21 5V6H12C10.89 6 10 6.9 10 8V16C10 17.1 10.89 18 12 18H21ZM12 16H22V8H12V16ZM16 13.5C15.17 13.5 14.5 12.83 14.5 12C14.5 11.17 15.17 10.5 16 10.5C16.83 10.5 17.5 11.17 17.5 12C17.5 12.83 16.83 13.5 16 13.5Z" 
                        fill="currentColor"/>
                </svg>
              }
              onClick={() => {
                // Open a modal or navigate to wallet page
              }}
            />
            {walletAddress && (
              <UserButton.Action
                label={`Balance: ${tokenBalance || '0'} RL80`}
                labelIcon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13.41 18.09V20H10.74V18.07C9.03 17.71 7.58 16.61 7.47 14.67H9.43C9.53 15.82 10.39 16.7 12.08 16.7C13.95 16.7 14.54 15.75 14.54 14.91C14.54 14.21 14.15 13.59 12.58 13.14L10.57 12.54C8.51 11.95 7.63 10.78 7.63 9.21C7.63 7.39 8.97 6.28 10.74 5.93V4H13.42V5.95C15.02 6.34 16.18 7.45 16.26 9.22H14.3C14.25 8.11 13.52 7.31 12.08 7.31C10.65 7.31 9.66 8.02 9.66 9.07C9.66 9.88 10.14 10.33 11.66 10.76L13.67 11.36C15.9 12 16.56 13.05 16.56 14.77C16.56 16.7 15.13 17.73 13.41 18.09Z" 
                          fill="currentColor"/>
                  </svg>
                }
                onClick={() => {}}
              />
            )}
          </UserButton.MenuItems>
        </UserButton>
        
        {/* Status indicator */}
        {isWalletConnected && (
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-black animate-pulse" />
        )}
      </div>
    </div>
  );
}