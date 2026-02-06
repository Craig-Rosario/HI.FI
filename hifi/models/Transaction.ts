import mongoose from 'mongoose';

export interface ITransaction {
  _id?: string;
  userAddress: string;
  poolId: string;
  poolName: string;
  type: 'deposit' | 'withdrawal';
  chain: 'ETH' | 'BASE';
  amount: string; // Amount in USDC (stored as string for precision)
  txHash: string;
  status: 'pending' | 'confirmed';
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new mongoose.Schema<ITransaction>({
  userAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
  },
  poolId: {
    type: String,
    required: true,
  },
  poolName: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal'],
    required: true,
  },
  chain: {
    type: String,
    enum: ['ETH', 'BASE'],
    required: true,
  },
  amount: {
    type: String,
    required: true,
  },
  txHash: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

// Compound index for efficient user transaction queries
TransactionSchema.index({ userAddress: 1, createdAt: -1 });
TransactionSchema.index({ txHash: 1 }, { unique: true });

const Transaction = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);

export default Transaction;
