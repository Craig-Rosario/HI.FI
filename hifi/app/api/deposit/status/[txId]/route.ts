import { NextRequest, NextResponse } from 'next/server';
import { deposits } from '@/lib/deposit-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ txId: string }> }
) {
  try {
    const { txId } = await params;
    
    if (!txId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Get deposit from in-memory storage (in production, use database)
    const deposit = deposits.get(txId);
    
    if (!deposit) {
      return NextResponse.json(
        { error: 'Deposit not found' },
        { status: 404 }
      );
    }

    // Return deposit status
    return NextResponse.json({
      success: true,
      status: {
        txId: deposit.txId,
        status: deposit.status,
        sourceChain: deposit.sourceChain,
        amount: deposit.amount,
        gatewayTx: deposit.gatewayTx,
        vaultTx: deposit.vaultTx,
        error: deposit.error
      }
    });

  } catch (error) {
    console.error('Deposit status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}