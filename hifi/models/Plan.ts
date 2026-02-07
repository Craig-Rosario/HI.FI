import mongoose from 'mongoose';

export type PlanStatus = 'DRAFT' | 'APPROVED' | 'EXECUTING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type ExecutionMode = 'metamask' | 'circle';
export type RiskLevel = 'easy' | 'medium' | 'hard';

export interface IPoolAllocation {
  poolId: string;
  poolName: string;
  riskLevel: RiskLevel;
  percentage: number;
  amount: number; // USDC amount
  lockupPeriod: string;
  yieldSource: 'protocol' | 'subsidized';
  txHash?: string;
  depositedAt?: Date;
}

export interface IPlan {
  _id?: string;
  userId: string;
  walletAddress: string;
  totalAmount: number; // Total USDC to invest
  riskPreference: RiskLevel;
  lockupComfort: string; // e.g., "short", "medium", "long"
  executionMode: ExecutionMode;
  status: PlanStatus;
  allocations: IPoolAllocation[];
  summary: string; // AI-generated summary
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  executionStartedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  executionProgress?: {
    currentStep: number;
    totalSteps: number;
    currentPoolName?: string;
    message?: string;
  };
}

const PoolAllocationSchema = new mongoose.Schema({
  poolId: {
    type: String,
    required: true,
  },
  poolName: {
    type: String,
    required: true,
  },
  riskLevel: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true,
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  lockupPeriod: {
    type: String,
    required: true,
  },
  yieldSource: {
    type: String,
    enum: ['protocol', 'subsidized'],
    default: 'protocol',
  },
  txHash: {
    type: String,
  },
  depositedAt: {
    type: Date,
  },
});

const PlanSchema = new mongoose.Schema<IPlan>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  walletAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  riskPreference: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true,
  },
  lockupComfort: {
    type: String,
    required: true,
  },
  executionMode: {
    type: String,
    enum: ['metamask', 'circle'],
    required: true,
  },
  status: {
    type: String,
    enum: ['DRAFT', 'APPROVED', 'EXECUTING', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT',
    required: true,
  },
  allocations: {
    type: [PoolAllocationSchema],
    required: true,
  },
  summary: {
    type: String,
    required: true,
  },
  approvedAt: {
    type: Date,
  },
  executionStartedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  cancelledAt: {
    type: Date,
  },
  executionProgress: {
    currentStep: Number,
    totalSteps: Number,
    currentPoolName: String,
    message: String,
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
PlanSchema.index({ userId: 1, status: 1 });
PlanSchema.index({ walletAddress: 1, status: 1 });
PlanSchema.index({ createdAt: -1 });

const Plan = mongoose.models.Plan || mongoose.model<IPlan>('Plan', PlanSchema);

export default Plan;
