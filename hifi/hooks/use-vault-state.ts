'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers, BrowserProvider, Contract } from 'ethers';

// Contract addresses from env
const getAddresses = (poolVaultAddress?: string) => ({
  arcUsdc: process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS || '',
  poolVault: poolVaultAddress || process.env.NEXT_PUBLIC_POOL_VAULT_ADDRESS || '',
});

// ABIs
const POOL_VAULT_ABI = [
  'function state() external view returns (uint8)',
  'function cap() external view returns (uint256)',
  'function totalShares() external view returns (uint256)',
  'function shares(address user) external view returns (uint256)',
  'function totalAssets() external view returns (uint256)',
  'function previewWithdraw(address user) external view returns (uint256)',
  'function owner() external view returns (address)',
  'function withdrawWindowEnd() external view returns (uint256)',
  // Actions
  'function deposit(uint256 amount) external',
  'function deploy() external',
  'function deployToAave() external',
  'function openWithdrawWindow(uint256 duration) external',
  'function withdraw(uint256 shareAmount) external',
  'function withdrawAll() external',
  // Optional Aave functions
  'function totalAssetsCollecting() external view returns (uint256)',
  'function totalAssetsDeployed() external view returns (uint256)',
  'function yieldEarned() external view returns (uint256)',
  'function principalDeposited() external view returns (uint256)',
  'function isCapReached() external view returns (bool)',
  'function canWithdraw(address user) external view returns (bool)',
];

const ARC_USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
];

// Vault states
export enum VaultState {
  COLLECTING = 0,
  DEPLOYED = 1,
  WITHDRAW_WINDOW = 2,
}

// UI states for better UX
export type VaultUIState = 
  | 'loading'
  | 'collecting'
  | 'cap_reached'
  | 'deploying'
  | 'deployed'
  | 'withdraw_window'
  | 'withdrawing'
  | 'error';

export interface VaultData {
  // Chain state
  state: VaultState;
  cap: bigint;
  totalAssets: bigint;
  totalShares: bigint;
  userShares: bigint;
  userWithdrawable: bigint;
  owner: string;
  withdrawWindowEnd: bigint;
  
  // Calculated
  progress: number; // 0-100
  isCapReached: boolean;
  isOwner: boolean;
  canDeposit: boolean;
  canDeploy: boolean;
  canWithdraw: boolean;
  
  // Aave specific (if available)
  yieldEarned: bigint;
  principalDeposited: bigint;
  
  // Alias for dashboard compatibility
  tvl: bigint;
}

export interface UseVaultStateReturn {
  vaultData: VaultData | null;
  uiState: VaultUIState;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to read vault state from chain
 * All values come directly from on-chain reads
 */
export function useVaultState(userAddress?: string): UseVaultStateReturn {
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [uiState, setUiState] = useState<VaultUIState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userAddress || typeof window === 'undefined' || !window.ethereum) {
      setLoading(false);
      return;
    }

    const addresses = getAddresses();
    if (!addresses.poolVault || !addresses.arcUsdc) {
      setError('Contract addresses not configured');
      setUiState('error');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const provider = new BrowserProvider(window.ethereum);
      const poolVault = new Contract(addresses.poolVault, POOL_VAULT_ABI, provider);
      const arcUsdc = new Contract(addresses.arcUsdc, ARC_USDC_ABI, provider);

      // Read all on-chain state in parallel
      const [
        stateRaw,
        cap,
        totalShares,
        userShares,
        owner,
        withdrawWindowEnd,
      ] = await Promise.all([
        poolVault.state(),
        poolVault.cap(),
        poolVault.totalShares(),
        poolVault.shares(userAddress),
        poolVault.owner(),
        poolVault.withdrawWindowEnd(),
      ]);

      const state = Number(stateRaw) as VaultState;

      // Read TVL based on state
      // When COLLECTING, use arcUSDC.balanceOf(vault)
      // When DEPLOYED, use vault's totalAssets (which reads aToken balance)
      let totalAssets: bigint;
      let yieldEarned = BigInt(0);
      let principalDeposited = BigInt(0);

      if (state === VaultState.COLLECTING) {
        totalAssets = await arcUsdc.balanceOf(addresses.poolVault);
      } else {
        // Try to read from vault's totalAssets (works for both contract versions)
        totalAssets = await poolVault.totalAssets();
        
        // Try to read Aave-specific data
        try {
          yieldEarned = await poolVault.yieldEarned();
          principalDeposited = await poolVault.principalDeposited();
        } catch {
          // Contract doesn't have Aave functions - ignore
        }
      }

      // Calculate user's withdrawable amount
      let userWithdrawable = BigInt(0);
      if (totalShares > BigInt(0) && userShares > BigInt(0)) {
        userWithdrawable = (userShares * totalAssets) / totalShares;
      }

      // Calculate progress
      const progress = cap > BigInt(0) 
        ? Number((totalAssets * BigInt(100)) / cap)
        : 0;

      const isCapReached = totalAssets >= cap;
      const isOwner = owner.toLowerCase() === userAddress.toLowerCase();
      const now = BigInt(Math.floor(Date.now() / 1000));
      
      const canDeposit = state === VaultState.COLLECTING && !isCapReached;
      const canDeploy = state === VaultState.COLLECTING && isCapReached;
      const canWithdraw = state === VaultState.WITHDRAW_WINDOW 
        && now <= withdrawWindowEnd 
        && userShares > BigInt(0);

      const vaultDataResult: VaultData = {
        state,
        cap,
        totalAssets,
        totalShares,
        userShares,
        userWithdrawable,
        owner,
        withdrawWindowEnd,
        progress: Math.min(progress, 100),
        isCapReached,
        isOwner,
        canDeposit,
        canDeploy,
        canWithdraw,
        yieldEarned,
        principalDeposited,
        tvl: totalAssets, // Alias for dashboard
      };

      setVaultData(vaultDataResult);

      // Set UI state based on chain state
      if (state === VaultState.COLLECTING) {
        setUiState(isCapReached ? 'cap_reached' : 'collecting');
      } else if (state === VaultState.DEPLOYED) {
        setUiState('deployed');
      } else if (state === VaultState.WITHDRAW_WINDOW) {
        setUiState('withdraw_window');
      }

    } catch (err: any) {
      console.error('Error reading vault state:', err);
      setError(err.message || 'Failed to read vault state');
      setUiState('error');
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  // Initial load and periodic refresh
  useEffect(() => {
    refresh();
    
    // Refresh every 15 seconds to catch state changes
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    vaultData,
    uiState,
    error,
    loading,
    refresh,
  };
}
