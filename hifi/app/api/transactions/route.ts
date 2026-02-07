import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Transaction from '@/models/Transaction';
import Pool from '@/models/Pool';

const ITEMS_PER_PAGE = 20;

/**
 * GET /api/transactions
 * Fetch user transactions with pagination
 * Query params:
 *   - userAddress: wallet address (required)
 *   - circleWalletAddress: Circle wallet address (optional, to include Circle tx)
 *   - page: page number (default: 1)
 *   - type: 'deposit' | 'withdrawal' | 'all' (default: 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const circleWalletAddress = searchParams.get('circleWalletAddress');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const type = searchParams.get('type') || 'all';

    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Build query — match transactions from either MetaMask or Circle wallet
    const addressFilters: Record<string, string>[] = [
      { userAddress: userAddress.toLowerCase() },
    ];
    if (circleWalletAddress) {
      addressFilters.push({ userAddress: circleWalletAddress.toLowerCase() });
    }

    const query: Record<string, unknown> = {
      $or: addressFilters,
    };

    if (type !== 'all') {
      query.type = type;
    }

    // Get total count for pagination
    const totalCount = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

    // Fetch transactions with pagination, sorted by most recent first
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
      .lean();

    return NextResponse.json({
      transactions,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        itemsPerPage: ITEMS_PER_PAGE,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions
 * Create a new transaction record
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, poolId, type, chain, amount, txHash, status } = body;

    // Validate required fields
    if (!userAddress || !poolId || !type || !chain || !amount || !txHash) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, poolId, type, chain, amount, txHash' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['deposit', 'withdrawal'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "deposit" or "withdrawal"' },
        { status: 400 }
      );
    }

    // Validate chain
    if (!['ETH', 'BASE'].includes(chain)) {
      return NextResponse.json(
        { error: 'Invalid chain. Must be "ETH" or "BASE"' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get pool name
    let poolName = 'Unknown Pool';
    try {
      const pool = await Pool.findById(poolId).lean();
      if (pool) {
        poolName = pool.name;
      }
    } catch {
      console.warn('Could not fetch pool name for poolId:', poolId);
    }

    // Check if transaction already exists
    const existingTx = await Transaction.findOne({ txHash: txHash.toLowerCase() });
    if (existingTx) {
      return NextResponse.json(
        { message: 'Transaction already exists', transaction: existingTx },
        { status: 200 }
      );
    }

    // Create transaction
    const transaction = await Transaction.create({
      userAddress: userAddress.toLowerCase(),
      poolId,
      poolName,
      type,
      chain,
      amount,
      txHash: txHash.toLowerCase(),
      status: status || 'confirmed',
    });

    return NextResponse.json(
      { message: 'Transaction recorded', transaction },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/transactions
 * Update transaction status (e.g., from pending to confirmed)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { txHash, status } = body;

    if (!txHash || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: txHash, status' },
        { status: 400 }
      );
    }

    if (!['pending', 'confirmed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "pending" or "confirmed"' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const transaction = await Transaction.findOneAndUpdate(
      { txHash: txHash.toLowerCase() },
      { status },
      { new: true }
    );

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Transaction updated',
      transaction,
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}
