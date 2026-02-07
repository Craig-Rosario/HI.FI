import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Plan from '@/models/Plan';
import Pool from '@/models/Pool';
import User from '@/models/User';
import { 
  executeInvestmentPlanV2, 
  checkUSDCBalance, 
  checkGasBalance,
  getUserCircleWallet 
} from '@/lib/circle-executor';

interface ExecutionResult {
  success: boolean;
  poolName: string;
  amount: number;
  txHash?: string;
  transactionId?: string;
  error?: string;
  steps?: Array<{ step: string; success: boolean; txHash?: string; error?: string }>;
}

// Execute plan using Circle wallets (AI-managed mode)
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { planId, userId } = body;

    if (!planId || !userId) {
      return NextResponse.json(
        { error: 'planId and userId are required' },
        { status: 400 }
      );
    }

    // Get the plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Verify plan status
    if (plan.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Plan must be approved before execution' },
        { status: 400 }
      );
    }

    // Verify execution mode
    if (plan.executionMode !== 'circle') {
      return NextResponse.json(
        { error: 'This endpoint is for Circle wallet execution only. Use MetaMask for manual execution.' },
        { status: 400 }
      );
    }

    // Get user with Circle wallet
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.circleWalletId || !user.circleWalletAddress) {
      return NextResponse.json(
        { error: 'User does not have a Circle wallet. Please set up Circle wallet first.' },
        { status: 400 }
      );
    }

    // Check gas balance first (ETH for transaction fees)
    console.log('[Execute Plan] Checking gas balance...');
    const gasCheck = await checkGasBalance(user.circleWalletAddress);
    
    if (!gasCheck.hasGas) {
      return NextResponse.json({
        error: `Insufficient ETH for gas fees. Circle wallet needs at least ${gasCheck.minRequired} ETH for transaction fees.`,
        gasRequired: gasCheck.minRequired,
        currentGasBalance: gasCheck.balance,
        circleWalletAddress: user.circleWalletAddress,
        action: 'Please send some ETH (Base Sepolia) to your Circle wallet to cover gas fees.',
      }, { status: 400 });
    }
    
    console.log(`[Execute Plan] Gas check passed: ${gasCheck.balance} ETH`);

    // Check USDC balance on-chain (more reliable than Circle API)
    console.log('[Execute Plan] Checking USDC balance...');
    const currentBalance = await checkUSDCBalance(user.circleWalletAddress);
    console.log(`[Execute Plan] USDC balance: ${currentBalance}, Required: ${plan.totalAmount}`);

    if (currentBalance < plan.totalAmount) {
      return NextResponse.json({
        error: `Insufficient USDC in Circle wallet. Required: ${plan.totalAmount} USDC, Available: ${currentBalance} USDC`,
        circleWalletAddress: user.circleWalletAddress,
        requiredAmount: plan.totalAmount,
        currentBalance,
      }, { status: 400 });
    }

    // Update plan status to EXECUTING
    plan.status = 'EXECUTING';
    plan.executionStartedAt = new Date();
    plan.executionProgress = {
      currentStep: 0,
      totalSteps: plan.allocations.length * 4, // approve USDC + wrap + approve arcUSDC + deposit for each
      message: 'Starting AI-managed execution via Circle wallets...',
    };
    await plan.save();

    // Get pool contract addresses
    // Note: Plan uses 'easy'/'medium'/'hard', Pool uses 'low'/'medium'/'high'
    const pools = await Pool.find({}).lean();
    const poolMap: Record<string, any> = {};
    
    // Map plan risk levels to pool risk levels
    // Also sort by minDeposit to get the most accessible pools (0.1 USDC ones)
    const lowRiskPools = pools.filter((p: any) => p.riskLevel === 'low').sort((a: any, b: any) => a.minDeposit - b.minDeposit);
    const medRiskPools = pools.filter((p: any) => p.riskLevel === 'medium').sort((a: any, b: any) => a.minDeposit - b.minDeposit);
    const highRiskPools = pools.filter((p: any) => p.riskLevel === 'high').sort((a: any, b: any) => a.minDeposit - b.minDeposit);
    
    if (lowRiskPools.length > 0) poolMap['easy'] = lowRiskPools[0];
    if (medRiskPools.length > 0) poolMap['medium'] = medRiskPools[0];
    if (highRiskPools.length > 0) poolMap['hard'] = highRiskPools[0];
    
    console.log('[Execute Plan] Pool mapping:', {
      easy: poolMap['easy']?.name + ' @ ' + poolMap['easy']?.contractAddress,
      medium: poolMap['medium']?.name + ' @ ' + poolMap['medium']?.contractAddress,
      hard: poolMap['hard']?.name + ' @ ' + poolMap['hard']?.contractAddress,
    });

    // Prepare allocations with contract addresses
    const allocationsWithAddresses = plan.allocations.map((alloc: any) => {
      const pool = poolMap[alloc.riskLevel];
      console.log(`[Execute Plan] Allocation: ${alloc.poolName} (${alloc.riskLevel}) -> Pool: ${pool?.name} @ ${pool?.contractAddress}`);
      return {
        poolId: alloc.poolId || pool?._id?.toString(),
        poolName: alloc.poolName,
        amount: alloc.amount,
        poolContractAddress: pool?.contractAddress,
      };
    });
    
    // Validate all allocations have contract addresses
    const missingAddresses = allocationsWithAddresses.filter((a: { poolContractAddress?: string }) => !a.poolContractAddress);
    if (missingAddresses.length > 0) {
      plan.status = 'APPROVED'; // Revert to approved
      await plan.save();
      return NextResponse.json({
        error: `Missing contract addresses for: ${missingAddresses.map((a: { poolName: string }) => a.poolName).join(', ')}`,
      }, { status: 400 });
    }
    
    console.log('[Execute Plan] Final allocations:', JSON.stringify(allocationsWithAddresses, null, 2));

    // Execute the investment plan using the new Circle executor with confirmation waiting
    console.log('[Execute Plan] Starting execution with Circle executor V2...');
    const executionResult = await executeInvestmentPlanV2(
      userId,
      allocationsWithAddresses,
      async (allocation, total, step, message) => {
        // Update progress in database
        const currentStep = (allocation - 1) * 4 + ['checking_gas', 'checking_balance', 'approving_usdc', 'wrapping_arcusdc', 'approving_arcusdc', 'depositing_vault'].indexOf(step) + 1;
        plan.executionProgress = {
          currentStep: Math.min(currentStep, total * 4),
          totalSteps: total * 4,
          message,
        };
        await plan.save();
      }
    );

    // Process results
    const results: ExecutionResult[] = [];
    
    for (let i = 0; i < executionResult.results.length; i++) {
      const execResult = executionResult.results[i];
      const allocation = plan.allocations[i];

      // Find the deposit step's txHash - MUST be a real blockchain hash
      const depositStep = execResult.steps.find(s => s.step === 'deposit_pool');
      const txHash = depositStep?.txHash;
      
      // CRITICAL: Only mark as success if we have a REAL txHash
      const hasValidTxHash = txHash && txHash.startsWith('0x');

      if (execResult.success && hasValidTxHash) {
        // Update allocation with transaction details
        if (allocation) {
          plan.allocations[i].txHash = txHash;
          plan.allocations[i].depositedAt = new Date();
        }

        results.push({
          success: true,
          poolName: execResult.poolName,
          amount: execResult.amount,
          txHash,
          steps: execResult.steps,
        });
      } else {
        // FAIL if no valid txHash, even if executor said success
        const errorReason = !hasValidTxHash && execResult.success 
          ? 'Transaction submitted but no valid blockchain hash received'
          : (execResult.error || 'Execution failed');
          
        results.push({
          success: false,
          poolName: execResult.poolName,
          amount: execResult.amount,
          error: errorReason,
          steps: execResult.steps,
        });
      }
    }

    // Update plan status based on results
    const allSucceeded = results.every(r => r.success);
    
    if (allSucceeded) {
      plan.status = 'ACTIVE';
      plan.executionProgress = {
        currentStep: plan.allocations.length * 2,
        totalSteps: plan.allocations.length * 2,
        message: 'All allocations completed successfully! Your funds are now earning yield.',
      };
    } else {
      // Partial failure - keep as EXECUTING with error message
      const failedCount = results.filter(r => !r.success).length;
      plan.executionProgress = {
        ...plan.executionProgress,
        message: `Execution partially complete. ${failedCount} allocation(s) failed.`,
      };
      
      // If all failed, cancel the plan
      if (results.every(r => !r.success)) {
        plan.status = 'CANCELLED';
        plan.cancelledAt = new Date();
        plan.executionProgress.message = 'Execution failed. All allocations encountered errors.';
      }
    }
    
    await plan.save();

    return NextResponse.json({
      success: allSucceeded,
      plan: {
        ...plan.toObject(),
        _id: plan._id.toString(),
      },
      results,
      circleWallet: {
        address: user.circleWalletAddress,
        balanceBefore: currentBalance,
      },
      message: allSucceeded 
        ? '✅ Plan executed successfully via Circle wallets! Your funds have been allocated to the pools.'
        : `⚠️ Execution encountered issues. ${results.filter(r => r.success).length}/${results.length} allocations completed.`,
    });

  } catch (error) {
    console.error('Execute plan error:', error);
    return NextResponse.json(
      { error: 'Failed to execute plan', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET execution status
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    const plan = await Plan.findById(planId).lean();
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      status: (plan as any).status,
      progress: (plan as any).executionProgress,
      allocations: (plan as any).allocations.map((a: any) => ({
        poolName: a.poolName,
        amount: a.amount,
        txHash: a.txHash,
        depositedAt: a.depositedAt,
        completed: !!a.txHash,
      })),
    });

  } catch (error) {
    console.error('Get execution status error:', error);
    return NextResponse.json(
      { error: 'Failed to get execution status' },
      { status: 500 }
    );
  }
}
