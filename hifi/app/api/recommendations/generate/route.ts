/**
 * API Route: Generate Recommendations
 * POST /api/recommendations/generate
 * 
 * Generates personalized pool recommendations based on user's risk profile
 */

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { generateRecommendations, userDocumentToProfile } from '@/lib/recommendations/engine';
import { fetchPoolData } from '@/lib/recommendations/poolData';

export async function POST(request: NextRequest) {
    try {
        const { userId, refreshData } = await request.json();

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

        // Convert user to profile
        const userProfile = userDocumentToProfile(user);
        if (!userProfile) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Risk profile incomplete. Please complete your risk assessment.',
                    profileStatus: user.riskProfile?.completionStatus || 'incomplete'
                },
                { status: 400 }
            );
        }

        // Fetch pool data
        const pools = await fetchPoolData();

        if (pools.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'No pool data available. Please try again later.'
                },
                { status: 503 }
            );
        }

        // Generate recommendations
        const recommendations = await generateRecommendations(userProfile, pools);

        return NextResponse.json({
            success: true,
            recommendations,
            cached: false,
            generatedAt: recommendations.generatedAt.toISOString()
        });

    } catch (error) {
        console.error('Generate recommendations error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to generate recommendations. Please try again.',
                details: process.env.NODE_ENV === 'development' ? String(error) : undefined
            },
            { status: 500 }
        );
    }
}
