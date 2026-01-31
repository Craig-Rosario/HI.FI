import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { verifySignature } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, signature, message } = await request.json();

    if (!walletAddress || !signature || !message) {
      return NextResponse.json(
        { error: 'Wallet address, signature, and message are required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please request a nonce first.' },
        { status: 404 }
      );
    }

    if (!message.includes(user.nonce)) {
      return NextResponse.json(
        { error: 'Invalid message. Please use the provided nonce.' },
        { status: 400 }
      );
    }

    const isValidSignature = verifySignature(message, signature, walletAddress);

    if (!isValidSignature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    user.updatedAt = new Date();
    await user.save();

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        walletAddress: user.walletAddress,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });

  } catch (error) {
    console.error('Auth verify error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}