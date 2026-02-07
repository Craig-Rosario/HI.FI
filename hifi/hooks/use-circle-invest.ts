'use client';

import { useState, useCallback } from 'react';

export type CircleInvestStep = 
  | 'idle'
  | 'checking_wallet'
  | 'approving_usdc'
  | 'wrapping_arcusdc'
  | 'approving_arcusdc'
  | 'depositing_vault'
  | 'complete'
  | 'error';

interface CircleInvestState {
  step: CircleInvestStep;
  message: string;
  txHash?: string;
  error?: string;
  steps?: Array<{ step: string; success: boolean; txId?: string; error?: string }>;
}

interface UseCircleInvestReturn {
  state: CircleInvestState;
  invest: (amount: string, poolId: string, poolContractAddress?: string) => Promise<boolean>;
  reset: () => void;
  isLoading: boolean;
}

const STEP_MESSAGES: Record<CircleInvestStep, string> = {
  idle: 'Ready to invest',
  checking_wallet: 'Checking Circle wallet balance...',
  approving_usdc: 'Approving USDC for wrapping...',
  wrapping_arcusdc: 'Converting USDC to arcUSDC...',
  approving_arcusdc: 'Approving arcUSDC for pool...',
  depositing_vault: 'Depositing to pool...',
  complete: 'Investment complete!',
  error: 'Investment failed',
};

export function useCircleInvest(): UseCircleInvestReturn {
  const [state, setState] = useState<CircleInvestState>({
    step: 'idle',
    message: STEP_MESSAGES.idle,
  });
  const [isLoading, setIsLoading] = useState(false);

  const updateState = (step: CircleInvestStep, extras?: Partial<CircleInvestState>) => {
    setState({
      step,
      message: STEP_MESSAGES[step],
      ...extras,
    });
  };

  const invest = useCallback(async (
    amount: string,
    poolId: string,
    poolContractAddress?: string
  ): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Get user ID from auth context or session
      const authResponse = await fetch('/api/auth/session');
      const authData = await authResponse.json();
      
      if (!authData.user?.id) {
        updateState('error', { error: 'Please log in to use Circle wallet' });
        setIsLoading(false);
        return false;
      }
      
      const userId = authData.user.id;
      
      updateState('checking_wallet');
      
      // Call the Circle invest API
      const response = await fetch('/api/circle-wallet/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          poolId,
          amount,
          poolContractAddress,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        updateState('error', { 
          error: data.error || 'Investment failed',
          steps: data.steps,
        });
        setIsLoading(false);
        return false;
      }
      
      // Track progress based on steps returned
      if (data.steps) {
        for (const stepInfo of data.steps) {
          if (stepInfo.step === 'approve_usdc') {
            updateState('approving_usdc');
          } else if (stepInfo.step === 'wrap_usdc') {
            updateState('wrapping_arcusdc');
          } else if (stepInfo.step === 'approve_arcusdc') {
            updateState('approving_arcusdc');
          } else if (stepInfo.step === 'deposit_pool') {
            updateState('depositing_vault');
          }
        }
      }
      
      updateState('complete', {
        txHash: data.txHash || data.transactionId,
        steps: data.steps,
      });
      
      setIsLoading(false);
      return true;
      
    } catch (error) {
      console.error('Circle invest error:', error);
      updateState('error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setIsLoading(false);
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      message: STEP_MESSAGES.idle,
    });
    setIsLoading(false);
  }, []);

  return {
    state,
    invest,
    reset,
    isLoading,
  };
}
