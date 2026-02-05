import mongoose from 'mongoose';

export interface IQuestionnaire {
  investmentAmount: string;
  riskTolerance: 'low' | 'medium' | 'high';
  investmentDuration: string;
  investmentGoal: 'preservation' | 'income' | 'growth' | 'aggressive';
  liquidityNeeds?: 'high' | 'medium' | 'low';
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  marketConditionView?: 'bullish' | 'neutral' | 'bearish';
  completedAt?: Date;
}

export interface IAgentPermission {
  pool: string;
  permissionType: 'WITHDRAW' | 'REBALANCE' | 'EMERGENCY_EXIT' | 'AUTO_COMPOUND' | 'STOP_LOSS';
  enabled: boolean;
  expiresAt: Date;
  maxAmount?: number;
  thresholdBps?: number;
  maxUses?: number;
  grantedAt: Date;
}

export interface IUser {
  _id?: string;
  walletAddress: string;
  username: string;
  role: 'verifier' | 'investor' | 'admin';
  nonce: string;
  isActive: boolean;
  circleWalletId?: string;
  circleWalletAddress?: string;
  questionnaire?: IQuestionnaire;
  agentPermissions?: IAgentPermission[];
  agentPermissionsUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new mongoose.Schema<IUser>({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  username: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['verifier', 'investor', 'admin'],
    default: 'verifier',
  },
  nonce: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  circleWalletId: {
    type: String,
    required: false,
  },
  circleWalletAddress: {
    type: String,
    required: false,
  },
  questionnaire: {
    type: {
      investmentAmount: String,
      riskTolerance: {
        type: String,
        enum: ['low', 'medium', 'high'],
      },
      investmentDuration: String,
      investmentGoal: {
        type: String,
        enum: ['preservation', 'income', 'growth', 'aggressive'],
      },
      liquidityNeeds: {
        type: String,
        enum: ['high', 'medium', 'low'],
      },
      experienceLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
      },
      marketConditionView: {
        type: String,
        enum: ['bullish', 'neutral', 'bearish'],
      },
      completedAt: Date,
    },
    required: false,
  },
  agentPermissions: [{
    pool: String,
    permissionType: {
      type: String,
      enum: ['WITHDRAW', 'REBALANCE', 'EMERGENCY_EXIT', 'AUTO_COMPOUND', 'STOP_LOSS'],
    },
    enabled: Boolean,
    expiresAt: Date,
    maxAmount: Number,
    thresholdBps: Number,
    maxUses: Number,
    grantedAt: Date,
  }],
  agentPermissionsUpdatedAt: {
    type: Date,
    required: false,
  },
}, {
  timestamps: true,
});

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;