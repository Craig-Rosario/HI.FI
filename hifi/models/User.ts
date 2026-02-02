import mongoose from 'mongoose';

export interface IUser {
  _id?: string;
  walletAddress: string;
  username: string;
  role: 'verifier' | 'investor' | 'admin';
  nonce: string;
  isActive: boolean;
  circleWalletId?: string;
  circleWalletAddress?: string;

  // Risk Profile Fields
  riskProfile?: {
    ageRange?: 'under-25' | '25-40' | '41-55' | '56-70' | 'over-70';
    incomeRange?: 'under-30k' | '30k-75k' | '75k-150k' | '150k-300k' | 'over-300k';
    investmentHorizon?: '1-month' | '3-months' | '6-months' | '1-year' | '2-years+';
    riskTolerance?: 'conservative' | 'moderate' | 'balanced' | 'growth' | 'aggressive';
    liquidityNeeds?: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
    investmentGoals?: ('capital-preservation' | 'income' | 'growth' | 'speculation')[];
    previousDeFiExperience?: 'none' | 'beginner' | 'intermediate' | 'advanced';
    completionStatus?: 'incomplete' | 'complete';
    lastUpdated?: Date;
  };

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
  riskProfile: {
    type: {
      ageRange: {
        type: String,
        enum: ['under-25', '25-40', '41-55', '56-70', 'over-70'],
      },
      incomeRange: {
        type: String,
        enum: ['under-30k', '30k-75k', '75k-150k', '150k-300k', 'over-300k'],
      },
      investmentHorizon: {
        type: String,
        enum: ['1-month', '3-months', '6-months', '1-year', '2-years+'],
      },
      riskTolerance: {
        type: String,
        enum: ['conservative', 'moderate', 'balanced', 'growth', 'aggressive'],
      },
      liquidityNeeds: {
        type: String,
        enum: ['immediate', 'short-term', 'medium-term', 'long-term'],
      },
      investmentGoals: [{
        type: String,
        enum: ['capital-preservation', 'income', 'growth', 'speculation'],
      }],
      previousDeFiExperience: {
        type: String,
        enum: ['none', 'beginner', 'intermediate', 'advanced'],
      },
      completionStatus: {
        type: String,
        enum: ['incomplete', 'complete'],
        default: 'incomplete',
      },
      lastUpdated: Date,
    },
    required: false,
  },
}, {
  timestamps: true,
});

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;