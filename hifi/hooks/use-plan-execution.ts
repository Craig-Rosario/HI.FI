'use client';

import { useState, useCallback } from 'react';
import { ethers, BrowserProvider, Contract } from 'ethers';

// Contract addresses for Base Sepolia
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const ARC_USDC_BASE_SEPOLIA = process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS || '0xa2C75790AEC2d0cE701a34197E3c5947A83C5D4e';

const BASE_SEPOLIA_CHAIN_ID = 84532;

// Contract ABIs
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
];

const POOL_VAULT_ABI = [
  'function deposit(uint256 amount) external',
  'function shares(address user) external view returns (uint256)',
];

export type PlanExecutionStep = 
  | 'idle'
  | 'connecting'
  | 'switching_network'
  | 'checking_balance'
  | 'approving'
  | 'depositing'
  | 'complete'
  | 'error';

interface AllocationExecution {
  poolId: string;
  poolName: string;
  poolAddress: string;
  amount: number;
  step: PlanExecutionStep;
  txHash?: string;
  error?: string;
}

interface PlanExecutionState {
  isExecuting: boolean;
  currentAllocationIndex: number;
  allocations: AllocationExecution[];
  overallProgress: number;
  message: string;
  error?: string;
}

interface UsePlanExecutionReturn {
  state: PlanExecutionState;
  executeAllocation: (allocation: AllocationExecution) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  reset: () => void;
}

// Window.ethereum is declared in use-metamask.ts

export const usePlanExecution = (): UsePlanExecutionReturn => {
  const [state, setState] = useState<PlanExecutionState>({
    isExecuting: false,
    currentAllocationIndex: 0,
    allocations: [],
    overallProgress: 0,
    message: '',
  });

  const updateAllocation = (index: number, updates: Partial<AllocationExecution>) => {
    setState(prev => ({
      ...prev,
      allocations: prev.allocations.map((a, i) => 
        i === index ? { ...a, ...updates } : a
      ),
    }));
  };

  const switchToBaseSepolia = async (): Promise<boolean> => {
    if (!window.ethereum) return false;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}` }],
      });
      return true;
    } catch (switchError: unknown) {
      const error = switchError as { code?: number };
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}`,
              chainName: 'Base Sepolia',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://sepolia.base.org'],
              blockExplorerUrls: ['https://sepolia.basescan.org'],
            }],
          });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  };

  const executeAllocation = useCallback(async (
    allocation: AllocationExecution
  ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!window.ethereum) {
      return { success: false, error: 'MetaMask not installed' };
    }

    try {
      setState(prev => ({ ...prev, isExecuting: true, message: `Connecting to MetaMask...` }));

      // Connect to MetaMask
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      // Check network
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== BASE_SEPOLIA_CHAIN_ID) {
        setState(prev => ({ ...prev, message: 'Switching to Base Sepolia...' }));
        const switched = await switchToBaseSepolia();
        if (!switched) {
          return { success: false, error: 'Failed to switch network' };
        }
      }

      // Use arcUSDC for deposits
      const tokenAddress = ARC_USDC_BASE_SEPOLIA;
      const amountInWei = ethers.parseUnits(allocation.amount.toString(), 6);

      // Check balance
      setState(prev => ({ ...prev, message: 'Checking balance...' }));
      const token = new Contract(tokenAddress, ERC20_ABI, signer);
      const balance = await token.balanceOf(userAddress);

      if (balance < amountInWei) {
        return { 
          success: false, 
          error: `Insufficient balance. You have ${ethers.formatUnits(balance, 6)} arcUSDC but need ${allocation.amount}` 
        };
      }

      // Check allowance and approve if needed
      setState(prev => ({ ...prev, message: `Approving ${allocation.amount} arcUSDC for ${allocation.poolName}...` }));
      const allowance = await token.allowance(userAddress, allocation.poolAddress);

      if (allowance < amountInWei) {
        const approveTx = await token.approve(allocation.poolAddress, amountInWei);
        await approveTx.wait();
      }

      // Deposit to pool
      setState(prev => ({ ...prev, message: `Depositing ${allocation.amount} arcUSDC to ${allocation.poolName}...` }));
      const pool = new Contract(allocation.poolAddress, POOL_VAULT_ABI, signer);
      const depositTx = await pool.deposit(amountInWei);
      const receipt = await depositTx.wait();

      setState(prev => ({ 
        ...prev, 
        isExecuting: false, 
        message: `Successfully deposited to ${allocation.poolName}!` 
      }));

      return { success: true, txHash: receipt.hash };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      setState(prev => ({ 
        ...prev, 
        isExecuting: false, 
        error: errorMessage 
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isExecuting: false,
      currentAllocationIndex: 0,
      allocations: [],
      overallProgress: 0,
      message: '',
    });
  }, []);

  return {
    state,
    executeAllocation,
    reset,
  };
};

export default usePlanExecution;
