import type { NextApiRequest, NextApiResponse } from 'next'

interface DepositInfo {
  userAddress: string;
  txHash: string;
  amount: string;
  status: string;
  poolAddress?: string;
  sourceChain?: string;
  destinationChain?: string;
}

// Lookup user address by transaction hash
// Share the same Map instance with initiate.ts
const pendingDeposits = new Map<string, DepositInfo>();

// Export function to sync with initiate.ts
export function getPendingDeposits() {
  return pendingDeposits;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tx } = req.query;

  if (!tx) {
    return res.status(400).json({ error: 'Missing tx hash' });
  }

  try {
    // Find deposit by tx hash
    for (const [id, deposit] of pendingDeposits.entries()) {
      if (deposit.txHash === tx) {
        return res.json({
          userAddress: deposit.userAddress,
          depositId: id,
          amount: deposit.amount,
          status: deposit.status
        });
      }
    }

    return res.json({ userAddress: null });
  } catch (error) {
    console.error('Lookup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: errorMessage });
  }
}
