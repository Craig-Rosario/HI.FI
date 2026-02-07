import { CircleDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import connectToDatabase from "./mongodb";
import User from "@/models/User";
import Pool from "@/models/Pool";

// Initialize Circle client lazily to ensure env vars are loaded
let circleClient: CircleDeveloperControlledWalletsClient | null = null;

function getCircleClient(): CircleDeveloperControlledWalletsClient {
  if (!circleClient) {
    if (!process.env.CIRCLE_API_KEY) {
      throw new Error('CIRCLE_API_KEY environment variable is not set');
    }
    if (!process.env.CIRCLE_ENTITY_SECRET) {
      throw new Error('CIRCLE_ENTITY_SECRET environment variable is not set');
    }
    
    console.log('Initializing Circle client...');
    console.log('API Key length:', process.env.CIRCLE_API_KEY?.length);
    console.log('Entity Secret length:', process.env.CIRCLE_ENTITY_SECRET?.length);
    
    circleClient = new CircleDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    });
    
    console.log('Circle client initialized successfully');
  }
  return circleClient;
}

// Contract addresses on Base Sepolia
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
// Use server-side env var with correct fallback address
const ARC_USDC_BASE_SEPOLIA = process.env.NEXT_ARCUSDC_ADDRESS || process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS || '0x15C7881801F78ECFad935c137eD38B7F8316B5e8';

// ERC20 ABI for encoding function calls
const ERC20_ABI = [
  {
    "name": "approve",
    "type": "function",
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "outputs": [{ "type": "bool" }]
  },
  {
    "name": "transfer",
    "type": "function",
    "inputs": [
      { "name": "to", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "outputs": [{ "type": "bool" }]
  }
];

// Pool Vault ABI
const POOL_VAULT_ABI = [
  {
    "name": "deposit",
    "type": "function",
    "inputs": [
      { "name": "amount", "type": "uint256" }
    ],
    "outputs": []
  }
];

export interface CircleTransactionResult {
  success: boolean;
  transactionId?: string;
  txHash?: string;
  error?: string;
  state?: string;
}

export interface CircleWalletBalance {
  token: string;
  amount: string;
  updateDate: string;
}

/**
 * Get or create a Circle wallet for a user
 */
export async function getOrCreateCircleWallet(userId: string) {
  await connectToDatabase();

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (user.circleWalletId && user.circleWalletAddress) {
    return {
      circleWalletId: user.circleWalletId,
      circleWalletAddress: user.circleWalletAddress,
    };
  }

  const circle = getCircleClient();
  
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID!;
  if (!walletSetId) throw new Error("Missing CIRCLE_WALLET_SET_ID");

  // Create wallet on Base Sepolia for the pools
  const response = await circle.createWallets({
    walletSetId,
    accountType: "SCA",
    blockchains: ["BASE-SEPOLIA"],
    count: 1,
  });

  if (!response.data || response.data.wallets.length === 0) {
    throw new Error("Circle returned no wallets");
  }

  const wallet = response.data.wallets[0];

  user.circleWalletId = wallet.id;
  user.circleWalletAddress = wallet.address;
  await user.save();

  return {
    circleWalletId: wallet.id,
    circleWalletAddress: wallet.address,
  };
}

/**
 * Get Circle wallet balance
 * First tries Circle's API, then falls back to direct blockchain query
 */
export async function getCircleWalletBalance(walletId: string): Promise<CircleWalletBalance[]> {
  try {
    const circle = getCircleClient();
    
    const response = await circle.getWalletTokenBalance({
      id: walletId,
    });

    console.log('Circle wallet balance response:', JSON.stringify(response.data, null, 2));

    if (!response.data?.tokenBalances || response.data.tokenBalances.length === 0) {
      console.log('No balances from Circle API, will need to check on-chain');
      return [];
    }

    return response.data.tokenBalances.map((tb: any) => ({
      token: tb.token?.symbol || tb.token?.name || 'UNKNOWN',
      amount: tb.amount || '0',
      updateDate: tb.updateDate || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Get wallet balance error:', error);
    return [];
  }
}

/**
 * Get USDC balance directly from blockchain using ethers
 * This is a fallback when Circle API doesn't return token balances
 */
export async function getOnChainUSDCBalance(walletAddress: string): Promise<string> {
  try {
    // Use fetch to call Base Sepolia RPC directly
    const rpcUrl = 'https://sepolia.base.org';
    
    // balanceOf(address) function signature
    const balanceOfSelector = '0x70a08231';
    const paddedAddress = walletAddress.slice(2).padStart(64, '0');
    const data = balanceOfSelector + paddedAddress;
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: USDC_BASE_SEPOLIA,
          data: data,
        }, 'latest'],
        id: 1,
      }),
    });
    
    const result = await response.json();
    console.log('On-chain USDC balance result:', result);
    
    if (result.result) {
      // Convert hex to decimal (USDC has 6 decimals)
      const balanceWei = BigInt(result.result);
      const balance = Number(balanceWei) / 1e6;
      return balance.toString();
    }
    
    return '0';
  } catch (error) {
    console.error('Get on-chain USDC balance error:', error);
    return '0';
  }
}

