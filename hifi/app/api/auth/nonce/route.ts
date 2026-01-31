import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { generateNonce, generateUsername } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (user) {
      user.nonce = generateNonce();
      await user.save();
    } else {
      user = new User({
        walletAddress: walletAddress.toLowerCase(),
        username: generateUsername(walletAddress),
        role: 'verifier',
        nonce: generateNonce(),
        isActive: true,
      });
      await user.save();
    }

    return NextResponse.json({
      message: `Welcome! Please sign this message to authenticate: ${user.nonce}`,
      nonce: user.nonce,
      isNewUser: !user.createdAt || user.createdAt === user.updatedAt,
    });

  } catch (error) {
    console.error('Auth nonce error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}