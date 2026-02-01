import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateCircleWallet } from '@/lib/circle-wallets';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const circleWalletInfo = await getOrCreateCircleWallet(userId);

    return NextResponse.json({
      success: true,
      circleWallet: circleWalletInfo
    });

  } catch (error) {
    console.error('Circle wallet creation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: `Failed to create Circle wallet: ${errorMessage}` },
      { status: 500 }
    );
  }
}