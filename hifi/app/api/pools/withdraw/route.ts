import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import connectToDatabase from '@/lib/mongodb';
import Pool from '@/models/Pool';

// Contract ABIs
const POOL_VAULT_ABI = [
  'function state() external view returns (uint8)',
  'function shares(address user) external view returns (uint256)',
  'function totalShares() external view returns (uint256)',
  'function totalAssets() external view returns (uint256)',
  'function withdrawWindowEnd() external view returns (uint256)',
  'function previewWithdraw(address user) external view returns (uint256)',
];

const ARC_USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
];

// RPC endpoints by chainId  
const RPC_ENDPOINTS: Record<number, string> = {
  84532: 'https://sepolia.base.org',
};

/**
 * POST /api/pools/withdraw
 * Initiates withdrawal from a pool
 * In production, this would guide the user through MetaMask signing
 * For now, returns withdrawal info
 */
export async function POST(request: NextRequest) {
  try {
    const { contractAddress, userAddress } = await request.json();

    if (!contractAddress) {
      return NextResponse.json(
        { success: false, error: 'Contract address required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectToDatabase();

    // Find the pool
    const pool = await Pool.findOne({ 
      contractAddress: { $regex: new RegExp(`^${contractAddress}$`, 'i') }
    });
    
    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Verify on-chain state
    const rpcUrl = RPC_ENDPOINTS[pool.chainId];
    if (!rpcUrl) {
      return NextResponse.json(
        { success: false, error: 'Unsupported chain' },
        { status: 400 }
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const poolVault = new ethers.Contract(contractAddress, POOL_VAULT_ABI, provider);

    // Read on-chain state
    const stateRaw = await poolVault.state();
    const currentState = Number(stateRaw);
    
    // State 2 = WITHDRAW_WINDOW
    if (currentState !== 2) {
      // For demo purposes, if state is DEPLOYED (1), we'll simulate opening withdraw window
      if (currentState === 1) {
        // Update DB to WITHDRAW_WINDOW state
        await Pool.updateOne(
          { _id: pool._id },
          { 
            $set: { 
              state: 'WITHDRAW_WINDOW',
              updatedAt: new Date()
            }
          }
        );
        
        return NextResponse.json({
          success: true,
          message: 'Withdraw window opened. Please try withdrawal again.',
          action: 'WINDOW_OPENED',
        });
      }
      
      return NextResponse.json(
        { success: false, error: 'Withdraw window is not open' },
        { status: 400 }
      );
    }

    // Get TVL for withdrawal amount estimation
    const arcUsdcAddress = process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS;
    if (!arcUsdcAddress) {
      return NextResponse.json(
        { success: false, error: 'ArcUSDC address not configured' },
        { status: 500 }
      );
    }

    const arcUsdc = new ethers.Contract(arcUsdcAddress, ARC_USDC_ABI, provider);
    const vaultBalance = await arcUsdc.balanceOf(contractAddress);
    
    // In production, we'd need the user's address to calculate their share
    // For now, return the total available for withdrawal
    const withdrawableAmount = ethers.formatUnits(vaultBalance, 6);

    return NextResponse.json({
      success: true,
      message: 'Ready for withdrawal',
      action: 'READY_TO_WITHDRAW',
      data: {
        contractAddress,
        availableToWithdraw: withdrawableAmount,
        // In production, include user-specific data:
        // userShares: userShares,
        // userWithdrawable: previewAmount,
      },
      // Instructions for the frontend to guide user through MetaMask
      instructions: {
        step1: 'Connect wallet on Base Sepolia',
        step2: 'Call withdraw() on the vault contract',
        step3: 'arcUSDC will be transferred to your wallet',
        step4: 'Unwrap arcUSDC to USDC via ArcUSDC.withdraw()',
      },
    });

  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Withdrawal failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pools/withdraw?contractAddress=0x...&userAddress=0x...
 * Get withdrawal info for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get('contractAddress');
    const userAddress = searchParams.get('userAddress');

    if (!contractAddress) {
      return NextResponse.json(
        { success: false, error: 'Contract address required' },
        { status: 400 }
      );
    }

    // Find the pool
    await connectToDatabase();
    const pool = await Pool.findOne({ 
      contractAddress: { $regex: new RegExp(`^${contractAddress}$`, 'i') }
    });
    
    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    const rpcUrl = RPC_ENDPOINTS[pool.chainId];
    if (!rpcUrl) {
      return NextResponse.json(
        { success: false, error: 'Unsupported chain' },
        { status: 400 }
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const poolVault = new ethers.Contract(contractAddress, POOL_VAULT_ABI, provider);

    // Get vault state
    const [stateRaw, totalShares] = await Promise.all([
      poolVault.state(),
      poolVault.totalShares(),
    ]);

    const state = Number(stateRaw);
    const stateNames = ['COLLECTING', 'DEPLOYED', 'WITHDRAW_WINDOW'];

    // Get user shares if address provided
    let userShares = BigInt(0);
    let userWithdrawable = '0';
    
    if (userAddress) {
      userShares = await poolVault.shares(userAddress);
      if (userShares > BigInt(0)) {
        try {
          const preview = await poolVault.previewWithdraw(userAddress);
          userWithdrawable = ethers.formatUnits(preview, 6);
        } catch {
          // previewWithdraw might not exist on older contracts
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        contractAddress,
        state: stateNames[state] || 'UNKNOWN',
        totalShares: ethers.formatUnits(totalShares, 6),
        canWithdraw: state === 2,
        userShares: ethers.formatUnits(userShares, 6),
        userWithdrawable,
      },
    });

  } catch (error) {
    console.error('Error getting withdrawal info:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get withdrawal info' },
      { status: 500 }
    );
  }
}
