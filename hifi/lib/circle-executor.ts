/**
 * Circle Executor - Server-side transaction execution using Circle Developer-Controlled Wallets
 * 
 * This module provides a dedicated execution engine for Circle wallet transactions.
 * It handles:
 * 1. Gas (ETH) balance checks
 * 2. Transaction submission via Circle API
 * 3. Transaction confirmation polling
 * 4. On-chain verification
 * 
 * IMPORTANT: This does NOT use window.ethereum or MetaMask.
 * All transactions are signed server-side using Circle's managed keys.
 */

import { CircleDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import connectToDatabase from "./mongodb";
import User from "@/models/User";
import Pool from "@/models/Pool";
import Transaction from "@/models/Transaction";

// Contract addresses on Base Sepolia
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
// Use server-side env var (NEXT_ARCUSDC_ADDRESS) with correct fallback address
const ARC_USDC_BASE_SEPOLIA = process.env.NEXT_ARCUSDC_ADDRESS || process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS || '0x15C7881801F78ECFad935c137eD38B7F8316B5e8';
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const CHAIN_ID = '84532';

// Transaction states
type TransactionState = 'INITIATED' | 'PENDING_RISK_SCREENING' | 'QUEUED' | 'SENT' | 'CONFIRMED' | 'COMPLETE' | 'CANCELLED' | 'FAILED' | 'DENIED';

// Circle client singleton
let circleClient: CircleDeveloperControlledWalletsClient | null = null;

function getCircleClient(): CircleDeveloperControlledWalletsClient {
  if (!circleClient) {
    if (!process.env.CIRCLE_API_KEY) {
      throw new Error('CIRCLE_API_KEY environment variable is not set');
    }
    if (!process.env.CIRCLE_ENTITY_SECRET) {
      throw new Error('CIRCLE_ENTITY_SECRET environment variable is not set');
    }
    
    circleClient = new CircleDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    });
  }
  return circleClient;
}

export interface ExecutorResult {
  success: boolean;
  transactionId?: string;
  txHash?: string;
  state?: string;
  error?: string;
  blockNumber?: number;
  gasUsed?: string;
}

export interface PoolDepositResult {
  success: boolean;
  steps: Array<{
    step: string;
    success: boolean;
    transactionId?: string;
    txHash?: string;
    error?: string;
  }>;
  totalGasUsed?: string;
  error?: string;
}

/**
 * Check ETH balance for gas on Base Sepolia
 */
export async function checkGasBalance(walletAddress: string): Promise<{ hasGas: boolean; balance: string; minRequired: string }> {
  try {
    const response = await fetch(BASE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [walletAddress, 'latest'],
        id: 1,
      }),
    });
    
    const result = await response.json();
    const balanceWei = BigInt(result.result || '0x0');
    const balanceEth = Number(balanceWei) / 1e18;
    
    // Minimum 0.001 ETH for gas (~4 transactions at average cost)
    const minRequired = 0.001;
    
    return {
      hasGas: balanceEth >= minRequired,
      balance: balanceEth.toFixed(6),
      minRequired: minRequired.toString(),
    };
  } catch (error) {
    console.error('Check gas balance error:', error);
    return { hasGas: false, balance: '0', minRequired: '0.001' };
  }
}

/**
 * Check USDC balance on Base Sepolia
 */
export async function checkUSDCBalance(walletAddress: string): Promise<number> {
  try {
    const balanceOfSelector = '0x70a08231';
    const paddedAddress = walletAddress.slice(2).padStart(64, '0');
    const data = balanceOfSelector + paddedAddress;
    
    const response = await fetch(BASE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: USDC_BASE_SEPOLIA, data }, 'latest'],
        id: 1,
      }),
    });
    
    const result = await response.json();
    const balanceWei = BigInt(result.result || '0x0');
    return Number(balanceWei) / 1e6;
  } catch (error) {
    console.error('Check USDC balance error:', error);
    return 0;
  }
}

/**
 * Check arcUSDC balance on Base Sepolia
 */
export async function checkArcUSDCBalance(walletAddress: string): Promise<number> {
  try {
    const balanceOfSelector = '0x70a08231';
    const paddedAddress = walletAddress.slice(2).padStart(64, '0');
    const data = balanceOfSelector + paddedAddress;
    
    const response = await fetch(BASE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: ARC_USDC_BASE_SEPOLIA, data }, 'latest'],
        id: 1,
      }),
    });
    
    const result = await response.json();
    const balanceWei = BigInt(result.result || '0x0');
    return Number(balanceWei) / 1e6;
  } catch (error) {
    console.error('Check arcUSDC balance error:', error);
    return 0;
  }
}

