import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Pool from '@/models/Pool';

/**
 * POST /api/pools/seed
 * Seeds the database with the Base Sepolia Conservative pool
 */
export async function POST(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Delete existing pools (optional - for clean re-seed)
    await Pool.deleteMany({});

    // Get pool vault address from env
    const poolVaultAddress = process.env.NEXT_PUBLIC_POOL_VAULT_ADDRESS;
    if (!poolVaultAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'NEXT_PUBLIC_POOL_VAULT_ADDRESS not configured',
        },
        { status: 500 }
      );
    }

    // Create the Base Sepolia Conservative pool
    const pool = await Pool.create({
      name: 'Base Sepolia Conservative',
      description: 'Low-risk USDC pool with automated Aave V3 deployment. Testnet deployment on Base Sepolia for yield generation.',
      state: 'COLLECTING',
      tvl: '0', // Will be overwritten by on-chain read
      cap: '10', // 10 USDC cap for testing
      apy: '5-8',
      waitTime: 10080 * 60, // ~10080 minutes in seconds (7 days)
      minDeposit: 1, // 1 USDC minimum
      contractAddress: poolVaultAddress,
      chainId: 84532, // Base Sepolia
    });

    return NextResponse.json(
      {
        success: true,
        data: pool,
        message: 'Pool seeded successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error seeding pool:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to seed pool',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pools/seed
 * Returns info about seeding
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'POST to this endpoint to seed the database with the default pool',
    poolVaultAddress: process.env.NEXT_PUBLIC_POOL_VAULT_ADDRESS || 'NOT SET',
    arcUsdcAddress: process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS || 'NOT SET',
  });
}
