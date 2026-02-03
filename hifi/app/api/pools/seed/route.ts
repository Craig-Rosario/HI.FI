import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Pool from '@/models/Pool';

/**
 * POST /api/pools/seed
 * Seeds the database with initial pool data for development
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          success: false,
          error: 'Seeding is not allowed in production',
        },
        { status: 403 }
      );
    }

    // Connect to MongoDB
    await connectToDatabase();

    // Sample pool data
    const samplePools = [
      {
        name: 'Low Risk Pool',
        description: 'Conservative strategy with stable returns. Ideal for risk-averse investors seeking steady yield.',
        state: 'COLLECTING',
        tvl: '45000',
        cap: '100000',
        apy: '6.5',
        waitTime: 10080, // 7 days in minutes
        minDeposit: 100,
        contractAddress: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
        chainId: 31337, // Hardhat local network
      },
      {
        name: 'Medium Risk Pool',
        description: 'Balanced approach for moderate returns with controlled risk exposure.',
        state: 'COLLECTING',
        tvl: '35000',
        cap: '70000',
        apy: '14.2',
        waitTime: 1440, // 24 hours in minutes
        minDeposit: 250,
        contractAddress: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
        chainId: 31337,
      },
      {
        name: 'High Risk Pool',
        description: 'Aggressive strategy for maximum returns. Suitable for experienced investors with high risk tolerance.',
        state: 'ACTIVE',
        tvl: '23000',
        cap: '50000',
        apy: '28.7',
        waitTime: 240, // 4 hours in minutes
        minDeposit: 500,
        contractAddress: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
        chainId: 31337,
      },
    ];

    // Clear existing pools (development only)
    await Pool.deleteMany({});

    // Insert sample pools
    const pools = await Pool.insertMany(samplePools);

    return NextResponse.json(
      {
        success: true,
        message: 'Database seeded successfully',
        data: pools,
        count: pools.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error seeding pools:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to seed database',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
