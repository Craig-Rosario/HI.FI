'use client';

import { useState, useCallback } from 'react';
import { ethers, BrowserProvider, Contract } from 'ethers';
import { VaultState } from './use-vault-state';

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
  'function owner() external view returns (address)',
  'function withdrawWindowEnd() external view returns (uint256)',
  // Actions
  'function deposit(uint256 amount) external',
  'function deploy() external',
  'function deployToAave() external',
  'function openWithdrawWindow(uint256 duration) external',
  'function withdraw(uint256 shareAmount) external',
  'function withdrawAll() external',
];

const ARC_USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
];

export type ActionState = 
  | 'idle'
  | 'checking'
  | 'approving'
  | 'pending'
  | 'confirming'
  | 'success'
  | 'error';

export interface ActionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface UseVaultActionsReturn {
  // State
  actionState: ActionState;
  actionMessage: string;
  lastTxHash: string | null;
  error: string | null;
  
  // Actions
  deployToAave: () => Promise<ActionResult>;
  withdraw: (shareAmount?: bigint) => Promise<ActionResult>;
  withdrawAll: () => Promise<ActionResult>;
  openWithdrawWindow: (durationSeconds: number) => Promise<ActionResult>;
  
  // Reset
  reset: () => void;
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (accounts: string[]) => void) => void;
      removeListener: (event: string, callback: (accounts: string[]) => void) => void;
    };
  }
}

/**
 * Hook for vault actions (deploy, withdraw)
 * Validates on-chain state before executing
 */
