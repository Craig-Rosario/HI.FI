'use client';

import { X, CheckCircle, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvestmentStep } from '@/hooks/use-invest';

interface InvestmentProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: InvestmentStep;
  message: string;
  txHash?: string;
  error?: string;
  amount: string;
  sourceChain?: 'ethereum' | 'base';
}

// Steps for Ethereum → Base bridge flow
const ETH_STEP_ORDER: InvestmentStep[] = [
  'connecting',
  'switching_to_eth',
  'checking_balance',
  'approving_usdc',
  'depositing_gateway',
  'bridging',
  'switching_to_base',
  'minting_usdc',
  'wrapping_arcusdc',
  'approving_arcusdc',
  'depositing_vault',
  'complete',
];

// Steps for Base direct deposit flow (no bridge)
const BASE_STEP_ORDER: InvestmentStep[] = [
  'connecting',
  'switching_to_source',
  'checking_balance',
  'wrapping_arcusdc',
  'approving_arcusdc',
  'depositing_vault',
  'complete',
];

const STEP_LABELS: Record<InvestmentStep, string> = {
  idle: 'Idle',
  connecting: 'Connect Wallet',
  switching_to_source: 'Switch to Base Sepolia',
  switching_to_eth: 'Switch to Ethereum Sepolia',
  checking_balance: 'Check Balance',
  approving_usdc: 'Approve USDC',
  depositing_gateway: 'Deposit to Gateway',
  bridging: 'Bridge to Base',
  switching_to_base: 'Switch to Base Sepolia',
  minting_usdc: 'Mint USDC on Base',
  wrapping_arcusdc: 'Wrap to arcUSDC',
  approving_arcusdc: 'Approve arcUSDC',
  depositing_vault: 'Deposit to Vault',
  complete: 'Complete',
  error: 'Error',
};

export function InvestmentProgressModal({
  isOpen,
  onClose,
  step,
  message,
  txHash,
  error,
  amount,
  sourceChain = 'ethereum',
}: InvestmentProgressModalProps) {
  if (!isOpen) return null;

  // Select the appropriate step order based on source chain
  const STEP_ORDER = sourceChain === 'base' ? BASE_STEP_ORDER : ETH_STEP_ORDER;
  
  const currentStepIndex = STEP_ORDER.indexOf(step);
  const isComplete = step === 'complete';
  const isError = step === 'error';

  const getStepStatus = (stepName: InvestmentStep) => {
    const stepIndex = STEP_ORDER.indexOf(stepName);
    if (step === 'error') return 'pending';
    if (step === 'complete') return 'complete';
    if (stepIndex < currentStepIndex) return 'complete';
    if (stepIndex === currentStepIndex) return 'active';
    return 'pending';
  };

  const getExplorerUrl = (hash: string, chain: 'eth' | 'base' = 'base') => {
    if (chain === 'eth') {
      return `https://sepolia.etherscan.io/tx/${hash}`;
    }
    return `https://sepolia.basescan.org/tx/${hash}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={isComplete || isError ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative z-50 flex items-center justify-center p-4 h-full">
        <div className="bg-card border border-gray-800 rounded-lg w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold">
                {isComplete ? '🎉 Investment Complete!' : isError ? '❌ Investment Failed' : 'Processing Investment'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {isComplete 
                  ? `Successfully invested ${amount} USDC`
                  : isError 
                    ? 'An error occurred during the investment'
                    : `Investing ${amount} USDC`
                }
              </p>
            </div>
            {(isComplete || isError) && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Progress Steps */}
            <div className="space-y-3">
              {STEP_ORDER.filter(s => s !== 'idle' && s !== 'error').map((stepName, index) => {
                const status = getStepStatus(stepName);
                
                return (
                  <div 
                    key={stepName}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      status === 'active' 
                        ? 'bg-blue-500/10 border border-blue-500/30' 
                        : status === 'complete'
                          ? 'bg-green-500/10 border border-green-500/20'
                          : 'bg-gray-800/50 border border-gray-700/50'
                    }`}
                  >
                    {/* Status Icon */}
                    <div className="shrink-0">
                      {status === 'complete' ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : status === 'active' ? (
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                      )}
                    </div>

                    {/* Step Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${
                        status === 'active' ? 'text-blue-400' : 
                        status === 'complete' ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {STEP_LABELS[stepName]}
                      </p>
                    </div>

                    {/* Step Number */}
                    <div className={`text-xs ${
                      status === 'active' ? 'text-blue-400' : 
                      status === 'complete' ? 'text-green-400' : 'text-gray-500'
                    }`}>
                      {index + 1}/{STEP_ORDER.length - 1}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current Status Message */}
            <div className={`p-4 rounded-lg ${
              isError 
                ? 'bg-red-500/10 border border-red-500/20' 
                : isComplete
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-blue-500/10 border border-blue-500/20'
            }`}>
              {isError ? (
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-400">Error</p>
                    <p className="text-sm text-red-300 mt-1">{error || message}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  {isComplete ? (
                    <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5 animate-spin" />
                  )}
                  <div>
                    <p className={`font-medium ${isComplete ? 'text-green-400' : 'text-blue-400'}`}>
                      {isComplete ? 'Success!' : 'In Progress'}
                    </p>
                    <p className={`text-sm mt-1 ${isComplete ? 'text-green-300' : 'text-blue-300'}`}>
                      {message}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Transaction Hash */}
            {txHash && (
              <a
                href={getExplorerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                <span className="text-gray-400">View Transaction</span>
                <span className="font-mono text-xs text-gray-300">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </span>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </a>
            )}

            {/* Close Button for Complete/Error */}
            {(isComplete || isError) && (
              <Button
                onClick={onClose}
                className={`w-full ${
                  isComplete 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-600 hover:bg-gray-700'
                } text-white`}
              >
                {isComplete ? 'Done' : 'Close'}
              </Button>
            )}

            {/* Cancel Warning for In-Progress */}
            {!isComplete && !isError && (
              <p className="text-xs text-center text-gray-500">
                Please don't close this window during the investment process.
                Check MetaMask for transaction approvals.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
