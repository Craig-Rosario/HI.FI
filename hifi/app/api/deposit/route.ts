import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { deposits } from '@/lib/deposit-store';

interface DepositRequest {
  amount: string; // USDC amount in wei
  sourceChain: string; // e.g., "ethereum", "base"
  destinationChain: string; // Always "sepolia" for our use case
  userAddress: string; // User's wallet address
}

// Generate unique transaction ID
function generateTxId(): string {
  return `hifi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: DepositRequest = await request.json();
    
    // Validate request
    if (!body.amount || !body.sourceChain || !body.userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, sourceChain, userAddress' },
        { status: 400 }
      );
    }

    // Validate amount
    try {
      const amountBigInt = BigInt(body.amount);
      if (amountBigInt <= 0) {
        throw new Error('Amount must be positive');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid amount format' },
        { status: 400 }
      );
    }

    // Validate source chain
    const supportedChains = ['ethereum', 'base'];
    if (!supportedChains.includes(body.sourceChain.toLowerCase())) {
      return NextResponse.json(
        { error: `Unsupported source chain: ${body.sourceChain}` },
        { status: 400 }
      );
    }

    // Validate Ethereum address
    if (!ethers.isAddress(body.userAddress)) {
      return NextResponse.json(
        { error: 'Invalid user address' },
        { status: 400 }
      );
    }

    // Generate transaction ID
    const txId = generateTxId();

    // Store deposit record
    deposits.set(txId, {
      txId,
      status: 'pending',
      sourceChain: body.sourceChain.toLowerCase(),
      destinationChain: 'sepolia',
      amount: body.amount,
      userAddress: body.userAddress,
      createdAt: Date.now()
    });

    // Here we would integrate with Circle Gateway
    // For now, we'll simulate the process
    console.log(`Initiating deposit ${txId}:`, {
      amount: ethers.formatUnits(body.amount, 6),
      from: body.sourceChain,
      to: 'sepolia',
      user: body.userAddress
    });

    // Simulate Gateway call (replace with real Circle Gateway integration)
    simulateGatewayDeposit(txId, body);

    return NextResponse.json({
      success: true,
      txId,
      message: 'Deposit initiated successfully',
      estimatedTime: '5-10 minutes' // Typical Gateway settlement time
    });

  } catch (error) {
    console.error('Deposit API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Simulate Gateway deposit process (replace with real Circle Gateway integration)
async function simulateGatewayDeposit(txId: string, depositRequest: DepositRequest) {
  // This simulates the Circle Gateway cross-chain USDC transfer
  // In production, integrate with actual Circle Gateway API
  
  console.log(`[Gateway] Starting cross-chain transfer for ${txId}`);
  console.log(`[Gateway] Amount: ${ethers.formatUnits(depositRequest.amount, 6)} USDC`);
  console.log(`[Gateway] From: ${depositRequest.sourceChain} → To: ${depositRequest.destinationChain}`);
  
  setTimeout(async () => {
    try {
      const deposit = deposits.get(txId);
      if (!deposit) return;

      // Step 1: Gateway burns USDC on source chain and mints on destination
      console.log(`[Gateway] Processing cross-chain attestation...`);
      
      // Simulate Gateway success after 15 seconds (typical Gateway time)
      setTimeout(async () => {
        const currentDeposit = deposits.get(txId);
        if (!currentDeposit) return;

        // Update status to gateway complete
        const gatewayTx = `0x${Math.random().toString(16).substr(2, 64)}`;
        deposits.set(txId, {
          ...currentDeposit,
          status: 'gateway_complete',
          gatewayTx
        });

        console.log(`[Gateway] ✅ Cross-chain transfer complete! Tx: ${gatewayTx}`);
        console.log(`[Gateway] arcUSDC now available on ${depositRequest.destinationChain}`);
        console.log(`[PoolVault] Initiating deposit to contract...`);

        // Step 2: Call PoolVault.deposit() with the bridged arcUSDC
        try {
          await callPoolVaultDeposit(txId, depositRequest, gatewayTx);
        } catch (error) {
          console.error(`[PoolVault] Deposit failed for ${txId}:`, error);
          deposits.set(txId, {
            ...currentDeposit,
            status: 'failed',
            error: error instanceof Error ? error.message : 'PoolVault deposit failed'
          });
        }
      }, 15000); // 15 seconds for Gateway processing

    } catch (error) {
      console.error(`[Gateway] Transfer failed for ${txId}:`, error);
      const currentDeposit = deposits.get(txId);
      if (currentDeposit) {
        deposits.set(txId, {
          ...currentDeposit,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Gateway processing failed'
        });
      }
    }
  }, 2000); // Start after 2 seconds
}

// Call PoolVault deposit (backend handles this with proper key management)
async function callPoolVaultDeposit(txId: string, depositRequest: DepositRequest, gatewayTx: string) {
  // In production, backend wallet calls: PoolVault.deposit(arcUSDC_amount)
  // The arcUSDC was already minted to the vault by Circle Gateway
  
  console.log(`[PoolVault] Calling deposit() for ${ethers.formatUnits(depositRequest.amount, 6)} arcUSDC`);
  console.log(`[PoolVault] User: ${depositRequest.userAddress}`);
  
  // Simulate contract call (5 seconds for blockchain confirmation)
  setTimeout(() => {
    const deposit = deposits.get(txId);
    if (!deposit) return;

    const vaultTx = `0x${Math.random().toString(16).substr(2, 64)}`;
    deposits.set(txId, {
      ...deposit,
      status: 'vault_complete',
      vaultTx
    });

    console.log(`[PoolVault] ✅ Deposit successful! Tx: ${vaultTx}`);
    console.log(`[PoolVault] User ${depositRequest.userAddress} received shares`);
  }, 5000);
}