/**
 * Get ETH balance directly from blockchain
 * Needed for gas fees on Circle wallet
 */
export async function getOnChainETHBalance(walletAddress: string): Promise<string> {
  try {
    const rpcUrl = 'https://sepolia.base.org';
    
    const response = await fetch(rpcUrl, {
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
    console.log('On-chain ETH balance result:', result);
    
    if (result.result) {
      // Convert hex to decimal (ETH has 18 decimals)
      const balanceWei = BigInt(result.result);
      const balance = Number(balanceWei) / 1e18;
      return balance.toFixed(6);
    }
    
    return '0';
  } catch (error) {
    console.error('Get on-chain ETH balance error:', error);
    return '0';
  }
}

/**
 * Execute a contract call using Circle Developer-Controlled Wallet
 * This allows AI to execute transactions without user signing
 */
export async function executeCircleTransaction(
  walletId: string,
  contractAddress: string,
  functionSignature: string,
  functionArgs: string[],
  amount?: string // For native token transfers
): Promise<CircleTransactionResult> {
  try {
    const circle = getCircleClient();
    
    console.log(`\n========================================`);
    console.log(`CIRCLE TRANSACTION EXECUTION`);
    console.log(`========================================`);
    console.log(`Wallet ID: ${walletId}`);
    console.log(`Contract: ${contractAddress}`);
    console.log(`Function: ${functionSignature}`);
    console.log(`Args: ${JSON.stringify(functionArgs)}`);
    console.log(`========================================\n`);

    // Create contract execution request
    // Note: Circle SDK expects specific parameter format
    const requestParams = {
      walletId: walletId,
      contractAddress: contractAddress,
      abiFunctionSignature: functionSignature,
      abiParameters: functionArgs,
      fee: {
        type: "level" as const,
        config: {
          feeLevel: "HIGH" as const, // Use HIGH to ensure transaction goes through
        },
      },
    };

    console.log('Request params:', JSON.stringify(requestParams, null, 2));

    // Call the Circle SDK to create a contract execution transaction
    const response = await circle.createContractExecutionTransaction(requestParams);

    console.log('\n--- CIRCLE API RESPONSE ---');
    console.log('Response status:', response ? 'OK' : 'Empty');
    // Only log response.data to avoid circular reference issues
    console.log('Response data:', response.data ? JSON.stringify(response.data, null, 2) : 'No data');
    console.log('--- END RESPONSE ---\n');

    if (!response.data) {
      console.error('No response data from Circle API');
      throw new Error("No response data from Circle");
    }

    // The response data structure
    const transaction = response.data as unknown as Record<string, unknown>;
    console.log(`Transaction created:`, JSON.stringify(transaction, null, 2));

    // Check if transaction was created successfully
    const transactionId = transaction.id as string | undefined;
    const txHash = (transaction.txHash || transaction.transactionHash) as string | undefined;
    const state = (transaction.state || transaction.status || 'PENDING') as string;

    console.log(`Transaction ID: ${transactionId}`);
    console.log(`TX Hash: ${txHash || 'Pending...'}`);
    console.log(`State: ${state}`);

    return {
      success: true,
      transactionId,
      txHash,
      state,
    };
  } catch (error: any) {
    console.error('\n========================================');
    console.error('CIRCLE TRANSACTION ERROR');
    console.error('========================================');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    
    // Try to extract detailed error info from Circle API response
    if (error?.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Check for specific error types
    if (error?.code) {
      console.error('Error code:', error.code);
    }
    
    console.error('Full error:', error);
    console.error('========================================\n');
    
    // Format error message for user
    let errorMessage = 'Unknown Circle API error';
    if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Approve ERC20 token spending
 */
export async function approveTokenSpending(
  walletId: string,
  tokenAddress: string,
  spenderAddress: string,
  amount: string // Amount in token's smallest unit (e.g., wei for 6 decimals = amount * 10^6)
): Promise<CircleTransactionResult> {
  return executeCircleTransaction(
    walletId,
    tokenAddress,
    "approve(address,uint256)",
    [spenderAddress, amount]
  );
}

/**
 * Deposit into a pool vault
 */
export async function depositToPool(
  walletId: string,
  poolContractAddress: string,
  amount: string // Amount in token's smallest unit
): Promise<CircleTransactionResult> {
  return executeCircleTransaction(
    walletId,
    poolContractAddress,
    "deposit(uint256)",
    [amount]
  );
}

/**
 * Execute full investment plan using Circle wallet
 * This handles: 
 * 1. Approve USDC for arcUSDC contract
 * 2. Convert USDC to arcUSDC
 * 3. Approve arcUSDC for pool
 * 4. Deposit to pool
 */
export async function executeInvestmentPlan(
  userId: string,
  allocations: Array<{
    poolId: string;
    poolName: string;
    amount: number; // USDC amount (e.g., 10.5 USDC)
    poolContractAddress?: string;
  }>,
  onProgress?: (step: number, total: number, message: string) => void
): Promise<{
  success: boolean;
  results: CircleTransactionResult[];
  error?: string;
}> {
  try {
    await connectToDatabase();

    // Get user and Circle wallet
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.circleWalletId || !user.circleWalletAddress) {
      throw new Error("User does not have a Circle wallet");
    }

    const walletId = user.circleWalletId;
    const results: CircleTransactionResult[] = [];
    
    // Calculate total steps: for each allocation: (approve USDC + wrap to arcUSDC + approve arcUSDC + deposit) = 4 steps
    const totalSteps = allocations.length * 4;
    let currentStep = 0;

    // Get pools from database to get contract addresses
    const poolIds = allocations.map(a => a.poolId).filter(Boolean);
    const pools = poolIds.length > 0 
      ? await Pool.find({ _id: { $in: poolIds } }).lean()
      : [];
    const poolMap = new Map(pools.map((p: any) => [p._id.toString(), p]));

    for (const allocation of allocations) {
      // Get pool contract address
      // Priority: explicit address > env var V2 address > DB address
      const pool = poolMap.get(allocation.poolId) as any;
      const riskLevel = pool?.riskLevel;
      let envAddress: string | undefined;
      if (riskLevel === 'low') envAddress = process.env.NEXT_PUBLIC_EASY_POOL_V2_ADDRESS || process.env.NEXT_POOL_VAULT_ADDRESS;
      else if (riskLevel === 'medium') envAddress = process.env.NEXT_PUBLIC_MEDIUM_POOL_V2_ADDRESS || process.env.NEXT_MEDIUM_POOL_VAULT_ADDRESS;
      else if (riskLevel === 'high') envAddress = process.env.NEXT_PUBLIC_HIGH_RISK_POOL_ADDRESS;
      
      const poolContractAddress = allocation.poolContractAddress || envAddress || pool?.contractAddress;
      
      if (!poolContractAddress) {
        results.push({
          success: false,
          error: `No contract address for ${allocation.poolName}`,
        });
        continue;
      }

      // Convert USDC amount to smallest unit (6 decimals)
      const amountInSmallestUnit = Math.floor(allocation.amount * 1_000_000).toString();

      // Step 1: Approve USDC spending for arcUSDC contract (to wrap USDC → arcUSDC)
      currentStep++;
      onProgress?.(currentStep, totalSteps, `Approving USDC for wrapping (${allocation.poolName})...`);

      const approveUsdcResult = await approveTokenSpending(
        walletId,
        USDC_BASE_SEPOLIA,  // Regular USDC
        ARC_USDC_BASE_SEPOLIA,  // arcUSDC contract (spender)
        amountInSmallestUnit
      );

      if (!approveUsdcResult.success) {
        results.push({
          success: false,
          error: `USDC approval failed for ${allocation.poolName}: ${approveUsdcResult.error}`,
        });
        continue;
      }

      // Wait for approval to be mined
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Step 2: Wrap USDC to arcUSDC by calling arcUSDC.deposit(amount)
      currentStep++;
      onProgress?.(currentStep, totalSteps, `Converting USDC to arcUSDC (${allocation.poolName})...`);

      const wrapResult = await executeCircleTransaction(
        walletId,
        ARC_USDC_BASE_SEPOLIA,  // arcUSDC contract
        "deposit(uint256)",  // arcUSDC deposit function
        [amountInSmallestUnit]
      );

      if (!wrapResult.success) {
        results.push({
          success: false,
          error: `USDC wrapping failed for ${allocation.poolName}: ${wrapResult.error}`,
        });
        continue;
      }

      // Wait for wrap to be mined
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Step 3: Approve arcUSDC spending for the pool
      currentStep++;
      onProgress?.(currentStep, totalSteps, `Approving arcUSDC for ${allocation.poolName}...`);

      const approveArcResult = await approveTokenSpending(
        walletId,
        ARC_USDC_BASE_SEPOLIA,  // arcUSDC token
        poolContractAddress,  // Pool contract (spender)
        amountInSmallestUnit
      );

      if (!approveArcResult.success) {
        results.push({
          success: false,
          error: `arcUSDC approval failed for ${allocation.poolName}: ${approveArcResult.error}`,
        });
        continue;
      }

      // Wait for approval to be mined
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Step 4: Deposit arcUSDC to pool
      currentStep++;
      onProgress?.(currentStep, totalSteps, `Depositing to ${allocation.poolName}...`);

      const depositResult = await depositToPool(
        walletId,
        poolContractAddress,
        amountInSmallestUnit
      );

      results.push({
        success: depositResult.success,
        transactionId: depositResult.transactionId,
        txHash: depositResult.txHash,
        state: depositResult.state,
        error: depositResult.error,
      });

      // Wait between allocations
      if (depositResult.success) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const allSucceeded = results.every(r => r.success);

    return {
      success: allSucceeded,
      results,
      error: allSucceeded ? undefined : 'Some allocations failed',
    };
  } catch (error) {
    console.error('Execute investment plan error:', error);
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Transfer tokens from Circle wallet to another address
 */
export async function transferFromCircleWallet(
  walletId: string,
  tokenAddress: string,
  toAddress: string,
  amount: string
): Promise<CircleTransactionResult> {
  return executeCircleTransaction(
    walletId,
    tokenAddress,
    "transfer(address,uint256)",
    [toAddress, amount]
  );
}

/**
 * Get transaction status from Circle
 */
export async function getTransactionStatus(transactionId: string): Promise<{
  state: string;
  txHash?: string;
  error?: string;
}> {
  try {
    const circle = getCircleClient();
    
    const response = await circle.getTransaction({
      id: transactionId,
    });

    if (!response.data) {
      throw new Error("No transaction data");
    }

    // Cast via unknown for dynamic property access
    const txData = response.data as unknown as Record<string, unknown>;

    return {
      state: (txData.state || txData.status || 'UNKNOWN') as string,
      txHash: (txData.txHash || txData.transactionHash) as string | undefined,
    };
  } catch (error) {
    console.error('Get transaction status error:', error);
    return {
      state: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
