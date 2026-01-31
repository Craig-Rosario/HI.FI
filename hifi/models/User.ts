import mongoose from 'mongoose';

export interface IUser {
  _id?: string;
  walletAddress: string;
  username: string;
  role: 'verifier' | 'investor' | 'admin';
  nonce: string;
  isActive: boolean;
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
}, {
  timestamps: true,
});

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;