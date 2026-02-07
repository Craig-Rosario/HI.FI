import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Pool from '@/models/Pool';
import Transaction from '@/models/Transaction';
import {
  executeContractCall,
  checkGasBalance,
} from '@/lib/circle-executor';

const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const ARC_USDC_ADDRESS = process.env.NEXT_ARCUSDC_ADDRESS || process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS || '0xa2C75790AEC2d0cE701a34197E3c5947A83C5D4e';

// Minimal ABI selectors for on-chain reads
const SHARES_SELECTOR = '0xce7c2ac2'; // shares(address)
const STATE_SELECTOR = '0xc19d93fb'; // state()
const IS_WITHDRAW_OPEN_SELECTOR = '0xff05121f'; // isWithdrawOpen()
const WITHDRAW_WINDOW_END_SELECTOR = '0x6a4234eb'; // withdrawWindowEnd()
const BALANCE_OF_SELECTOR = '0x70a08231'; // balanceOf(address)

/**
 * Read shares(address) on-chain via RPC
 */
async function readSharesOnChain(vaultAddress: string, userAddress: string): Promise<bigint> {
  const paddedAddress = userAddress.slice(2).padStart(64, '0');
  const data = SHARES_SELECTOR + paddedAddress;

  const response = await fetch(BASE_SEPOLIA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: vaultAddress, data }, 'latest'],
      id: 1,
    }),
  });

  const result = await response.json();
  return BigInt(result.result || '0x0');
}

/**
 * Read vault state() on-chain via RPC
 */
async function readVaultState(vaultAddress: string): Promise<number> {
  const response = await fetch(BASE_SEPOLIA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: vaultAddress, data: STATE_SELECTOR }, 'latest'],
      id: 1,
    }),
  });

  const result = await response.json();
  return Number(BigInt(result.result || '0x0'));
}

/**
 * Read isWithdrawOpen() on-chain via RPC
 * Returns true when vault is in DEPLOYED state AND withdraw delay has passed
 */
async function readIsWithdrawOpen(vaultAddress: string): Promise<boolean> {
  const response = await fetch(BASE_SEPOLIA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: vaultAddress, data: IS_WITHDRAW_OPEN_SELECTOR }, 'latest'],
      id: 1,
    }),
  });

  const result = await response.json();
  // isWithdrawOpen() returns bool — non-zero means true
  return BigInt(result.result || '0x0') !== BigInt(0);
}

/**
 * Read ERC20 balanceOf(address) on-chain via RPC
 */
async function readBalanceOf(tokenAddress: string, userAddress: string): Promise<bigint> {
  const paddedAddress = userAddress.slice(2).padStart(64, '0');
  const data = BALANCE_OF_SELECTOR + paddedAddress;

  const response = await fetch(BASE_SEPOLIA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: tokenAddress, data }, 'latest'],
      id: 1,
    }),
  });

  const result = await response.json();
  return BigInt(result.result || '0x0');
}

