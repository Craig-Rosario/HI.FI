import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import connectToDatabase from '@/lib/mongodb';
import Pool from '@/models/Pool';

// ABI for reading vault state (supports Aave, Medium Risk, and V2 pool contracts)
const POOL_VAULT_ABI = [
  'function state() external view returns (uint8)',
  'function cap() external view returns (uint256)',
  'function totalShares() external view returns (uint256)',
  'function totalAssets() external view returns (uint256)',
  // Both Aave and Medium Risk contract functions
  'function deployedAt() external view returns (uint256)',
  'function isWithdrawOpen() external view returns (bool)',
  'function timeUntilWithdraw() external view returns (uint256)',
  'function totalAssetsDeployed() external view returns (uint256)',
  'function yieldEarned() external view returns (uint256)',
  // Medium Risk and V2 pools specific
  'function currentPnL() external view returns (int256)',
  'function deployedAssets() external view returns (uint256)',
  // V2 pools additional functions
  'function treasury() external view returns (address)',
  'function accumulatedPnL() external view returns (int256)',
  'function accumulatedYield() external view returns (uint256)',
  'function getMinutesElapsed() external view returns (uint256)',
  // High risk pool specific
  'function getSentiment() external view returns (string)',
  'function getMaxLossPercent() external view returns (uint256)',
];

const ARC_USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
];

// aUSDC on Base Sepolia (for reading deployed assets)
const AUSDC_ADDRESS = '0xf53B60F4006cab2b3C4688ce41fD5362427A2A66';

// RPC endpoints by chainId
const RPC_ENDPOINTS: Record<number, string> = {
  84532: 'https://sepolia.base.org', // Base Sepolia
  11155111: 'https://eth-sepolia.public.blastapi.io', // Ethereum Sepolia
};

/**
 * Fetch on-chain TVL for a pool (handles both COLLECTING and DEPLOYED states)
 * Supports both Aave (aUSDC) and Simulated (internal) adapters
 */
