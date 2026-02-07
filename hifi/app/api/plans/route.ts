import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Plan from '@/models/Plan';
import User from '@/models/User';

// GET - Fetch plans
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const walletAddress = searchParams.get('walletAddress');
    const status = searchParams.get('status');
    const planId = searchParams.get('planId');

    // If specific plan ID requested
    if (planId) {
      const plan = await Plan.findById(planId).lean();
      if (!plan) {
        return NextResponse.json(
          { error: 'Plan not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        plan: {
          ...plan,
          _id: (plan as any)._id.toString(),
        },
      });
    }

    // Build query
    const query: any = {};
    if (userId) query.userId = userId;
    if (walletAddress) query.walletAddress = walletAddress.toLowerCase();
    if (status) query.status = status;

    const plans = await Plan.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      success: true,
      plans: plans.map((p: any) => ({
        ...p,
        _id: p._id.toString(),
      })),
    });

  } catch (error) {
    console.error('Get plans error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}

// POST - Create new plan
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { userId, walletAddress, totalAmount, riskPreference, lockupComfort, executionMode, allocations, summary } = body;

    if (!userId || !walletAddress || !totalAmount || !allocations) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const plan = await Plan.create({
      userId,
      walletAddress: walletAddress.toLowerCase(),
      totalAmount,
      riskPreference,
      lockupComfort,
      executionMode,
      status: 'DRAFT',
      allocations,
      summary: summary || 'Custom investment plan',
    });

    return NextResponse.json({
      success: true,
      plan: {
        ...plan.toObject(),
        _id: plan._id.toString(),
      },
    });

  } catch (error) {
    console.error('Create plan error:', error);
    return NextResponse.json(
      { error: 'Failed to create plan' },
      { status: 500 }
    );
  }
}

// PUT - Update plan (approve, cancel, modify)
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { planId, action, updates } = body;

    if (!planId || !action) {
      return NextResponse.json(
        { error: 'planId and action are required' },
        { status: 400 }
      );
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // State machine validation
    const validTransitions: Record<string, string[]> = {
      'DRAFT': ['APPROVED', 'CANCELLED'],
      'APPROVED': ['EXECUTING', 'CANCELLED'],
      'EXECUTING': ['ACTIVE', 'CANCELLED'],
      'ACTIVE': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [],
      'CANCELLED': [],
    };

    switch (action) {
      case 'approve':
        if (!validTransitions[plan.status].includes('APPROVED')) {
          return NextResponse.json(
            { error: `Cannot approve plan with status ${plan.status}` },
            { status: 400 }
          );
        }
        plan.status = 'APPROVED';
        plan.approvedAt = new Date();
        break;

      case 'start_execution':
        if (!validTransitions[plan.status].includes('EXECUTING')) {
          return NextResponse.json(
            { error: `Cannot start execution for plan with status ${plan.status}` },
            { status: 400 }
          );
        }
        plan.status = 'EXECUTING';
        plan.executionStartedAt = new Date();
        plan.executionProgress = {
          currentStep: 0,
          totalSteps: plan.allocations.length,
          message: 'Starting execution...',
        };
        break;

      case 'update_progress':
        if (plan.status !== 'EXECUTING') {
          return NextResponse.json(
            { error: 'Can only update progress for executing plans' },
            { status: 400 }
          );
        }
        if (updates?.executionProgress) {
          plan.executionProgress = {
            ...plan.executionProgress,
            ...updates.executionProgress,
          };
        }
        if (updates?.allocation) {
          const allocIndex = plan.allocations.findIndex(
            (a: any) => a.poolId === updates.allocation.poolId
          );
          if (allocIndex >= 0) {
            plan.allocations[allocIndex].txHash = updates.allocation.txHash;
            plan.allocations[allocIndex].depositedAt = new Date();
          }
        }
        break;

      case 'complete':
        if (!validTransitions[plan.status].includes('ACTIVE')) {
          return NextResponse.json(
            { error: `Cannot complete plan with status ${plan.status}` },
            { status: 400 }
          );
        }
        plan.status = 'ACTIVE';
        plan.executionProgress = {
          currentStep: plan.allocations.length,
          totalSteps: plan.allocations.length,
          message: 'All allocations completed!',
        };
        break;

      case 'cancel':
        if (!validTransitions[plan.status].includes('CANCELLED')) {
          return NextResponse.json(
            { error: `Cannot cancel plan with status ${plan.status}` },
            { status: 400 }
          );
        }
        plan.status = 'CANCELLED';
        plan.cancelledAt = new Date();
        break;

      case 'modify':
        if (plan.status !== 'DRAFT') {
          return NextResponse.json(
            { error: 'Can only modify draft plans' },
            { status: 400 }
          );
        }
        if (updates) {
          if (updates.totalAmount) plan.totalAmount = updates.totalAmount;
          if (updates.riskPreference) plan.riskPreference = updates.riskPreference;
          if (updates.lockupComfort) plan.lockupComfort = updates.lockupComfort;
          if (updates.executionMode) plan.executionMode = updates.executionMode;
          if (updates.allocations) plan.allocations = updates.allocations;
          if (updates.summary) plan.summary = updates.summary;
        }
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    await plan.save();

    return NextResponse.json({
      success: true,
      plan: {
        ...plan.toObject(),
        _id: plan._id.toString(),
      },
    });

  } catch (error) {
    console.error('Update plan error:', error);
    return NextResponse.json(
      { error: 'Failed to update plan' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a draft plan
export async function DELETE(request: NextRequest) {
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

    const plan = await Plan.findById(planId);
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Only allow deleting DRAFT or CANCELLED plans
    if (!['DRAFT', 'CANCELLED'].includes(plan.status)) {
      return NextResponse.json(
        { error: 'Can only delete draft or cancelled plans' },
        { status: 400 }
      );
    }

    await Plan.deleteOne({ _id: planId });

    return NextResponse.json({
      success: true,
      message: 'Plan deleted',
    });

  } catch (error) {
    console.error('Delete plan error:', error);
    return NextResponse.json(
      { error: 'Failed to delete plan' },
      { status: 500 }
    );
  }
}