/**
 * Verify a transaction exists on-chain by checking the RPC
 * This is the ultimate safeguard against fake txHashes
 */
async function verifyTransactionOnChain(txHash: string): Promise<{ verified: boolean; blockNumber?: number; error?: string }> {
  try {
    console.log(`[Circle Executor] Verifying transaction on-chain: ${txHash}`);
    
    const response = await fetch(BASE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1,
      }),
    });
    
    const result = await response.json();
    
    if (result.result && result.result.blockNumber) {
      const blockNumber = parseInt(result.result.blockNumber, 16);
      console.log(`[Circle Executor] ✅ Transaction verified on-chain in block ${blockNumber}`);
      return { verified: true, blockNumber };
    }
    
    // Transaction might be pending, wait and retry
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const retryResponse = await fetch(BASE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1,
      }),
    });
    
    const retryResult = await retryResponse.json();
    
    if (retryResult.result && retryResult.result.blockNumber) {
      const blockNumber = parseInt(retryResult.result.blockNumber, 16);
      console.log(`[Circle Executor] ✅ Transaction verified on-chain in block ${blockNumber} (retry)`);
      return { verified: true, blockNumber };
    }
    
    console.log(`[Circle Executor] ⚠️ Transaction not found on-chain yet: ${txHash}`);
    return { verified: false, error: 'Transaction not found on-chain' };
  } catch (error) {
    console.error(`[Circle Executor] Error verifying transaction on-chain:`, error);
    return { verified: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Wait for a Circle transaction to be confirmed
 * Polls the transaction status until it's confirmed or fails
 */
async function waitForTransactionConfirmation(
  transactionId: string,
  maxWaitMs: number = 120000, // 2 minutes max
  pollIntervalMs: number = 3000 // Poll every 3 seconds
): Promise<{ confirmed: boolean; txHash?: string; error?: string; state: string }> {
  const circle = getCircleClient();
  const startTime = Date.now();
  
  console.log(`[Circle Executor] Waiting for transaction ${transactionId} to confirm...`);
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await circle.getTransaction({ id: transactionId });
      
      // Log the data to understand structure
      const txData = response.data;
      console.log(`[Circle Executor] getTransaction response.data:`, JSON.stringify(txData, null, 2));
      
      if (!txData) {
        console.log(`[Circle Executor] No transaction data returned, retrying...`);
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        continue;
      }
      
      // Cast to access properties - log all keys to debug
      const tx = txData as unknown as Record<string, unknown>;
      console.log(`[Circle Executor] TX object keys:`, Object.keys(tx));
      
      // Circle SDK returns transaction in 'transaction' field for getTransaction
      const txObj = (tx.transaction || tx) as Record<string, unknown>;
      console.log(`[Circle Executor] Actual TX keys:`, Object.keys(txObj));
      
      // Try multiple possible field names for state and txHash
      const state = (txObj.state || txObj.status || tx.state || tx.status || 'UNKNOWN') as TransactionState;
      const txHash = (txObj.txHash || txObj.transactionHash || txObj.hash || tx.txHash) as string | undefined;
      
      console.log(`[Circle Executor] Transaction ${transactionId} state: ${state}, txHash: ${txHash || 'pending'}`);
      
      // Success states
      if (state === 'CONFIRMED' || state === 'COMPLETE') {
        // CRITICAL: Verify the transaction actually exists on-chain
        if (txHash && txHash.startsWith('0x')) {
          const onChainVerification = await verifyTransactionOnChain(txHash);
          if (onChainVerification.verified) {
            console.log(`[Circle Executor] ✅ Transaction ${txHash} verified on-chain in block ${onChainVerification.blockNumber}`);
            return { confirmed: true, txHash, state };
          } else {
            console.log(`[Circle Executor] ⚠️ Circle says confirmed but not found on-chain yet, continuing to poll...`);
            // Continue polling - transaction might still be propagating
          }
        } else {
          // Circle says confirmed but no txHash - keep polling
          console.log(`[Circle Executor] ⚠️ Circle says ${state} but no txHash yet, continuing...`);
        }
      }
      
      // Failure states
      if (state === 'FAILED' || state === 'CANCELLED' || state === 'DENIED') {
        const errorMsg = (tx.errorReason || tx.error || 'Transaction failed') as string;
        return { confirmed: false, error: errorMsg, state };
      }
      
      // Still pending, wait and poll again
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      console.error(`[Circle Executor] Error polling transaction ${transactionId}:`, error);
      // Don't fail immediately on poll error, retry
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }
  
  return { confirmed: false, error: 'Transaction confirmation timed out', state: 'TIMEOUT' };
}

/**
 * Execute a contract call via Circle and wait for confirmation
 */
export async function executeContractCall(
  walletId: string,
  contractAddress: string,
  functionSignature: string,
  functionArgs: string[],
  waitForConfirmation: boolean = true
): Promise<ExecutorResult> {
  try {
    const circle = getCircleClient();
    
    console.log(`\n[Circle Executor] ========================================`);
    console.log(`[Circle Executor] CONTRACT EXECUTION`);
    console.log(`[Circle Executor] Wallet: ${walletId}`);
    console.log(`[Circle Executor] Contract: ${contractAddress}`);
    console.log(`[Circle Executor] Function: ${functionSignature}`);
    console.log(`[Circle Executor] Args: ${JSON.stringify(functionArgs)}`);
    console.log(`[Circle Executor] ========================================\n`);
    
    // Submit transaction to Circle
    console.log(`[Circle Executor] Submitting to Circle API...`);
    
    const txParams = {
      walletId,
      contractAddress,
      abiFunctionSignature: functionSignature,
      abiParameters: functionArgs,
      fee: {
        type: "level" as const,
        config: {
          feeLevel: "HIGH" as const,
        },
      },
    };
    
    console.log(`[Circle Executor] TX Params:`, JSON.stringify(txParams, null, 2));
    
    const response = await circle.createContractExecutionTransaction(txParams);
    
    // Only log data, not full response (contains circular references)
    console.log(`[Circle Executor] Circle Response Data:`, JSON.stringify(response.data, null, 2));
    
    if (!response.data) {
      return { success: false, error: 'No response from Circle API' };
    }
    
    const txData = response.data as unknown as Record<string, unknown>;
    const transactionId = txData.id as string;
    const initialState = (txData.state || 'INITIATED') as string;
    
    console.log(`[Circle Executor] Transaction submitted: ${transactionId}, state: ${initialState}`);
    
    if (!waitForConfirmation) {
      // Return immediately without waiting
      return {
        success: true,
        transactionId,
        state: initialState,
      };
    }
    
    // Wait for confirmation
    const confirmation = await waitForTransactionConfirmation(transactionId);
    
    if (confirmation.confirmed) {
      // CRITICAL: Require a REAL txHash - never mark as success without it
      if (!confirmation.txHash || !confirmation.txHash.startsWith('0x')) {
        console.error(`[Circle Executor] ❌ Transaction confirmed but no valid txHash returned!`);
        return {
          success: false,
          transactionId,
          error: 'Transaction confirmed but no valid blockchain hash received',
          state: confirmation.state,
        };
      }
      
      console.log(`[Circle Executor] ✅ Transaction confirmed with txHash: ${confirmation.txHash}`);
      return {
        success: true,
        transactionId,
        txHash: confirmation.txHash,
        state: confirmation.state,
      };
    } else {
      console.log(`[Circle Executor] ❌ Transaction failed: ${confirmation.error}`);
      return {
        success: false,
        transactionId,
        error: confirmation.error,
        state: confirmation.state,
      };
    }
  } catch (error: any) {
    console.error(`[Circle Executor] Contract execution error:`, error);
    
    let errorMessage = 'Unknown Circle API error';
    if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Approve ERC20 token spending and wait for confirmation
 */
export async function approveToken(
  walletId: string,
  tokenAddress: string,
  spenderAddress: string,
  amount: string
): Promise<ExecutorResult> {
  return executeContractCall(
    walletId,
    tokenAddress,
    "approve(address,uint256)",
    [spenderAddress, amount],
    true
  );
}

/**
 * Execute full pool deposit flow using Circle wallet
 * 
 * Steps:
 * 1. Verify gas balance (ETH for tx fees)
 * 2. Verify USDC balance
 * 3. Approve USDC for arcUSDC contract
 * 4. Wrap USDC → arcUSDC (call arcUSDC.deposit)
 * 5. Approve arcUSDC for Pool
 * 6. Deposit arcUSDC to Pool
 */
export async function depositToPool(
  userId: string,
  poolContractAddress: string,
  amount: number, // USDC amount (e.g., 10.5)
  poolId?: string,
  poolName?: string,
  onProgress?: (step: string, message: string) => void
): Promise<PoolDepositResult> {
  const steps: PoolDepositResult['steps'] = [];
  
  try {
    await connectToDatabase();
    
    // Get user's Circle wallet
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, steps, error: 'User not found' };
    }
    
    if (!user.circleWalletId || !user.circleWalletAddress) {
      return { success: false, steps, error: 'User does not have a Circle wallet' };
    }
    
    const walletId = user.circleWalletId;
    const walletAddress = user.circleWalletAddress;
    
    console.log(`[Circle Executor] Starting pool deposit for user ${userId}`);
    console.log(`[Circle Executor] Wallet: ${walletId} (${walletAddress})`);
    console.log(`[Circle Executor] Pool: ${poolContractAddress}`);
    console.log(`[Circle Executor] Amount: ${amount} USDC`);
    
    // Step 0: Check gas balance
    onProgress?.('checking_gas', 'Checking gas balance...');
    const gasCheck = await checkGasBalance(walletAddress);
    
    if (!gasCheck.hasGas) {
      return {
        success: false,
        steps,
        error: `Insufficient ETH for gas. Circle wallet needs at least ${gasCheck.minRequired} ETH. Current balance: ${gasCheck.balance} ETH. Please fund the wallet at ${walletAddress}`,
      };
    }
    
    console.log(`[Circle Executor] Gas check passed: ${gasCheck.balance} ETH`);
    
    // Step 0.5: Check USDC balance
    onProgress?.('checking_balance', 'Checking USDC balance...');
    const usdcBalance = await checkUSDCBalance(walletAddress);
    
    if (usdcBalance < amount) {
      return {
        success: false,
        steps,
        error: `Insufficient USDC. Required: ${amount} USDC, Available: ${usdcBalance} USDC`,
      };
    }
    
    console.log(`[Circle Executor] USDC balance check passed: ${usdcBalance} USDC`);
    
    // Convert amount to smallest unit (6 decimals for USDC)
    const amountInSmallestUnit = Math.floor(amount * 1_000_000).toString();
    
    // Step 1: Approve USDC for arcUSDC contract
    onProgress?.('approving_usdc', 'Approving USDC for wrapping...');
    console.log(`[Circle Executor] Step 1: Approving USDC for arcUSDC...`);
    
    const approveUsdcResult = await approveToken(
      walletId,
      USDC_BASE_SEPOLIA,
      ARC_USDC_BASE_SEPOLIA,
      amountInSmallestUnit
    );
    
    steps.push({
      step: 'approve_usdc',
      success: approveUsdcResult.success,
      transactionId: approveUsdcResult.transactionId,
      txHash: approveUsdcResult.txHash,
      error: approveUsdcResult.error,
    });
    
    if (!approveUsdcResult.success) {
      return { success: false, steps, error: `USDC approval failed: ${approveUsdcResult.error}` };
    }
    
    // Small delay between transactions
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Wrap USDC to arcUSDC
    onProgress?.('wrapping_arcusdc', 'Converting USDC to arcUSDC...');
    console.log(`[Circle Executor] Step 2: Wrapping USDC to arcUSDC...`);
    
    const wrapResult = await executeContractCall(
      walletId,
      ARC_USDC_BASE_SEPOLIA,
      "deposit(uint256)",
      [amountInSmallestUnit],
      true
    );
    
    steps.push({
      step: 'wrap_usdc',
      success: wrapResult.success,
      transactionId: wrapResult.transactionId,
      txHash: wrapResult.txHash,
      error: wrapResult.error,
    });
    
    if (!wrapResult.success) {
      return { success: false, steps, error: `USDC wrapping failed: ${wrapResult.error}` };
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Approve arcUSDC for Pool
    onProgress?.('approving_arcusdc', 'Approving arcUSDC for pool...');
    console.log(`[Circle Executor] Step 3: Approving arcUSDC for Pool...`);
    
    const approveArcResult = await approveToken(
      walletId,
      ARC_USDC_BASE_SEPOLIA,
      poolContractAddress,
      amountInSmallestUnit
    );
    
    steps.push({
      step: 'approve_arcusdc',
      success: approveArcResult.success,
      transactionId: approveArcResult.transactionId,
      txHash: approveArcResult.txHash,
      error: approveArcResult.error,
    });
    
    if (!approveArcResult.success) {
      return { success: false, steps, error: `arcUSDC approval failed: ${approveArcResult.error}` };
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Deposit to Pool
    onProgress?.('depositing_vault', 'Depositing to pool...');
    console.log(`[Circle Executor] Step 4: Depositing to Pool...`);
    
    const depositResult = await executeContractCall(
      walletId,
      poolContractAddress,
      "deposit(uint256)",
      [amountInSmallestUnit],
      true
    );
    
    steps.push({
      step: 'deposit_pool',
      success: depositResult.success,
      transactionId: depositResult.transactionId,
      txHash: depositResult.txHash,
      error: depositResult.error,
    });
    
    if (!depositResult.success) {
      return { success: false, steps, error: `Pool deposit failed: ${depositResult.error}` };
    }
    
    // CRITICAL: Only record transaction if we have a REAL blockchain txHash
    // NEVER use fake hashes or transaction IDs as txHash
    if (!depositResult.txHash) {
      console.error('[Circle Executor] ❌ CRITICAL: No real txHash returned from deposit transaction!');
      return {
        success: false,
        steps,
        error: 'No blockchain transaction hash received. Transaction may not have been submitted to chain.',
      };
    }

    // Record the transaction in database only with REAL txHash
    if (poolId && poolName) {
      try {
        await Transaction.create({
          userAddress: walletAddress,
          poolId,
          poolName,
          type: 'deposit',
          chain: 'BASE',
          amount: amount.toString(),
          txHash: depositResult.txHash, // REAL txHash only
          status: 'confirmed',
        });
        console.log(`[Circle Executor] Transaction recorded for ${poolName} with txHash: ${depositResult.txHash}`);
      } catch (txErr) {
        console.warn('[Circle Executor] Failed to record transaction:', txErr);
      }
    }
    
    console.log(`[Circle Executor] ✅ Pool deposit complete!`);
    
    return {
      success: true,
      steps,
    };
    
  } catch (error: any) {
    console.error('[Circle Executor] Deposit error:', error);
    return {
      success: false,
      steps,
      error: error.message || 'Unknown error during deposit',
    };
  }
}

/**
 * Execute a full investment plan with multiple allocations
 */
export async function executeInvestmentPlanV2(
  userId: string,
  allocations: Array<{
    poolId: string;
    poolName: string;
    amount: number;
    poolContractAddress: string;
  }>,
  onProgress?: (allocation: number, total: number, step: string, message: string) => void
): Promise<{
  success: boolean;
  results: Array<{
    poolName: string;
    amount: number;
    success: boolean;
    steps: PoolDepositResult['steps'];
    error?: string;
  }>;
  error?: string;
}> {
  const results: Array<{
    poolName: string;
    amount: number;
    success: boolean;
    steps: PoolDepositResult['steps'];
    error?: string;
  }> = [];
  
  for (let i = 0; i < allocations.length; i++) {
    const allocation = allocations[i];
    
    console.log(`\n[Circle Executor] Processing allocation ${i + 1}/${allocations.length}: ${allocation.poolName}`);
    
    const result = await depositToPool(
      userId,
      allocation.poolContractAddress,
      allocation.amount,
      allocation.poolId,
      allocation.poolName,
      (step, message) => {
        onProgress?.(i + 1, allocations.length, step, `${allocation.poolName}: ${message}`);
      }
    );
    
    results.push({
      poolName: allocation.poolName,
      amount: allocation.amount,
      success: result.success,
      steps: result.steps,
      error: result.error,
    });
    
    // If deposit failed, don't continue with remaining allocations
    if (!result.success) {
      console.log(`[Circle Executor] ❌ Allocation failed, stopping execution`);
      break;
    }
    
    // Delay between allocations
    if (i < allocations.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  const allSucceeded = results.every(r => r.success);
  
  return {
    success: allSucceeded,
    results,
    error: allSucceeded ? undefined : 'Some allocations failed',
  };
}

/**
 * Get user's Circle wallet info
 */
export async function getUserCircleWallet(userId: string): Promise<{
  walletId: string | null;
  walletAddress: string | null;
  usdcBalance: number;
  ethBalance: string;
  hasGas: boolean;
}> {
  try {
    await connectToDatabase();
    const user = await User.findById(userId);
    
    if (!user?.circleWalletId || !user?.circleWalletAddress) {
      return { walletId: null, walletAddress: null, usdcBalance: 0, ethBalance: '0', hasGas: false };
    }
    
    const [usdcBalance, gasCheck] = await Promise.all([
      checkUSDCBalance(user.circleWalletAddress),
      checkGasBalance(user.circleWalletAddress),
    ]);
    
    return {
      walletId: user.circleWalletId,
      walletAddress: user.circleWalletAddress,
      usdcBalance,
      ethBalance: gasCheck.balance,
      hasGas: gasCheck.hasGas,
    };
  } catch (error) {
    console.error('[Circle Executor] Get wallet info error:', error);
    return { walletId: null, walletAddress: null, usdcBalance: 0, ethBalance: '0', hasGas: false };
  }
}
