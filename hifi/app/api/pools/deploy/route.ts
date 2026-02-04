import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import connectToDatabase from '@/lib/mongodb';
import Pool from '@/models/Pool';

// Contract ABIs
const POOL_VAULT_ABI = [
  'function state() external view returns (uint8)',
  'function cap() external view returns (uint256)',
  'function totalAssets() external view returns (uint256)',
  'function owner() external view returns (address)',
  'function deploy() external',
  'function deployToAave() external',
];

const ARC_USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
];

// RPC endpoints by chainId
const RPC_ENDPOINTS: Record<number, string> = {
  84532: 'https://sepolia.base.org',
};

/**
 * POST /api/pools/deploy
 * Triggers deployment of pool funds to Aave when cap is reached
 * For now, this updates the DB state. In production, this would use a backend wallet to call the contract.
 */
export async function POST(request: NextRequest) {
  try {
    const { contractAddress } = await request.json();

    if (!contractAddress) {
      return NextResponse.json(
        { success: false, error: 'Contract address required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectToDatabase();

    // Find the pool
    const pool = await Pool.findOne({ contractAddress: contractAddress.toLowerCase() });
    if (!pool) {
      // Try case-insensitive search
      const poolCaseInsensitive = await Pool.findOne({ 
        contractAddress: { $regex: new RegExp(`^${contractAddress}$`, 'i') }
      });
      if (!poolCaseInsensitive) {
        return NextResponse.json(
          { success: false, error: 'Pool not found' },
          { status: 404 }
        );
      }
    }

    const foundPool = pool || await Pool.findOne({ 
      contractAddress: { $regex: new RegExp(`^${contractAddress}$`, 'i') }
    });

    // Verify on-chain state
    const rpcUrl = RPC_ENDPOINTS[foundPool!.chainId];
    if (!rpcUrl) {
      return NextResponse.json(
        { success: false, error: 'Unsupported chain' },
        { status: 400 }
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const arcUsdcAddress = process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS;
    
    if (!arcUsdcAddress) {
      return NextResponse.json(
        { success: false, error: 'ArcUSDC address not configured' },
        { status: 500 }
      );
    }

    const arcUsdc = new ethers.Contract(arcUsdcAddress, ARC_USDC_ABI, provider);
    const poolVault = new ethers.Contract(contractAddress, POOL_VAULT_ABI, provider);

    // Read on-chain state
    const [stateRaw, cap] = await Promise.all([
      poolVault.state(),
      poolVault.cap(),
    ]);

    const currentState = Number(stateRaw);
    
    // State 0 = COLLECTING, 1 = DEPLOYED, 2 = WITHDRAW_WINDOW
    if (currentState !== 0) {
      return NextResponse.json(
        { success: false, error: 'Pool is not in COLLECTING state' },
        { status: 400 }
      );
    }

    // Check TVL
    const tvl = await arcUsdc.balanceOf(contractAddress);
    
    if (tvl < cap) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cap not reached. Current: ${ethers.formatUnits(tvl, 6)}, Required: ${ethers.formatUnits(cap, 6)} USDC` 
        },
        { status: 400 }
      );
    }

    // In a production system, this is where we'd use a backend wallet to call:
    // - vault.deployToAave() or vault.deploy()
    // 
    // For now, we'll update the DB state to simulate deployment
    // The actual Aave integration would require:
    // 1. A backend wallet with owner privileges
    // 2. Or a permissionless deployToAave() function in the contract
    //
    // TODO: Implement actual on-chain deployment
    
    // Update pool state in DB
    await Pool.updateOne(
      { _id: foundPool!._id },
      { 
        $set: { 
          state: 'DEPLOYED',
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Pool deployed successfully',
      data: {
        contractAddress,
        tvl: ethers.formatUnits(tvl, 6),
        state: 'DEPLOYED',
      },
    });

  } catch (error) {
    console.error('Error deploying pool:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Deploy failed' },
      { status: 500 }
    );
  }
}
