import type { NextApiRequest, NextApiResponse } from 'next'

interface DepositInfo {
  userAddress: string;
  txHash: string | null;
  amount: string | null;
  sourceChain: string;
  destinationChain: string;
  poolAddress?: string;
  burnIntent?: string;
  signature?: string;
  status: string;
  createdAt: number;
}

// In-memory storage for pending deposits (MVP - no database)
const pendingDeposits = new Map<string, DepositInfo>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userAddress, burnIntent, signature, txHash, amount, sourceChain, destinationChain, poolAddress } = req.body;

  if (!userAddress) {
    return res.status(400).json({ error: 'Missing userAddress' });
  }

  try {
    // Generate unique ID for this deposit
    const depositId = `${userAddress}-${Date.now()}`;
    
    // Store pending deposit
    pendingDeposits.set(depositId, {
      userAddress,
      txHash: txHash || null,
      amount: amount || null,
      sourceChain: sourceChain || 'Unknown',
      destinationChain: destinationChain || 'Arc',
      poolAddress,
      burnIntent,
      signature,
      status: 'pending',
      createdAt: Date.now()
    });

    // Return immediately (Gateway call happens in background)
    return res.json({
      success: true,
      depositId,
      message: 'Deposit initiated. You will receive shares in ~2 minutes.'
    });
  } catch (error) {
    console.error('Deposit initiation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: errorMessage });
  }
}

// Cleanup old deposits (>1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [id, deposit] of pendingDeposits.entries()) {
    if (deposit.createdAt < oneHourAgo) {
      pendingDeposits.delete(id);
    }
  }
}, 300000); // Every 5 minutes
