/**
 * API Route: Update Risk Profile
 * POST /api/profile/update
 * 
 * Updates user's risk profile parameters
 */

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { validateUserProfile } from '@/lib/recommendations/engine';

export async function POST(request: NextRequest) {
    try {
        const { userId, riskProfile } = await request.json();

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'User ID is required' },
                { status: 400 }
            );
        }

        if (!riskProfile) {
            return NextResponse.json(
                { success: false, error: 'Risk profile data is required' },
                { status: 400 }
            );
        }

        // Validate profile
        const validation = validateUserProfile(riskProfile);
        if (!validation.isValid) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Incomplete risk profile',
                    missingFields: validation.missingFields
                },
                { status: 400 }
            );
        }

        // Connect to database
        await connectToDatabase();

        // Update user
        const user = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    riskProfile: {
                        ...riskProfile,
                        completionStatus: 'complete',
                        lastUpdated: new Date()
                    }
                }
            },
            { new: true }
        );

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Risk profile updated successfully',
            profile: user.riskProfile
        });

    } catch (error) {
        console.error('Update profile error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to update risk profile. Please try again.',
                details: process.env.NODE_ENV === 'development' ? String(error) : undefined
            },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'User ID is required' },
                { status: 400 }
            );
        }

        // Connect to database
        await connectToDatabase();

        // Fetch user
        const user = await User.findById(userId);
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            profile: user.riskProfile || null,
            completionStatus: user.riskProfile?.completionStatus || 'incomplete'
        });

    } catch (error) {
        console.error('Get profile error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch risk profile. Please try again.'
            },
            { status: 500 }
        );
    }
}
