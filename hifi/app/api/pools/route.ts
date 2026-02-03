import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Pool from '@/models/Pool';

/**
 * GET /api/pools
 * Fetches all pools from MongoDB
 */
export async function GET(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Fetch all pools, sorted by creation date (newest first)
    const pools = await Pool.find({}).sort({ createdAt: -1 }).lean();

    return NextResponse.json(
      {
        success: true,
        data: pools,
        count: pools.length,
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
