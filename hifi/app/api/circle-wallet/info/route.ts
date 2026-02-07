import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { checkUSDCBalance, checkGasBalance } from '@/lib/circle-executor';
import { getOrCreateCircleWallet } from '@/lib/circle-wallets';

// GET - Get Circle wallet info and balance
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If user doesn't have a Circle wallet, create one
    if (!user.circleWalletId || !user.circleWalletAddress) {
      const wallet = await getOrCreateCircleWallet(userId);
      return NextResponse.json({
        success: true,
        wallet: {
          id: wallet.circleWalletId,
          address: wallet.circleWalletAddress,
          balances: [],
          ethBalance: '0',
          hasGas: false,
          isNew: true,
        },
        message: 'Circle wallet created! Fund it with USDC and ETH (for gas) to enable AI-managed execution.',
        fundingInstructions: {
          network: 'Base Sepolia',
          address: wallet.circleWalletAddress,
          token: 'USDC',
          tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          note: 'Send USDC on Base Sepolia to this address to fund your AI-managed wallet.',
          gasNote: '⚠️ IMPORTANT: Also send ~0.001 ETH for gas fees to enable transactions.',
        },
      });
    }

    // Get on-chain balances directly (more reliable than Circle API)
    const [usdcBalance, gasCheck] = await Promise.all([
      checkUSDCBalance(user.circleWalletAddress),
      checkGasBalance(user.circleWalletAddress),
    ]);

    // Format balances for the response
    const balances = usdcBalance > 0 ? [{
      token: 'USDC',
      amount: usdcBalance.toString(),
      updateDate: new Date().toISOString(),
    }] : [];

    return NextResponse.json({
      success: true,
      wallet: {
        id: user.circleWalletId,
        address: user.circleWalletAddress,
        balances,
        ethBalance: gasCheck.balance,
        hasGas: gasCheck.hasGas,
        isNew: false,
      },
      ...((!gasCheck.hasGas) && {
        warning: `⚠️ Insufficient ETH for gas fees. Please send at least ${gasCheck.minRequired} ETH to your Circle wallet.`,
      }),
      fundingInstructions: {
        network: 'Base Sepolia',
        address: user.circleWalletAddress,
        token: 'USDC',
        tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        note: 'Send USDC on Base Sepolia to this address to fund your AI-managed wallet.',
        gasNote: gasCheck.hasGas 
          ? '✅ Gas balance OK' 
          : `⚠️ IMPORTANT: Send ~${gasCheck.minRequired} ETH for gas fees to enable transactions.`,
      },
    });

  } catch (error) {
    console.error('Get Circle wallet error:', error);
    return NextResponse.json(
      { error: 'Failed to get Circle wallet', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create Circle wallet if doesn't exist
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const wallet = await getOrCreateCircleWallet(userId);

    // Get initial balance using on-chain checks
    const [usdcBalance, gasCheck] = await Promise.all([
      checkUSDCBalance(wallet.circleWalletAddress),
      checkGasBalance(wallet.circleWalletAddress),
    ]);
    
    const balances = usdcBalance > 0 ? [{
      token: 'USDC',
      amount: usdcBalance.toString(),
      updateDate: new Date().toISOString(),
    }] : [];

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.circleWalletId,
        address: wallet.circleWalletAddress,
        balances,
        ethBalance: gasCheck.balance,
        hasGas: gasCheck.hasGas,
      },
      message: 'Circle wallet ready for AI-managed execution!',
      fundingInstructions: {
        network: 'Base Sepolia',
        address: wallet.circleWalletAddress,
        token: 'USDC',
        tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        note: 'Send USDC on Base Sepolia to this address to fund your AI-managed wallet.',
        gasNote: gasCheck.hasGas 
          ? '✅ Gas balance OK' 
          : `⚠️ IMPORTANT: Send ~${gasCheck.minRequired} ETH for gas fees to enable transactions.`,
      },
    });

  } catch (error) {
    console.error('Create Circle wallet error:', error);
    return NextResponse.json(
      { error: 'Failed to create Circle wallet', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
