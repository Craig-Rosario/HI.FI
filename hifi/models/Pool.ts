import mongoose from 'mongoose';

export interface IPool {
  _id: string;
  name: string;
  description: string;
  state: 'COLLECTING' | 'DEPLOYED' | 'WITHDRAW_WINDOW' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
  tvl: string; // Total Value Locked (stored as string to handle decimals)
  cap: string; // Pool capacity/threshold (stored as string)
  apy: string; // Annual Percentage Yield (stored as string for precision)
  waitTime: number; // Wait time in seconds
  minDeposit: number; // Minimum deposit amount in USDC
  contractAddress: string; // Smart contract address for this pool
  chainId: number; // Chain ID where the pool is deployed
  riskLevel: 'low' | 'medium' | 'high'; // Risk level of the pool
  adapterType: 'aave' | 'simulated' | 'compound' | 'other'; // Type of yield adapter
  // On-chain enriched fields (from API, not stored in DB)
  withdrawOpen?: boolean; // Is withdraw available now?
  withdrawTimeLeft?: number; // Seconds until withdraw opens
  createdAt: Date;
  updatedAt: Date;
}

const PoolSchema = new mongoose.Schema<IPool>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  state: {
    type: String,
    enum: ['COLLECTING', 'DEPLOYED', 'WITHDRAW_WINDOW', 'ACTIVE', 'PAUSED', 'CLOSED'],
    default: 'COLLECTING',
    required: true,
  },
  tvl: {
    type: String,
    required: true,
    default: '0',
  },
  cap: {
    type: String,
    required: true,
  },
  apy: {
    type: String,
    required: true,
    default: '0',
  },
  waitTime: {
    type: Number,
    required: true,
    default: 420, // 7 minutes default
  },
  minDeposit: {
    type: Number,
    required: true,
    default: 100, // 100 USDC default minimum
  },
  contractAddress: {
    type: String,
    required: true,
    lowercase: true,
  },
  chainId: {
    type: Number,
    required: true,
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low',
    required: true,
  },
  adapterType: {
    type: String,
    enum: ['aave', 'simulated', 'compound', 'other'],
    default: 'aave',
    required: true,
  },
}, {
  timestamps: true,
});

// Index for efficient querying
PoolSchema.index({ state: 1 });
PoolSchema.index({ contractAddress: 1, chainId: 1 }, { unique: true });

const Pool = mongoose.models.Pool || mongoose.model<IPool>('Pool', PoolSchema);

export default Pool;