export function useVaultActions(onSuccess?: () => void): UseVaultActionsReturn {
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [actionMessage, setActionMessage] = useState('');
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setActionState('idle');
    setActionMessage('');
    setLastTxHash(null);
    setError(null);
  }, []);

  const getSigner = async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }
    const provider = new BrowserProvider(window.ethereum);
    return provider.getSigner();
  };

  /**
   * Deploy funds to Aave
   * Permissionless - anyone can call when cap is reached
   */
  const deployToAave = useCallback(async (): Promise<ActionResult> => {
    const addresses = getAddresses();
    
    try {
      reset();
      setActionState('checking');
      setActionMessage('Verifying vault state on-chain...');

      const signer = await getSigner();
      const poolVault = new Contract(addresses.poolVault, POOL_VAULT_ABI, signer);
      const arcUsdc = new Contract(addresses.arcUsdc, ARC_USDC_ABI, signer);

      // Verify on-chain state before deploying
      const [state, cap] = await Promise.all([
        poolVault.state(),
        poolVault.cap(),
      ]);

      if (Number(state) !== VaultState.COLLECTING) {
        throw new Error('Vault is not in COLLECTING state');
      }

      const totalAssets = await arcUsdc.balanceOf(addresses.poolVault);
      
      if (totalAssets < cap) {
        throw new Error(`Cap not reached. Current: ${ethers.formatUnits(totalAssets, 6)}, Required: ${ethers.formatUnits(cap, 6)} USDC`);
      }

      // Try deployToAave first (new contract), fall back to deploy (old contract)
      setActionState('pending');
      setActionMessage('Deploying to Aave (MetaMask popup)...');

      let tx;
      try {
        tx = await poolVault.deployToAave();
      } catch {
        // Try the old deploy function
        tx = await poolVault.deploy();
      }

      setActionState('confirming');
      setActionMessage('Waiting for confirmation...');
      setLastTxHash(tx.hash);

      await tx.wait();

      setActionState('success');
      setActionMessage('Successfully deployed to Aave!');
      
      onSuccess?.();
      
      return { success: true, txHash: tx.hash };

    } catch (err: any) {
      console.error('Deploy error:', err);
      const errorMsg = err.message || 'Deploy failed';
      setActionState('error');
      setActionMessage(errorMsg);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [reset, onSuccess]);

  /**
   * Withdraw shares
   * Validates on-chain that withdrawal is allowed
   */
  const withdraw = useCallback(async (shareAmount?: bigint): Promise<ActionResult> => {
    const addresses = getAddresses();
    
    try {
      reset();
      setActionState('checking');
      setActionMessage('Verifying withdrawal eligibility on-chain...');

      const signer = await getSigner();
      const userAddress = await signer.getAddress();
      const poolVault = new Contract(addresses.poolVault, POOL_VAULT_ABI, signer);

      // Verify on-chain state
      const [state, withdrawWindowEnd, userShares] = await Promise.all([
        poolVault.state(),
        poolVault.withdrawWindowEnd(),
        poolVault.shares(userAddress),
      ]);

      if (Number(state) !== VaultState.WITHDRAW_WINDOW) {
        throw new Error('Withdraw window is not open');
      }

      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now > withdrawWindowEnd) {
        throw new Error('Withdraw window has expired');
      }

      if (userShares === BigInt(0)) {
        throw new Error('You have no shares to withdraw');
      }

      const amountToWithdraw = shareAmount || userShares;
      if (amountToWithdraw > userShares) {
        throw new Error('Insufficient shares');
      }

      setActionState('pending');
      setActionMessage('Withdrawing (MetaMask popup)...');

      const tx = await poolVault.withdraw(amountToWithdraw);

      setActionState('confirming');
      setActionMessage('Waiting for confirmation...');
      setLastTxHash(tx.hash);

      await tx.wait();

      setActionState('success');
      setActionMessage('Withdrawal complete!');
      
      onSuccess?.();
      
      return { success: true, txHash: tx.hash };

    } catch (err: any) {
      console.error('Withdraw error:', err);
      const errorMsg = err.message || 'Withdrawal failed';
      setActionState('error');
      setActionMessage(errorMsg);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [reset, onSuccess]);

  /**
   * Withdraw all shares
   */
  const withdrawAll = useCallback(async (): Promise<ActionResult> => {
    const addresses = getAddresses();
    
    try {
      reset();
      setActionState('checking');
      setActionMessage('Verifying withdrawal eligibility on-chain...');

      const signer = await getSigner();
      const userAddress = await signer.getAddress();
      const poolVault = new Contract(addresses.poolVault, POOL_VAULT_ABI, signer);

      // Verify on-chain state
      const [state, withdrawWindowEnd, userShares] = await Promise.all([
        poolVault.state(),
        poolVault.withdrawWindowEnd(),
        poolVault.shares(userAddress),
      ]);

      if (Number(state) !== VaultState.WITHDRAW_WINDOW) {
        throw new Error('Withdraw window is not open');
      }

      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now > withdrawWindowEnd) {
        throw new Error('Withdraw window has expired');
      }

      if (userShares === BigInt(0)) {
        throw new Error('You have no shares to withdraw');
      }

      setActionState('pending');
      setActionMessage('Withdrawing all shares (MetaMask popup)...');

      // Try withdrawAll first, fall back to withdraw(userShares)
      let tx;
      try {
        tx = await poolVault.withdrawAll();
      } catch {
        tx = await poolVault.withdraw(userShares);
      }

      setActionState('confirming');
      setActionMessage('Waiting for confirmation...');
      setLastTxHash(tx.hash);

      await tx.wait();

      setActionState('success');
      setActionMessage('All funds withdrawn!');
      
      onSuccess?.();
      
      return { success: true, txHash: tx.hash };

    } catch (err: any) {
      console.error('WithdrawAll error:', err);
      const errorMsg = err.message || 'Withdrawal failed';
      setActionState('error');
      setActionMessage(errorMsg);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [reset, onSuccess]);

  /**
   * Open withdraw window (owner only)
   */
  const openWithdrawWindow = useCallback(async (durationSeconds: number): Promise<ActionResult> => {
    const addresses = getAddresses();
    
    try {
      reset();
      setActionState('checking');
      setActionMessage('Verifying owner status on-chain...');

      const signer = await getSigner();
      const userAddress = await signer.getAddress();
      const poolVault = new Contract(addresses.poolVault, POOL_VAULT_ABI, signer);

      // Verify on-chain state
      const [state, owner] = await Promise.all([
        poolVault.state(),
        poolVault.owner(),
      ]);

      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('Only owner can open withdraw window');
      }

      if (Number(state) !== VaultState.DEPLOYED) {
        throw new Error('Vault must be in DEPLOYED state');
      }

      setActionState('pending');
      setActionMessage('Opening withdraw window (MetaMask popup)...');

      const tx = await poolVault.openWithdrawWindow(durationSeconds);

      setActionState('confirming');
      setActionMessage('Waiting for confirmation...');
      setLastTxHash(tx.hash);

      await tx.wait();

      setActionState('success');
      setActionMessage('Withdraw window opened!');
      
      onSuccess?.();
      
      return { success: true, txHash: tx.hash };

    } catch (err: any) {
      console.error('OpenWithdrawWindow error:', err);
      const errorMsg = err.message || 'Failed to open withdraw window';
      setActionState('error');
      setActionMessage(errorMsg);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [reset, onSuccess]);

  return {
    actionState,
    actionMessage,
    lastTxHash,
    error,
    deployToAave,
    withdraw,
    withdrawAll,
    openWithdrawWindow,
    reset,
  };
}
