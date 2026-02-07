import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Pool from '@/models/Pool';
import { 
  depositToPool,
  checkUSDCBalance,
  checkGasBalance,
} from '@/lib/circle-executor';

/**
 * V2 pool contract addresses from env vars.
 * These override DB addresses for Circle/AI deposits.
 */
function getV2PoolAddressByRiskLevel(riskLevel?: string): string | undefined {
  switch (riskLevel) {
    case 'low':
      return process.env.NEXT_PUBLIC_EASY_POOL_V2_ADDRESS || process.env.NEXT_POOL_VAULT_ADDRESS;
    case 'medium':
      return process.env.NEXT_PUBLIC_MEDIUM_POOL_V2_ADDRESS || process.env.NEXT_MEDIUM_POOL_VAULT_ADDRESS;
    case 'high':
      return process.env.NEXT_PUBLIC_HIGH_RISK_POOL_ADDRESS;
    default:
      return undefined;
  }
}

/**
 * POST - Execute a single pool investment via Circle wallet
 * This does the same thing as MetaMask manual flow:
 * 1. Approve USDC for arcUSDC contract
 * 2. Wrap USDC → arcUSDC
 * 3. Approve arcUSDC for Pool
 * 4. Deposit arcUSDC to Pool
 * 
 * CRITICAL: This waits for transaction confirmation before returning success.
 * Transactions are NOT marked as successful until on-chain confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { userId, poolId, amount, poolContractAddress } = body;
    
    console.log('[Circle Invest API] Request:', { userId, poolId, amount, poolContractAddress });
    
    if (!userId || !poolId || !amount) {
      return NextResponse.json(
        { error: 'userId, poolId, and amount are required' },
        { status: 400 }
      );
    }
    
    // Get user with Circle wallet
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    if (!user.circleWalletId || !user.circleWalletAddress) {
      return NextResponse.json(
        { error: 'User does not have a Circle wallet. Please set up Circle wallet first.' },
        { status: 400 }
      );
    }
    
    const walletAddress = user.circleWalletAddress;
    
    // Get pool contract address and name
    // Priority: explicit poolContractAddress > env var V2 address > DB address
    let contractAddress = poolContractAddress;
    let poolName = 'Unknown Pool';
    
    const pool = await Pool.findById(poolId);
    if (pool) {
      // Override with V2 env var address based on pool risk level
      const envAddress = getV2PoolAddressByRiskLevel(pool.riskLevel);
      if (!contractAddress) {
        contractAddress = envAddress || pool.contractAddress;
      }
      poolName = pool.name || 'Unknown Pool';
      console.log(`[Circle Invest API] Address resolution: explicit=${poolContractAddress || 'n/a'}, env=${envAddress || 'n/a'}, db=${pool.contractAddress}, final=${contractAddress}`);
    } else if (!contractAddress) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }
    
    if (!contractAddress) {
      return NextResponse.json({ error: 'Pool contract address not found' }, { status: 400 });
    }
    
    console.log(`[Circle Invest API] Investing ${amount} USDC into pool ${poolId} via Circle wallet`);
    
    // Check gas balance first
    const gasCheck = await checkGasBalance(walletAddress);
    if (!gasCheck.hasGas) {
      return NextResponse.json({
        error: `Insufficient ETH for gas fees. Your Circle wallet needs at least ${gasCheck.minRequired} ETH.`,
        currentGasBalance: gasCheck.balance,
        minRequired: gasCheck.minRequired,
        circleWalletAddress: walletAddress,
        action: 'Please send some ETH (Base Sepolia) to your Circle wallet to cover gas fees.',
      }, { status: 400 });
    }
    
    // Check USDC balance
    const usdcBalance = await checkUSDCBalance(walletAddress);
    const investAmount = parseFloat(amount);
    
    if (usdcBalance < investAmount) {
      return NextResponse.json({
        error: `Insufficient USDC balance. Required: ${investAmount}, Available: ${usdcBalance}`,
        currentBalance: usdcBalance,
        requiredAmount: investAmount,
      }, { status: 400 });
    }
    
    console.log(`[Circle Invest API] Balance check passed. USDC: ${usdcBalance}, ETH: ${gasCheck.balance}`);
    
    // Execute the deposit using the new Circle executor with confirmation waiting
    const result = await depositToPool(
      userId,
      contractAddress,
      investAmount,
      poolId,
      poolName
    );
    
    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Investment failed',
        steps: result.steps,
      }, { status: 500 });
    }
    
    // Find the deposit transaction hash - MUST be a real blockchain hash
    const depositStep = result.steps.find(s => s.step === 'deposit_pool');
    const txHash = depositStep?.txHash;
    
    // CRITICAL: Validate we have a REAL txHash before marking success
    if (!txHash || !txHash.startsWith('0x')) {
      console.error('[Circle Invest API] ❌ No valid txHash in deposit step!');
      return NextResponse.json({
        error: 'Transaction submitted but no valid blockchain hash received. Check BaseScan manually.',
        steps: result.steps,
      }, { status: 500 });
    }
    
    // Return ONLY real data - all txHashes must be valid blockchain hashes
    return NextResponse.json({
      success: true,
      message: `Successfully invested ${amount} USDC via Circle wallet`,
      txHash, // Real blockchain hash that opens on BaseScan
      steps: result.steps.map(s => ({
        step: s.step,
        success: s.success,
        txHash: s.txHash, // Real hashes only
        error: s.error,
      })),
    });
    
  } catch (error) {
    console.error('[Circle Invest API] Error:', error);
    return NextResponse.json({
      error: 'Investment failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
