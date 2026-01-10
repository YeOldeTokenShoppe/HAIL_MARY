'use client';

import { useState, useEffect } from 'react';
import { useWalletAuth } from './WalletAuthProvider';
import { useStaking } from '@/hooks/useStaking';
import { TransactionButton, useSendAndConfirmTransaction, useActiveAccount } from "thirdweb/react";
import { stakingTransactions, stakingContract } from '@/lib/stakingContract';
import { toWei } from "thirdweb/utils";
import { tokenFunctions, erc20Contract } from '@/lib/contract';
import { sendTransaction } from "thirdweb";
import { approve } from "thirdweb/extensions/erc20";


export function WalletDetailsModal({ onClose }) {
  const { 
    walletAddress, 
    tokenBalance, 
    disconnectWallet,
    refreshBalance
  } = useWalletAuth();

  const {
    stakedBalance,
    earnedRewards,
    apr,
    totalStaked,
    minClaimAmount,
    claimRewards,
    unstakeTokens,
    unstakeAll,
    isLoading: isLoadingStaking,
    refreshData: refreshStaking
  } = useStaking();

  const [copied, setCopied] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState(''); // 'approving', 'waiting', 'confirmed', etc.
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);
  
  const { mutate: sendTransactionHook } = useSendAndConfirmTransaction();
  const activeAccount = useActiveAccount();

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    await disconnectWallet();
    onClose();
  };
  
  // Manual approval function for testing
  const handleManualApprove = async () => {
    if (!stakeAmount || isApproving || !activeAccount) return;
    
    try {
      setIsApproving(true);
      const amount = toWei(stakeAmount);
      console.log('Manual approve - amount:', stakeAmount);
      console.log('Manual approve - amount in wei:', amount.toString());
      console.log('Manual approve - spender:', stakingContract.address);
      console.log('Active account:', activeAccount);
      
      // Check actual balance first
      const balance = await tokenFunctions.getBalance(walletAddress);
      console.log('Your actual RL80 balance:', balance.toString());
      console.log('Amount you want to approve:', amount.toString());
      console.log('Do you have enough?', BigInt(balance) >= BigInt(amount));
      
      if (BigInt(balance) < BigInt(amount)) {
        alert(`Insufficient RL80 balance. You have ${balance} but need ${amount}`);
        setIsApproving(false);
        return;
      }
      
      const transaction = tokenFunctions.approve(stakingContract.address, amount);
      console.log('Manual approve - transaction prepared:', transaction);
      
      setTransactionStatus('approving');
      
      // Send transaction directly using the imported sendTransaction
      const result = await sendTransaction({
        transaction,
        account: activeAccount
      });
      
      console.log('Transaction sent, waiting for confirmation...');
      setTransactionStatus('waiting');
      
      // Wait a bit for the transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Manual approve success:', result);
      
      // Re-check allowance
      const newAllowance = await tokenFunctions.getAllowance(walletAddress, stakingContract.address);
      console.log('New allowance:', newAllowance.toString());
      
      if (BigInt(newAllowance) >= BigInt(amount)) {
        setNeedsApproval(false);
        setTransactionStatus('confirmed');
        
        // Wait 2 seconds showing confirmed, then update balances
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setTransactionStatus('updating');
        setIsUpdatingBalance(true);
        
        // Refresh balances
        await refreshStaking();
        await refreshBalance();
        
        setIsUpdatingBalance(false);
        setTransactionStatus('');
      } else {
        setTransactionStatus('failed');
        alert('Approval may have failed - please check again');
      }
    } catch (error) {
      console.error('Error in manual approve:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsApproving(false);
    }
  };

  // Refresh all data when modal opens
  useEffect(() => {
    if (walletAddress) {
      refreshBalance();
      refreshStaking();
    }
  }, [walletAddress]);
  
  // Check approval when stake amount changes
  useEffect(() => {
    const checkApproval = async () => {
      if (!walletAddress || !stakeAmount || stakeAmount === '0') {
        setNeedsApproval(false);
        return;
      }
      
      try {
        setIsCheckingApproval(true);
        const amountInWei = toWei(stakeAmount);
        console.log('Checking approval for amount:', stakeAmount);
        console.log('Amount in wei:', amountInWei.toString());
        
        // Get the RL80 token address from staking contract
        const { stakingFunctions } = await import('@/lib/stakingContract');
        const rl80TokenAddress = await stakingFunctions.getRl80TokenAddress();
        console.log('RL80 Token address from staking contract:', rl80TokenAddress);
        console.log('HAIL Token address from contract.js:', (await import('@/lib/contract')).erc20Contract.address);
        
        // Check ETH balance for gas
        try {
          const { client, chain } = await import('@/lib/contract');
          const { getWalletBalance } = await import('thirdweb/wallets');
          // We'll just log this for debugging
          console.log('Checking ETH balance for gas...');
        } catch (e) {
          console.error('Error checking ETH balance:', e);
        }
        
        // The staking contract expects RL80 tokens, but we need to check/approve our HAIL (ERC20) token
        const currentAllowance = await tokenFunctions.getAllowance(walletAddress, stakingContract.address);
        console.log('Current allowance:', currentAllowance.toString());
        
        const userBalance = await tokenFunctions.getBalance(walletAddress);
        console.log('User RL80 balance:', userBalance.toString());
        
        // Check if user has enough balance
        if (BigInt(userBalance) < BigInt(amountInWei)) {
          console.error('Insufficient balance:', userBalance.toString(), 'needed:', amountInWei.toString());
        }
        
        setNeedsApproval(BigInt(currentAllowance) < BigInt(amountInWei));
      } catch (error) {
        console.error('Error checking approval:', error);
        setNeedsApproval(true); // Default to needing approval on error
      } finally {
        setIsCheckingApproval(false);
      }
    };
    
    if (showStakeModal) {
      checkApproval();
    }
  }, [stakeAmount, showStakeModal, walletAddress]);

  return (
    <div className="wallet-details-overlay" onClick={onClose}>
      <div className="wallet-details-modal" onClick={(e) => e.stopPropagation()}>
        <button className="wallet-modal-close" onClick={onClose}>×</button>
        
        {/* Header */}
        <div className="wallet-details-header">
          <h2>Wallet Details</h2>
          <div className="wallet-status-badge">
            <div className="status-dot" />
            Connected
          </div>
        </div>

        {/* Wallet Address Section */}
        <div className="wallet-section">
          <h3>Address</h3>
          <div className="wallet-address-box">
            <span className="wallet-address-text">
              {walletAddress}
            </span>
            <button 
              className="copy-button"
              onClick={handleCopyAddress}
              title="Copy address"
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>
        </div>

        {/* Balance Section */}
        <div className="wallet-section">
          <h3>Balance</h3>
          <div className="balance-grid">
            <div className="balance-item">
              <span className="balance-label">RL80 Tokens</span>
              <span className="balance-value">{tokenBalance || '0'}</span>
            </div>
            <button 
              className="refresh-button"
              onClick={refreshBalance}
              title="Refresh balance"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Staking Section */}
        <div className="wallet-section">
          <h3 style={{ display: 'block', width: '100%', marginBottom: '12px' }}>Staking Activity</h3>
          {isLoadingStaking ? (
            <div className="loading-spinner">Loading staking data...</div>
          ) : (
            <div style={{ width: '100%' }}>
              <div className="staking-grid">
                <div className="staking-item">
                  <span className="staking-label">Staked Amount</span>
                  <span className="staking-value">
                    {isUpdatingBalance ? '⏳ Updating...' : `${stakedBalance || '0'} RL80`}
                  </span>
                </div>
                <div className="staking-item">
                  <span className="staking-label">Rewards Earned</span>
                  <span className="staking-value rewards">{earnedRewards || '0'} ETH</span>
                </div>
                <div className="staking-item">
                  <span className="staking-label">APR</span>
                  <span className="staking-value apr">{apr || '0'}%</span>
                </div>
                <div className="staking-item">
                  <span className="staking-label">Total Pool</span>
                  <span className="staking-value">{totalStaked || '0'} RL80</span>
                </div>
              </div>
              
              {earnedRewards && parseFloat(earnedRewards) > 0 && (
                <div className="next-reward-box">
                  <span>Claimable Rewards: {earnedRewards} ETH</span>
                  <span className="time-label">Ready to claim!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="wallet-actions">
          <button 
            className="action-button stake"
            onClick={() => setShowStakeModal(true)}
          >
            Stake RL80
          </button>
          
          {stakedBalance && parseFloat(stakedBalance) > 0 && (
            <TransactionButton
              transaction={() => stakingTransactions.prepareUnstakeAll()}
              onTransactionSent={() => {
                console.log("Unstake transaction sent");
                setTransactionStatus('waiting');
              }}
              onTransactionConfirmed={async () => {
                console.log("Unstake successful");
                setTransactionStatus('confirmed');
                
                // Wait 2 seconds showing confirmed
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                setTransactionStatus('updating');
                setIsUpdatingBalance(true);
                
                await refreshStaking();
                await refreshBalance();
                
                setIsUpdatingBalance(false);
                setTransactionStatus('');
              }}
              onError={(error) => {
                console.error("Unstake failed:", error);
                alert("Failed to unstake: " + error.message);
              }}
              className="action-button unstake"
              style={{ backgroundColor: '#ff6b6b' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <span>Unstake All</span>
                <span style={{ fontSize: '9px', opacity: 0.8 }}>({stakedBalance} RL80)</span>
              </div>
            </TransactionButton>
          )}
          
          {earnedRewards && parseFloat(earnedRewards) > 0 ? (
            <TransactionButton
              transaction={() => stakingTransactions.prepareClaim()}
              onTransactionConfirmed={async () => {
                await refreshStaking();
                await refreshBalance();
              }}
              onError={(error) => {
                console.error("Claim failed:", error);
                alert("Failed to claim rewards: " + error.message);
              }}
              className="action-button claim"
            >
              Claim {earnedRewards} ETH
            </TransactionButton>
          ) : (
            <button className="action-button claim" disabled style={{ opacity: 0.5 }}>
              No Rewards
            </button>
          )}
          
          <button 
            className="action-button disconnect"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
        
        {/* Stake Modal */}
        {showStakeModal && (
          <div className="stake-modal-overlay" onClick={() => setShowStakeModal(false)}>
            <div className="stake-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Stake RL80 Tokens</h3>
              <button className="modal-close-btn" onClick={() => setShowStakeModal(false)}>×</button>
              
              {/* Transaction Status Banner */}
              {transactionStatus && (
                <div style={{
                  padding: '10px',
                  marginBottom: '15px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  backgroundColor: 
                    transactionStatus === 'approving' ? '#FFA500' :
                    transactionStatus === 'waiting' ? '#4169E1' :
                    transactionStatus === 'confirmed' ? '#4CAF50' :
                    transactionStatus === 'updating' ? '#9C27B0' :
                    transactionStatus === 'failed' ? '#f44336' : '#ccc',
                  color: 'white'
                }}>
                  {transactionStatus === 'approving' && '🔄 Sending approval transaction...'}
                  {transactionStatus === 'waiting' && '⏳ Waiting for blockchain confirmation...'}
                  {transactionStatus === 'confirmed' && '✅ Approval confirmed! You can now stake.'}
                  {transactionStatus === 'updating' && '🔄 Updating balances, please wait...'}
                  {transactionStatus === 'failed' && '❌ Transaction failed. Please try again.'}
                </div>
              )}
              
              <div className="stake-input-group">
                <label>Amount to Stake</label>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <div className="balance-hint">
                  Available: {tokenBalance || '0'} RL80
                </div>
              </div>
              
              <div className="stake-info">
                <div>Min Claim Amount: {minClaimAmount || '0.005'} ETH</div>
                <div>Current APR: {apr || '0'}%</div>
                {needsApproval && (
                  <button 
                    onClick={handleManualApprove}
                    disabled={isApproving}
                    style={{
                      marginTop: '10px',
                      padding: '8px 16px',
                      background: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isApproving ? 'wait' : 'pointer'
                    }}
                  >
                    {isApproving ? 'Approving...' : 'Test Manual Approve'}
                  </button>
                )}
              </div>
              
              <div className="stake-actions">
                {needsApproval ? (
                  <TransactionButton
                    transaction={() => {
                      const amount = toWei(stakeAmount || '0');
                      console.log('Approving amount:', stakeAmount);
                      console.log('Approval amount in wei:', amount.toString());
                      console.log('Spender address:', stakingContract.address);
                      // Use prepareApprove which returns the prepared transaction
                      return tokenFunctions.prepareApprove(stakingContract.address, amount);
                    }}
                    onTransactionSent={() => {
                      console.log("Approval transaction sent");
                      setTransactionStatus('waiting');
                    }}
                    onTransactionConfirmed={async (receipt) => {
                      console.log("Approval successful:", receipt);
                      setTransactionStatus('confirmed');
                      // Re-check the allowance after approval
                      try {
                        const newAllowance = await tokenFunctions.getAllowance(walletAddress, stakingContract.address);
                        console.log("New allowance after approval:", newAllowance.toString());
                        if (BigInt(newAllowance) >= BigInt(toWei(stakeAmount || '0'))) {
                          setNeedsApproval(false);
                        } else {
                          console.error("Approval didn't set expected allowance");
                        }
                      } catch (error) {
                        console.error("Error checking new allowance:", error);
                      }
                      setTimeout(() => setTransactionStatus(''), 3000);
                    }}
                    onError={(error) => {
                      console.error("Approval failed - Full error object:", error);
                      console.error("Error name:", error.name);
                      console.error("Error message:", error.message);
                      console.error("Error cause:", error.cause);
                      console.error("Error details:", error.details);
                      console.error("Error data:", error.data);
                      
                      // Check if it's a user rejection
                      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
                        alert("Transaction was rejected by user");
                      } else if (error.message?.includes('insufficient')) {
                        alert("Insufficient funds for gas. Please add more ETH to your wallet.");
                      } else {
                        alert("Failed to approve: " + (error.shortMessage || error.message));
                      }
                    }}
                    disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || isCheckingApproval}
                    className="action-button stake"
                  >
                    {isCheckingApproval ? 'Checking...' : `Approve ${stakeAmount || '0'} RL80`}
                  </TransactionButton>
                ) : (
                  <TransactionButton
                    transaction={() => {
                      const amount = toWei(stakeAmount || '0');
                      console.log('Staking amount:', stakeAmount);
                      console.log('Staking amount in wei:', amount.toString());
                      console.log('Staking contract address:', stakingContract.address);
                      return stakingTransactions.prepareStake(amount);
                    }}
                    onTransactionSent={(result) => {
                      console.log("Stake transaction sent:", result);
                    }}
                    onTransactionConfirmed={async (receipt) => {
                      console.log("Stake successful:", receipt);
                      setTransactionStatus('confirmed');
                      
                      // Wait 2 seconds showing confirmed
                      await new Promise(resolve => setTimeout(resolve, 2000));
                      
                      setTransactionStatus('updating');
                      setIsUpdatingBalance(true);
                      
                      await refreshStaking();
                      await refreshBalance();
                      
                      setIsUpdatingBalance(false);
                      setShowStakeModal(false);
                      setStakeAmount('');
                      setTransactionStatus('');
                    }}
                    onError={(error) => {
                      console.error("Stake failed - Full error:", error);
                      // Check for specific error types
                      if (error.message?.includes('insufficient')) {
                        alert("Insufficient tokens. Please check your balance.");
                      } else if (error.message?.includes('allowance')) {
                        alert("Insufficient allowance. Please approve tokens first.");
                        setNeedsApproval(true);
                      } else {
                        alert("Failed to stake: " + (error.shortMessage || error.message));
                      }
                    }}
                    disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || isCheckingApproval}
                    className="action-button stake"
                  >
                    {isCheckingApproval ? 'Checking...' : `Stake ${stakeAmount || '0'} RL80`}
                  </TransactionButton>
                )}
                
                <button 
                  className="action-button cancel"
                  onClick={() => {
                    setShowStakeModal(false);
                    setStakeAmount('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Explorer Link */}
        <div className="explorer-link">
          <a 
            href={`https://sepolia.basescan.org/address/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Explorer →
          </a>
        </div>
      </div>
      
      <WalletDetailsStyles />
    </div>
  );
}

// Styles component
export const WalletDetailsStyles = () => (
  <style jsx global>{`
    .wallet-details-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(15px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .wallet-details-modal {
      background: rgba(20, 20, 30, 0.95);
      border: 1px solid rgba(0, 245, 212, 0.2);
      border-radius: 16px;
      padding: 20px;
      max-width: 480px;
      width: 90%;
      max-height: 85vh;
      overflow-y: auto;
      position: relative;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(20px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Scrollbar Styling */
    .wallet-details-modal::-webkit-scrollbar {
      width: 8px;
    }
    
    .wallet-details-modal::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
    }
    
    .wallet-details-modal::-webkit-scrollbar-thumb {
      background: rgba(0, 245, 212, 0.4);
      border-radius: 4px;
    }
    
    .wallet-details-modal::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 245, 212, 0.6);
    }

    /* Header */
    .wallet-details-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 25px;
    }

    .wallet-details-header h2 {
      color: #fff;
      font-size: 18px;
      font-weight: 600;
      font-family: 'Orbitron', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0;
      text-shadow: 0 0 10px rgba(0, 245, 212, 0.3);
    }

    .wallet-status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(0, 255, 136, 0.1);
      border: 1px solid rgba(0, 255, 136, 0.4);
      border-radius: 20px;
      color: #00ff88;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Orbitron', monospace;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: #00ff88;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Sections */
    .wallet-section {
      margin-bottom: 20px;
      display: block !important;
      width: 100% !important;
    }

    .wallet-section h3 {
      color: #00f5d4;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Orbitron', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0 0 10px 0;
      width: 100%;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(0, 245, 212, 0.1);
    }

    /* Address Box */
    .wallet-address-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(0, 245, 212, 0.2);
      border-radius: 12px;
    }

    .wallet-address-text {
      flex: 1;
      color: #fff;
      font-family: monospace;
      font-size: 13px;
      word-break: break-all;
    }

    .copy-button, .refresh-button {
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
      color: rgba(255, 255, 255, 0.6);
    }

    .copy-button:hover, .refresh-button:hover {
      background: rgba(0, 245, 212, 0.1);
      border-color: rgba(0, 245, 212, 0.3);
      color: #00f5d4;
    }

    /* Balance Grid */
    .balance-grid {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(0, 245, 212, 0.2);
      border-radius: 12px;
    }

    .balance-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .balance-label {
      color: rgba(255, 255, 255, 0.6);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .balance-value {
      color: #00f5d4;
      font-size: 20px;
      font-weight: 600;
      font-family: 'Orbitron', monospace;
      text-shadow: 0 0 10px rgba(0, 245, 212, 0.4);
    }

    /* Staking Grid */
    .staking-grid {
      display: grid !important;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 10px;
      width: 100%;
      clear: both;
    }

    .staking-item {
      padding: 10px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(138, 43, 226, 0.2);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0; /* Allows content to shrink */
    }

    .staking-label {
      color: rgba(255, 255, 255, 0.5);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-family: 'Orbitron', monospace;
      line-height: 1;
    }

    .staking-value {
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      font-family: 'Orbitron', monospace;
      line-height: 1.2;
    }

    .staking-value.rewards {
      color: #00ff88;
    }

    .staking-value.apr {
      color: #ff006e;
    }

    /* Next Reward Box */
    .next-reward-box {
      padding: 10px;
      background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 245, 212, 0.1));
      border: 1px solid rgba(0, 255, 136, 0.3);
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .next-reward-box span {
      color: #00ff88;
      font-size: 11px;
      font-weight: 600;
      font-family: 'Orbitron', monospace;
    }

    .time-label {
      color: rgba(255, 255, 255, 0.6) !important;
      font-size: 10px !important;
    }

    /* Actions */
    .wallet-actions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 20px;
    }

    .action-button {
      padding: 10px 8px;
      border-radius: 8px;
      border: none;
      font-size: 11px;
      font-weight: bold;
      font-family: 'Orbitron', monospace;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.2s;
      min-height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      width: 100%;
      box-sizing: border-box;
    }

    .action-button.stake {
      background: linear-gradient(135deg, #00f5d4, #00bbf9);
      color: #000;
    }

    .action-button.stake:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(0, 245, 212, 0.4);
    }

    .action-button.claim {
      background: linear-gradient(135deg, #00ff88, #00f5d4);
      color: #000;
    }

    .action-button.claim:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(0, 255, 136, 0.4);
    }

    .action-button.disconnect {
      background: rgba(255, 0, 110, 0.1);
      border: 1px solid rgba(255, 0, 110, 0.4);
      color: #ff006e;
    }

    .action-button.disconnect:hover {
      background: rgba(255, 0, 110, 0.2);
      transform: translateY(-2px);
    }

    /* Explorer Link */
    .explorer-link {
      text-align: center;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .explorer-link a {
      color: #00f5d4;
      font-size: 12px;
      text-decoration: none;
      font-family: 'Orbitron', monospace;
      transition: all 0.2s;
    }

    .explorer-link a:hover {
      color: #fff;
      text-shadow: 0 0 10px rgba(0, 245, 212, 0.8);
    }

    /* Close Button */
    .wallet-modal-close {
      position: absolute;
      top: 12px;
      right: 12px;
      background: transparent;
      color: rgba(255, 255, 255, 0.5);
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: none;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .wallet-modal-close:hover {
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.1);
    }

    /* Stake Modal Styles */
    .stake-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10002;
    }

    .stake-modal {
      background: linear-gradient(135deg, rgba(30, 30, 45, 0.98), rgba(40, 30, 55, 0.98));
      border: 2px solid rgba(0, 245, 212, 0.4);
      border-radius: 20px;
      padding: 30px;
      max-width: 420px;
      width: 90%;
      position: relative;
      box-shadow: 0 0 60px rgba(0, 245, 212, 0.4);
    }

    .stake-modal h3 {
      color: #fff;
      font-size: 20px;
      font-weight: bold;
      font-family: 'Orbitron', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0 0 25px 0;
      text-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
    }

    .modal-close-btn {
      position: absolute;
      top: 15px;
      right: 15px;
      background: #ff006e;
      color: #fff;
      width: 28px;
      height: 28px;
      border-radius: 4px;
      border: none;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .modal-close-btn:hover {
      background: #ff1a7d;
      transform: scale(1.1);
    }

    .stake-input-group {
      margin-bottom: 20px;
    }

    .stake-input-group label {
      display: block;
      color: #00f5d4;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Orbitron', monospace;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .stake-input-group input {
      width: 100%;
      padding: 12px;
      background: rgba(0, 0, 0, 0.5);
      border: 2px solid rgba(0, 245, 212, 0.3);
      border-radius: 10px;
      color: #fff;
      font-size: 18px;
      font-family: 'Orbitron', monospace;
      transition: all 0.2s;
    }

    .stake-input-group input:focus {
      outline: none;
      border-color: #00f5d4;
      box-shadow: 0 0 20px rgba(0, 245, 212, 0.3);
    }

    .balance-hint {
      color: rgba(0, 245, 212, 0.6);
      font-size: 11px;
      font-family: 'Orbitron', monospace;
      margin-top: 6px;
    }

    .stake-info {
      padding: 15px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      font-family: 'Orbitron', monospace;
    }

    .stake-actions {
      display: flex;
      gap: 10px;
    }

    .stake-actions .action-button {
      flex: 1;
    }

    .action-button.cancel {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: rgba(255, 255, 255, 0.8);
    }

    .action-button.cancel:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* Loading Spinner */
    .loading-spinner {
      text-align: center;
      color: #00f5d4;
      padding: 20px;
      font-family: 'Orbitron', monospace;
      font-size: 13px;
    }

    /* Mobile Responsive */
    @media (max-width: 480px) {
      .wallet-details-modal {
        padding: 20px;
        width: 95%;
      }

      .staking-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
      }

      .wallet-actions {
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
      }
      
      .action-button {
        font-size: 10px;
        padding: 8px 6px;
        min-height: 38px;
      }

      .stake-modal {
        width: 95%;
        padding: 20px;
      }

      .stake-actions {
        flex-direction: column;
      }
    }
  `}</style>
);