/**
 * POST - Execute withdrawal via Circle Developer-Controlled Wallet
 * 
 * This calls withdrawAll() on the pool vault contract using the Circle wallet
 * that owns the shares. Funds return to the Circle wallet address on-chain.
 * 
 * CRITICAL: 
 * - Only the address that deposited (Circle wallet) can withdraw its shares
 * - We verify shares exist on-chain before executing
 * - We verify gas balance before executing
 * - We wait for on-chain confirmation before returning success
 * - We return only real blockchain tx hashes
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { userId, poolId, poolContractAddress } = body;

    console.log('[Circle Withdraw API] Request:', { userId, poolId, poolContractAddress });

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get user with Circle wallet
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.circleWalletId || !user.circleWalletAddress) {
      return NextResponse.json(
        { error: 'User does not have a Circle wallet' },
        { status: 400 }
      );
    }

    const walletId = user.circleWalletId;
    const walletAddress = user.circleWalletAddress;

    // Determine vault contract address
    let vaultAddress = poolContractAddress;
    let poolName = 'Unknown Pool';

    if (poolId) {
      const pool = await Pool.findById(poolId);
      if (pool) {
        if (!vaultAddress) {
          vaultAddress = pool.contractAddress;
        }
        poolName = pool.name || 'Unknown Pool';
      }
    }

    if (!vaultAddress) {
      // Fall back to default pool vault address
      vaultAddress = process.env.NEXT_POOL_VAULT_ADDRESS || process.env.NEXT_PUBLIC_POOL_VAULT_ADDRESS;
    }

    if (!vaultAddress) {
      return NextResponse.json(
        { error: 'Pool vault contract address not found' },
        { status: 400 }
      );
    }

    console.log(`[Circle Withdraw API] Wallet: ${walletId} (${walletAddress})`);
    console.log(`[Circle Withdraw API] Vault: ${vaultAddress}`);

    // Step 1: Verify Circle wallet has shares on-chain
    const circleShares = await readSharesOnChain(vaultAddress, walletAddress);
    console.log(`[Circle Withdraw API] On-chain shares: ${circleShares.toString()}`);

    if (circleShares === BigInt(0)) {
      return NextResponse.json(
        {
          error: 'Circle wallet has no shares in this pool',
          circleWalletAddress: walletAddress,
          shares: '0',
        },
        { status: 400 }
      );
    }

    // Step 2: Verify withdraw window is open on-chain
    // V2 contracts: isWithdrawOpen() returns true when state == DEPLOYED && block.timestamp >= deployedAt + WITHDRAW_DELAY
    const isWithdrawOpen = await readIsWithdrawOpen(vaultAddress);
    if (!isWithdrawOpen) {
      const vaultState = await readVaultState(vaultAddress);
      const stateNames = ['COLLECTING', 'DEPLOYED', 'WITHDRAW_WINDOW'];
      const stateName = stateNames[vaultState] || 'UNKNOWN';
      
      let errorMsg = 'Withdraw window is not open.';
      if (vaultState === 0) {
        errorMsg += ' Pool is still collecting deposits.';
      } else if (vaultState === 1) {
        errorMsg += ' Funds are deployed but the withdraw delay has not passed yet. Please wait ~1 minute after deployment.';
      }
      
      return NextResponse.json(
        {
          error: errorMsg,
          currentState: vaultState,
          stateName,
        },
        { status: 400 }
      );
    }

    // Step 4: Check gas balance
    const gasCheck = await checkGasBalance(walletAddress);
    if (!gasCheck.hasGas) {
      return NextResponse.json(
        {
          error: `Insufficient ETH for gas. Circle wallet needs at least ${gasCheck.minRequired} ETH.`,
          currentGasBalance: gasCheck.balance,
          minRequired: gasCheck.minRequired,
          circleWalletAddress: walletAddress,
          action: 'Please send some ETH (Base Sepolia) to your Circle wallet to cover gas fees.',
        },
        { status: 400 }
      );
    }

    console.log(`[Circle Withdraw API] All pre-checks passed. Executing withdraw(${circleShares.toString()})...`);

    // Step 5: Call withdraw(shareAmount) via Circle
    // IMPORTANT: Do NOT call withdrawAll() — it uses this.withdraw() which changes msg.sender
    // to the contract itself, causing the transaction to revert. Instead call withdraw(shares) directly.
    const result = await executeContractCall(
      walletId,
      vaultAddress,
      'withdraw(uint256)',
      [circleShares.toString()],
      true // wait for confirmation
    );

    if (!result.success) {
      console.error(`[Circle Withdraw API] withdrawAll() failed:`, result.error);
      return NextResponse.json(
        {
          error: result.error || 'Withdrawal transaction failed',
          transactionId: result.transactionId,
          state: result.state,
        },
        { status: 500 }
      );
    }

    // CRITICAL: Validate we have a REAL txHash
    if (!result.txHash || !result.txHash.startsWith('0x')) {
      console.error('[Circle Withdraw API] ❌ No valid txHash!');
      return NextResponse.json(
        {
          error: 'Withdrawal submitted but no valid blockchain hash received. Check BaseScan manually.',
          transactionId: result.transactionId,
        },
        { status: 500 }
      );
    }

    console.log(`[Circle Withdraw API] ✅ Withdrawal confirmed: ${result.txHash}`);

    // Step 6: Unwrap arcUSDC → USDC
    // The vault sends arcUSDC to the Circle wallet. We need to unwrap it to USDC
    // so the user sees real USDC in their wallet (same as MetaMask flow).
    let unwrapTxHash: string | undefined;
    try {
      // Small delay to let the withdrawal tx settle
      await new Promise(resolve => setTimeout(resolve, 3000));

      const arcUsdcBalance = await readBalanceOf(ARC_USDC_ADDRESS, walletAddress);
      console.log(`[Circle Withdraw API] Circle wallet arcUSDC balance: ${arcUsdcBalance.toString()}`);

      if (arcUsdcBalance > BigInt(0)) {
        console.log(`[Circle Withdraw API] Unwrapping ${arcUsdcBalance.toString()} arcUSDC → USDC...`);

        const unwrapResult = await executeContractCall(
          walletId,
          ARC_USDC_ADDRESS,
          'withdraw(uint256)',
          [arcUsdcBalance.toString()],
          true
        );

        if (unwrapResult.success && unwrapResult.txHash) {
          unwrapTxHash = unwrapResult.txHash;
          console.log(`[Circle Withdraw API] ✅ arcUSDC unwrapped to USDC: ${unwrapResult.txHash}`);
        } else {
          console.warn(`[Circle Withdraw API] ⚠️ arcUSDC unwrap failed:`, unwrapResult.error);
          // Don't fail the whole withdrawal — user still has arcUSDC
        }
      }
    } catch (unwrapErr) {
      console.warn('[Circle Withdraw API] ⚠️ arcUSDC unwrap step failed:', unwrapErr);
      // Don't fail the whole withdrawal — user still has arcUSDC
    }

    // Step 7: Record the withdrawal transaction
    if (poolId) {
      try {
        const sharesFormatted = Number(circleShares) / 1e6;
        await Transaction.create({
          userAddress: walletAddress,
          poolId,
          poolName,
          type: 'withdrawal',
          chain: 'BASE',
          amount: sharesFormatted.toString(),
          txHash: result.txHash,
          status: 'confirmed',
        });
        console.log(`[Circle Withdraw API] Transaction recorded`);
      } catch (txErr) {
        console.warn('[Circle Withdraw API] Failed to record transaction:', txErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully withdrew and converted to USDC in your Circle wallet`,
      txHash: result.txHash,
      unwrapTxHash,
      circleWalletAddress: walletAddress,
      sharesWithdrawn: circleShares.toString(),
    });
  } catch (error) {
    console.error('[Circle Withdraw API] Error:', error);
    return NextResponse.json(
      {
        error: 'Withdrawal failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
