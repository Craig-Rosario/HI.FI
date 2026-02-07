import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Transaction from '@/models/Transaction';
import {
  executeContractCall,
  checkGasBalance,
  checkUSDCBalance,
  checkArcUSDCBalance,
} from '@/lib/circle-executor';

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const ARC_USDC_ADDRESS = process.env.NEXT_ARCUSDC_ADDRESS || process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS || '0xa2C75790AEC2d0cE701a34197E3c5947A83C5D4e';

/**
 * POST /api/circle-wallet/transfer
 * 
 * Transfer USDC from Circle wallet to MetaMask wallet.
 * If the Circle wallet holds arcUSDC, it will unwrap it to USDC first,
 * then transfer the USDC to the destination address.
 * 
 * Body: { userId: string, destinationAddress: string, amount?: number }
 * If amount is omitted, transfers the entire USDC + arcUSDC balance.
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { userId, destinationAddress, amount } = body;

    if (!userId || !destinationAddress) {
      return NextResponse.json(
        { success: false, error: 'userId and destinationAddress are required' },
        { status: 400 }
      );
    }

    // Validate destination address
    if (!/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid destination address' },
        { status: 400 }
      );
    }

    // Get user & circle wallet info
    const user = await User.findById(userId);
    if (!user || !user.circleWalletId || !user.circleWalletAddress) {
      return NextResponse.json(
        { success: false, error: 'User has no Circle wallet' },
        { status: 404 }
      );
    }

    const walletId = user.circleWalletId;
    const walletAddress = user.circleWalletAddress;

    console.log(`[Transfer] Starting transfer from Circle wallet ${walletAddress} to ${destinationAddress}`);

    // Check gas balance
    const gasCheck = await checkGasBalance(walletAddress);
    if (!gasCheck.hasGas) {
      return NextResponse.json(
        { success: false, error: `Insufficient ETH for gas. Balance: ${gasCheck.balance} ETH, Required: ${gasCheck.minRequired} ETH` },
        { status: 400 }
      );
    }

    // Check balances
    const usdcBalance = await checkUSDCBalance(walletAddress);
    const arcUsdcBalance = await checkArcUSDCBalance(walletAddress);

    console.log(`[Transfer] USDC balance: ${usdcBalance}, arcUSDC balance: ${arcUsdcBalance}`);

    const steps: Array<{ step: string; success: boolean; txHash?: string; error?: string }> = [];

    // Step 1: Unwrap arcUSDC to USDC if any arcUSDC balance exists
    if (arcUsdcBalance > 0) {
      console.log(`[Transfer] Unwrapping ${arcUsdcBalance} arcUSDC to USDC...`);

      const arcUsdcRaw = BigInt(Math.floor(arcUsdcBalance * 1e6)).toString();

      const unwrapResult = await executeContractCall(
        walletId,
        ARC_USDC_ADDRESS,
        'withdraw(uint256)',
        [arcUsdcRaw]
      );

      if (unwrapResult.success) {
        console.log(`[Transfer] ✅ Unwrap successful: ${unwrapResult.txHash}`);
        steps.push({ step: 'Unwrap arcUSDC → USDC', success: true, txHash: unwrapResult.txHash });
      } else {
        console.error(`[Transfer] ❌ Unwrap failed: ${unwrapResult.error}`);
        steps.push({ step: 'Unwrap arcUSDC → USDC', success: false, error: unwrapResult.error });
        // Continue anyway — we can still transfer existing USDC balance
      }
    }

    // Re-check USDC balance after potential unwrap
    const finalUsdcBalance = await checkUSDCBalance(walletAddress);
    console.log(`[Transfer] Final USDC balance after unwrap: ${finalUsdcBalance}`);

    if (finalUsdcBalance <= 0) {
      return NextResponse.json({
        success: false,
        error: 'No USDC available to transfer',
        steps,
      }, { status: 400 });
    }

    // Determine transfer amount
    const transferAmount = amount && amount > 0
      ? Math.min(amount, finalUsdcBalance)
      : finalUsdcBalance;

    const transferAmountRaw = BigInt(Math.floor(transferAmount * 1e6)).toString();

    console.log(`[Transfer] Transferring ${transferAmount} USDC to ${destinationAddress}...`);

    // Step 2: Transfer USDC to destination
    const transferResult = await executeContractCall(
      walletId,
      USDC_ADDRESS,
      'transfer(address,uint256)',
      [destinationAddress, transferAmountRaw]
    );

    if (!transferResult.success) {
      console.error(`[Transfer] ❌ Transfer failed: ${transferResult.error}`);
      steps.push({ step: 'Transfer USDC', success: false, error: transferResult.error });
      return NextResponse.json({
        success: false,
        error: `USDC transfer failed: ${transferResult.error}`,
        steps,
      }, { status: 500 });
    }

    console.log(`[Transfer] ✅ Transfer successful: ${transferResult.txHash}`);
    steps.push({ step: 'Transfer USDC', success: true, txHash: transferResult.txHash });

    // Record transaction
    try {
      await Transaction.create({
        userAddress: walletAddress,
        type: 'withdraw',
        amount: transferAmount,
        token: 'USDC',
        txHash: transferResult.txHash,
        status: 'completed',
        poolName: 'Circle Wallet → MetaMask',
        poolAddress: destinationAddress,
        timestamp: new Date(),
      });
    } catch (txErr) {
      console.error('[Transfer] Failed to record transaction:', txErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully transferred ${transferAmount.toFixed(2)} USDC to ${destinationAddress}`,
      transferAmount,
      txHash: transferResult.txHash,
      steps,
    });

  } catch (error) {
    console.error('[Transfer] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
