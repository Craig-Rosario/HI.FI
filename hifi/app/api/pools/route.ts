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

    // Fetch all pools from the database
    // You can add query parameters later for filtering (e.g., by state, chainId)
    const pools = await Pool.find({}).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      data: pools,
      count: pools.length,
    });
  } catch (error) {
    console.error('Error fetching pools:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch pools',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pools
 * Creates a new pool (admin only in production)
 */
export async function POST(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Parse request body
    const body = await request.json();

    // Validate required fields
    const { name, description, cap, contractAddress, chainId } = body;
    
    if (!name || !description || !cap || !contractAddress || !chainId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['name', 'description', 'cap', 'contractAddress', 'chainId'],
        },
        { status: 400 }
      );
    }

    // Create new pool
    const pool = await Pool.create({
      name,
      description,
      cap,
      contractAddress,
      chainId,
      state: body.state || 'COLLECTING',
      tvl: body.tvl || '0',
      apy: body.apy || '0',
      waitTime: body.waitTime || 420, // 7 minutes default
      minDeposit: body.minDeposit || 100, // 100 USDC default
    });

    return NextResponse.json(
      {
        success: true,
        data: pool,
        message: 'Pool created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating pool:', error);
    
    // Handle duplicate key error
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pool already exists for this contract address and chain',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create pool',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
