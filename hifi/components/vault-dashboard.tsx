'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useVaultState, VaultState } from '@/hooks/use-vault-state';
import { useVaultActions, ActionState } from '@/hooks/use-vault-actions';
import { Button } from '@/components/ui/button';

/**
 * Vault Dashboard Component
 * Displays vault state, TVL, user position, and actions
 * All data read from chain - no simulated balances
 */
export function VaultDashboard() {
  const [address, setAddress] = useState<string | null>(null);

  // Fetch vault state and user data from chain
  const {
    vaultData,
    loading: stateLoading,
    error: stateError,
    refresh: refreshState,
  } = useVaultState(address || undefined);

  // Vault actions with auto-refresh on success
  const {
    actionState,
    actionMessage,
    lastTxHash,
    error: actionError,
    deployToAave,
    withdrawAll,
    openWithdrawWindow,
    reset: resetAction,
  } = useVaultActions(refreshState);

  // Get connected wallet address
  useEffect(() => {
    const getAddress = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ 
            method: 'eth_accounts' 
          });
          if (accounts?.length > 0) {
            setAddress(accounts[0]);
          }
        } catch (err) {
          console.error('Failed to get accounts:', err);
        }
      }
    };
    getAddress();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) setAddress(accounts[0]);
      });
    }
  }, []);

  // Format values
  const formatUSDC = (value: bigint) => {
    return parseFloat(ethers.formatUnits(value, 6)).toFixed(2);
  };

  const formatPercentage = (value: number) => {
    return value.toFixed(1);
  };

  // Get state display info
  const getStateDisplay = () => {
    if (!vaultData) return { label: 'Loading...', color: 'text-gray-400' };
    
    switch (vaultData.state) {
      case VaultState.COLLECTING:
        return { 
          label: `Collecting (${formatUSDC(vaultData.tvl)} / ${formatUSDC(vaultData.cap)} USDC)`,
          color: 'text-yellow-400'
        };
      case VaultState.DEPLOYED:
        return { 
          label: vaultData.userShares > BigInt(0) ? 'Withdraw Window Open' : 'Deployed (Earning yield)',
          color: vaultData.userShares > BigInt(0) ? 'text-blue-400' : 'text-green-400'
        };
      case VaultState.WITHDRAW_WINDOW:
        return { 
          label: `Withdraw Window Open`,
          color: 'text-blue-400'
        };
      default:
        return { label: 'Unknown', color: 'text-gray-400' };
    }
  };

  // Get action button based on state
  const renderActionButton = () => {
    if (!vaultData) return null;
    
    const isActionPending = ['checking', 'approving', 'pending', 'confirming'].includes(actionState);

    // COLLECTING state - show deploy button when cap reached
    if (vaultData.state === VaultState.COLLECTING) {
      if (vaultData.canDeploy) {
        return (
          <Button
            onClick={deployToAave}
            disabled={isActionPending}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {isActionPending ? actionMessage : 'Deploy to Aave'}
          </Button>
        );
      }
      return (
        <div className="text-center text-gray-400 text-sm">
          Waiting for cap to be reached ({formatPercentage(vaultData.progress)}% filled)
        </div>
      );
    }

    // DEPLOYED state - V2 pools: users can withdraw after deploy delay; show withdraw button if user has shares
    if (vaultData.state === VaultState.DEPLOYED) {
      if (vaultData.canWithdraw && vaultData.userShares > BigInt(0)) {
        const isCircle = vaultData.vaultOwnerMode === 'circle';
        const buttonLabel = isCircle
          ? 'Withdraw All (AI Wallet)'
          : 'Withdraw All (MetaMask)';
        
        return (
          <Button
            onClick={() => withdrawAll(undefined, vaultData.vaultOwnerMode)}
            disabled={isActionPending}
            className={`w-full ${isCircle ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isActionPending ? actionMessage : buttonLabel}
          </Button>
        );
      }
      if (vaultData.isOwner) {
        return (
          <Button
            onClick={() => openWithdrawWindow(86400)} // 24 hours
            disabled={isActionPending}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isActionPending ? actionMessage : 'Open Withdraw Window (24h)'}
          </Button>
        );
      }
      return (
        <div className="text-center text-green-400 text-sm">
          Earning yield on Aave - waiting for withdraw window
        </div>
      );
    }

    // WITHDRAW_WINDOW state - show withdraw button
    if (vaultData.state === VaultState.WITHDRAW_WINDOW) {
      if (vaultData.canWithdraw && vaultData.userShares > BigInt(0)) {
        const isCircle = vaultData.vaultOwnerMode === 'circle';
        const buttonLabel = isCircle
          ? 'Withdraw All (AI Wallet)'
          : 'Withdraw All (MetaMask)';
        
        return (
          <Button
            onClick={() => withdrawAll(undefined, vaultData.vaultOwnerMode)}
            disabled={isActionPending}
            className={`w-full ${isCircle ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isActionPending ? actionMessage : buttonLabel}
          </Button>
        );
      }
      if (vaultData.userShares === BigInt(0)) {
        return (
          <div className="text-center text-gray-400 text-sm">
            No shares to withdraw
          </div>
        );
      }
    }

    return null;
  };

  // Loading state
  if (stateLoading && !vaultData) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3 mb-4"></div>
          <div className="h-10 bg-gray-700 rounded w-full"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (stateError && !vaultData) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-red-700">
        <div className="text-red-400 text-center">
          <p className="font-semibold mb-2">Failed to load vault data</p>
          <p className="text-sm">{stateError}</p>
          <Button onClick={refreshState} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const stateDisplay = getStateDisplay();

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
      {/* Header with state */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Pool Vault</h2>
          <span className={`text-sm ${stateDisplay.color}`}>
            {stateDisplay.label}
          </span>
        </div>
        <button
          onClick={refreshState}
          disabled={stateLoading}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg 
            className={`w-5 h-5 ${stateLoading ? 'animate-spin' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
        </button>
      </div>

      {/* Progress bar for COLLECTING state */}
      {vaultData && vaultData.state === VaultState.COLLECTING && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Progress</span>
            <span>{formatPercentage(vaultData.progress)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-yellow-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(vaultData.progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Vault Stats */}
      {vaultData && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Total Value Locked</div>
            <div className="text-white font-bold text-lg">
              ${formatUSDC(vaultData.tvl)} USDC
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Your Position</div>
            <div className="text-white font-bold text-lg">
              ${formatUSDC(vaultData.userShares)} USDC
            </div>
            {vaultData.vaultOwnerMode !== 'none' && (
              <div className={`text-xs mt-1 ${vaultData.vaultOwnerMode === 'circle' ? 'text-purple-400' : 'text-orange-400'}`}>
                via {vaultData.vaultOwnerMode === 'circle' ? 'AI Wallet' : 'MetaMask'}
              </div>
            )}
          </div>
          {vaultData.state === VaultState.DEPLOYED && vaultData.yieldEarned > BigInt(0) && (
            <>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Yield Earned</div>
                <div className="text-green-400 font-bold text-lg">
                  +${formatUSDC(vaultData.yieldEarned)} USDC
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">APY (Est.)</div>
                <div className="text-green-400 font-bold text-lg">
                  ~3.5%
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Action Section */}
      <div className="space-y-3">
        {renderActionButton()}
        
        {/* Action Success/Error Messages */}
        {actionState === 'success' && (
          <div className="bg-green-900/50 border border-green-700 rounded-lg p-3 text-center">
            <span className="text-green-400">{actionMessage}</span>
            {lastTxHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-400 text-sm mt-1 hover:underline"
              >
                View on BaseScan
              </a>
            )}
          </div>
        )}
        
        {actionState === 'error' && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-center">
            <span className="text-red-400">{actionError}</span>
            <Button 
              onClick={resetAction} 
              variant="outline" 
              size="sm"
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>

      {/* User Info */}
      {address && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Connected Wallet</span>
            <span className="text-gray-300 font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
          {vaultData?.isOwner && (
            <div className="mt-2 text-xs text-purple-400 text-center">
              (You are the vault owner)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