async function getOnChainTVL(
  contractAddress: string, 
  chainId: number, 
  state: string,
  adapterType?: string
): Promise<string> {
  try {
    const rpcUrl = RPC_ENDPOINTS[chainId];
    if (!rpcUrl) {
      console.warn(`No RPC endpoint for chainId ${chainId}`);
      return '0';
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // If DEPLOYED, check based on adapter type
    if (state === 'DEPLOYED') {
      // For simulated adapter, use totalAssetsDeployed from vault
      if (adapterType === 'simulated') {
        try {
          const vault = new ethers.Contract(contractAddress, POOL_VAULT_ABI, provider);
          const assets = await vault.totalAssetsDeployed();
          return ethers.formatUnits(assets, 6);
        } catch (error) {
          console.warn('Failed to read totalAssetsDeployed for simulated adapter:', error);
          return '0';
        }
      }
      
      // For Aave adapter, check aUSDC balance
      try {
        const aUsdc = new ethers.Contract(AUSDC_ADDRESS, ARC_USDC_ABI, provider);
        const balance = await aUsdc.balanceOf(contractAddress);
        return ethers.formatUnits(balance, 6);
      } catch (aaveError) {
        console.warn('Failed to read aUSDC balance, trying vault totalAssetsDeployed...');
        // Fallback: try reading from vault's totalAssetsDeployed function
        try {
          const vault = new ethers.Contract(contractAddress, ['function totalAssetsDeployed() view returns (uint256)'], provider);
          const assets = await vault.totalAssetsDeployed();
          return ethers.formatUnits(assets, 6);
        } catch {
          console.warn('totalAssetsDeployed also failed, returning 0');
          return '0';
        }
      }
    }
    
    // If COLLECTING, check arcUSDC balance in vault
    const arcUsdcAddress = process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS;
    if (!arcUsdcAddress) {
      console.warn('NEXT_PUBLIC_ARCUSDC_ADDRESS not set');
      return '0';
    }

    const arcUsdc = new ethers.Contract(arcUsdcAddress, ARC_USDC_ABI, provider);
    const balance = await arcUsdc.balanceOf(contractAddress);
    return ethers.formatUnits(balance, 6);
  } catch (error) {
    console.error(`Error fetching on-chain TVL for ${contractAddress}:`, error);
    return '0';
  }
}

/**
 * Fetch on-chain state for a pool
 */
async function getOnChainState(contractAddress: string, chainId: number): Promise<string> {
  try {
    const rpcUrl = RPC_ENDPOINTS[chainId];
    if (!rpcUrl) return 'COLLECTING';

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const poolVault = new ethers.Contract(contractAddress, POOL_VAULT_ABI, provider);
    
    const stateRaw = await poolVault.state();
    const stateNum = Number(stateRaw);
    
    const stateMap: Record<number, string> = {
      0: 'COLLECTING',
      1: 'DEPLOYED',
      2: 'WITHDRAW_WINDOW',
    };
    
    return stateMap[stateNum] || 'COLLECTING';
  } catch (error) {
    console.error(`Error fetching on-chain state for ${contractAddress}:`, error);
    return 'COLLECTING';
  }
}

/**
 * Check if withdraw is open for a pool (new Aave contract)
 */
async function checkWithdrawOpen(contractAddress: string, chainId: number): Promise<{isOpen: boolean, timeLeft: number}> {
  try {
    const rpcUrl = RPC_ENDPOINTS[chainId];
    if (!rpcUrl) return { isOpen: false, timeLeft: 0 };

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const poolVault = new ethers.Contract(contractAddress, POOL_VAULT_ABI, provider);
    
    // Try to call isWithdrawOpen (only on new contracts)
    try {
      const isOpen = await poolVault.isWithdrawOpen();
      const timeLeft = await poolVault.timeUntilWithdraw();
      return { isOpen, timeLeft: Number(timeLeft) };
    } catch {
      // Old contract doesn't have this function
      return { isOpen: false, timeLeft: 0 };
    }
  } catch (error) {
    console.error(`Error checking withdraw status for ${contractAddress}:`, error);
    return { isOpen: false, timeLeft: 0 };
  }
}

/**
 * Auto-deploy to Aave when cap is reached
 * This simulates the backend automatically triggering deployment
 */
async function autoDeployIfCapReached(
  contractAddress: string, 
  chainId: number, 
  tvl: string, 
  cap: string,
  onChainState: string,
  poolId: string
): Promise<string> {
  const tvlNum = parseFloat(tvl);
  const capNum = parseFloat(cap);
  
  // Only auto-deploy if TVL >= cap AND state is still COLLECTING
  if (tvlNum >= capNum && onChainState === 'COLLECTING') {
    console.log(`Auto-deploying pool ${contractAddress}: TVL ${tvl} >= cap ${cap}`);
    
    // Update DB state to DEPLOYED
    // In production, this would call the actual contract via a backend wallet
    try {
      await Pool.updateOne(
        { _id: poolId },
        { $set: { state: 'DEPLOYED', updatedAt: new Date() } }
      );
      
      // Return DEPLOYED state since we've triggered deployment
      return 'DEPLOYED';
    } catch (err) {
      console.error('Auto-deploy DB update failed:', err);
    }
  }
  
  return onChainState;
}

/**
 * GET /api/pools
 * Fetches all pools from MongoDB and enriches with on-chain data
 * Automatically triggers deployment when cap is reached
 * Syncs MongoDB state with on-chain state (including pool resets)
 */
export async function GET(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Fetch all pools, sorted by creation date (newest first)
    const pools = await Pool.find({}).sort({ createdAt: -1 }).lean();

    // Enrich pools with on-chain data
    const enrichedPools = await Promise.all(
      pools.map(async (pool) => {
        // Fetch on-chain state first
        const onChainState = await getOnChainState(pool.contractAddress, pool.chainId);
        
        // Fetch TVL (handles both COLLECTING and DEPLOYED states, supports different adapters)
        const onChainTVL = await getOnChainTVL(
          pool.contractAddress, 
          pool.chainId, 
          onChainState,
          pool.adapterType // Pass adapter type for proper TVL calculation
        );
        
        // Sync MongoDB state with on-chain state if different
        // This handles pool resets (DEPLOYED/WITHDRAW_WINDOW -> COLLECTING)
        if (pool.state !== onChainState) {
          try {
            await Pool.updateOne(
              { _id: pool._id },
              { $set: { state: onChainState, updatedAt: new Date() } }
            );
            console.log(`Synced pool ${pool.name} state: ${pool.state} -> ${onChainState}`);
          } catch (err) {
            console.error('Failed to sync pool state:', err);
          }
        }
        
        // Auto-deploy if cap is reached and still collecting
        let finalState = await autoDeployIfCapReached(
          pool.contractAddress,
          pool.chainId,
          onChainTVL,
          pool.cap,
          onChainState,
          pool._id.toString()
        );
        
        // Check if withdraw is open (for DEPLOYED state)
        let withdrawOpen = false;
        let withdrawTimeLeft = 0;
        
        if (finalState === 'DEPLOYED') {
          const withdrawStatus = await checkWithdrawOpen(pool.contractAddress, pool.chainId);
          withdrawOpen = withdrawStatus.isOpen;
          withdrawTimeLeft = withdrawStatus.timeLeft;
        }
        
        return {
          ...pool,
          tvl: onChainTVL, // Override DB tvl with on-chain value
          state: finalState, // Use final state after auto-deploy check
          withdrawOpen, // Is withdraw available now?
          withdrawTimeLeft, // Seconds until withdraw opens
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: enrichedPools,
        count: enrichedPools.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching pools:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pools',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pools
 * Creates a new pool in MongoDB
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Connect to MongoDB
    await connectToDatabase();

    // Create new pool
    const pool = await Pool.create({
      name: body.name,
      description: body.description,
      state: body.state || 'COLLECTING',
      tvl: body.tvl || '0',
      cap: body.cap,
      apy: body.apy || '0',
      waitTime: body.waitTime || 0,
      minDeposit: body.minDeposit || 100, // 100 USDC default
      contractAddress: body.contractAddress,
      chainId: body.chainId || 31337, // Default to local network
      riskLevel: body.riskLevel || 'low', // Default to low risk
      adapterType: body.adapterType || 'aave', // Default to aave adapter
    });

    return NextResponse.json(
      {
        success: true,
        data: pool,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating pool:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create pool',
      },
      { status: 500 }
    );
  }
}
