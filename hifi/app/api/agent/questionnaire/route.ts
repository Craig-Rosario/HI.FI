import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

/**
 * POST /api/agent/questionnaire
 * Submit user risk profile questionnaire
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, questionnaire } = body;

        if (!address) {
            return NextResponse.json(
                { error: 'Wallet address required' },
                { status: 400 }
            );
        }

        // Validate questionnaire data
        const {
            investmentAmount,
            riskTolerance,
            investmentDuration,
            investmentGoal,
            liquidityNeeds,
            experienceLevel,
            marketConditionView,
        } = questionnaire;

        if (
            !investmentAmount ||
            !riskTolerance ||
            !investmentDuration ||
            !investmentGoal
        ) {
            return NextResponse.json(
                { error: 'Missing required questionnaire fields' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        // Update or create user with questionnaire data
        const user = await User.findOneAndUpdate(
            { address: address.toLowerCase() },
            {
                $set: {
                    questionnaire: {
                        investmentAmount,
                        riskTolerance, // 'low', 'medium', 'high'
                        investmentDuration, // in days
                        investmentGoal, // 'preservation', 'income', 'growth', 'aggressive'
                        liquidityNeeds, // 'high', 'medium', 'low'
                        experienceLevel, // 'beginner', 'intermediate', 'advanced'
                        marketConditionView, // 'bullish', 'neutral', 'bearish'
                        completedAt: new Date(),
                    },
                },
            },
            { upsert: true, new: true }
        );

        // Calculate risk score (0-100)
        const riskScore = calculateRiskScore(questionnaire);

        // Generate agent recommendation
        const recommendation = generatePoolRecommendation(questionnaire, riskScore);

        return NextResponse.json({
            success: true,
            riskScore,
            recommendation,
            user: {
                address: user.address,
                questionnaireCompleted: true,
            },
        });
    } catch (error) {
        console.error('Error saving questionnaire:', error);
        return NextResponse.json(
            { error: 'Failed to save questionnaire' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/agent/questionnaire?address=0x...
 * Get user's questionnaire data
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json(
                { error: 'Wallet address required' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        const user = await User.findOne({ address: address.toLowerCase() });

        if (!user || !user.questionnaire) {
            return NextResponse.json({
                completed: false,
                questionnaire: null,
            });
        }

        const riskScore = calculateRiskScore(user.questionnaire);
        const recommendation = generatePoolRecommendation(user.questionnaire, riskScore);

        return NextResponse.json({
            completed: true,
            questionnaire: user.questionnaire,
            riskScore,
            recommendation,
        });
    } catch (error) {
        console.error('Error fetching questionnaire:', error);
        return NextResponse.json(
            { error: 'Failed to fetch questionnaire' },
            { status: 500 }
        );
    }
}

/**
 * Calculate risk score from questionnaire (0-100)
 */
function calculateRiskScore(questionnaire: any): number {
    let score = 0;

    // Risk tolerance (0-40 points)
    const riskToleranceScores: Record<string, number> = {
        low: 10,
        medium: 25,
        high: 40,
    };
    score += riskToleranceScores[questionnaire.riskTolerance] || 20;

    // Investment goal (0-20 points)
    const goalScores: Record<string, number> = {
        preservation: 5,
        income: 10,
        growth: 15,
        aggressive: 20,
    };
    score += goalScores[questionnaire.investmentGoal] || 10;

    // Investment duration (0-20 points)
    // Longer duration = can take more risk
    const duration = parseInt(questionnaire.investmentDuration);
    if (duration <= 7) score += 5;
    else if (duration <= 30) score += 10;
    else if (duration <= 90) score += 15;
    else score += 20;

    // Experience level (0-10 points)
    const expScores: Record<string, number> = {
        beginner: 3,
        intermediate: 7,
        advanced: 10,
    };
    score += expScores[questionnaire.experienceLevel] || 5;

    // Market condition view (0-10 points)
    const marketScores: Record<string, number> = {
        bearish: 3,
        neutral: 6,
        bullish: 10,
    };
    score += marketScores[questionnaire.marketConditionView] || 6;

    return Math.min(100, Math.max(0, score));
}

/**
 * Generate pool recommendation based on questionnaire and risk score
 */
function generatePoolRecommendation(questionnaire: any, riskScore: number) {
    let recommendedPool: 'easy' | 'medium' | 'high';
    let reasoning: string[];
    let warnings: string[];

    // Determine recommended pool
    if (riskScore < 35) {
        recommendedPool = 'easy';
        reasoning = [
            'Your low risk tolerance suggests a conservative approach',
            'Easy Pool provides predictable, stable returns',
            'Fixed 0.3% per minute yield minimizes uncertainty',
            'Best for capital preservation goals',
        ];
        warnings = [
            'Returns may be lower than other options',
            'Opportunity cost in bull markets',
        ];
    } else if (riskScore < 65) {
        recommendedPool = 'medium';
        reasoning = [
            'Balanced risk-reward profile matches your goals',
            'Variable yield (0.3-0.5% per minute) offers upside potential',
            'Controlled downside risk with stop-loss consideration',
            'Good for moderate growth objectives',
        ];
        warnings = [
            'Some periods may have negative returns',
            'Requires monitoring during volatile conditions',
        ];
    } else {
        recommendedPool = 'high';
        reasoning = [
            'Your high risk tolerance enables aggressive strategies',
            'Potential for significant returns in favorable conditions',
            'Suitable for growth-focused investors',
            'Higher experience level can manage volatility',
        ];
        warnings = [
            '⚠️ CAN LOSE UP TO 50% OF PRINCIPAL',
            'Extreme volatility expected',
            'Market crash scenarios simulated',
            'Only invest capital you can afford to lose',
            'May trigger automatic liquidation',
        ];
    }

    // Additional context based on duration
    const duration = parseInt(questionnaire.investmentDuration);
    if (duration <= 7 && recommendedPool === 'high') {
        warnings.push('Short timeframe increases risk - consider Medium Pool');
    }

    // Liquidity needs consideration
    if (questionnaire.liquidityNeeds === 'high') {
        warnings.push('All pools have 1-minute lock period and 1-hour withdrawal windows');
    }

    return {
        recommendedPool,
        riskScore,
        reasoning,
        warnings,
        alternativePools: getAlternativePools(recommendedPool),
        suggestedDuration: getSuggestedDuration(recommendedPool, duration),
        automationRecommendation: getAutomationRecommendation(questionnaire, recommendedPool),
    };
}

/**
 * Get alternative pool suggestions
 */
function getAlternativePools(recommended: string) {
    const alternatives = {
        easy: [
            {
                pool: 'medium',
                reason: 'If you want slightly higher returns with manageable risk',
            },
        ],
        medium: [
            {
                pool: 'easy',
                reason: 'If you prefer more stability and predictable returns',
            },
            {
                pool: 'high',
                reason: 'If you can accept higher risk for potential higher rewards',
            },
        ],
        high: [
            {
                pool: 'medium',
                reason: 'If you want significant upside with less principal risk',
            },
        ],
    };

    return alternatives[recommended as keyof typeof alternatives] || [];
}

/**
 * Get suggested investment duration
 */
function getSuggestedDuration(pool: string, userDuration: number) {
    const suggestions: Record<string, any> = {
        easy: {
            min: 7,
            optimal: 30,
            message: 'Easy Pool performs consistently across all timeframes',
        },
        medium: {
            min: 7,
            optimal: 14,
            message: 'Medium Pool volatility averages out over 2+ weeks',
        },
        high: {
            min: 1,
            optimal: 7,
            message: 'High Pool is best for tactical short-term positions',
        },
    };

    const suggestion = suggestions[pool];
    const isOptimal = userDuration >= suggestion.optimal;

    return {
        ...suggestion,
        userDuration,
        isOptimal,
        recommendation: isOptimal
            ? `Your ${userDuration}-day timeframe is ideal for ${pool} pool`
            : `Consider extending to ${suggestion.optimal}+ days for better risk-adjusted returns`,
    };
}

/**
 * Get automation recommendations
 */
function getAutomationRecommendation(questionnaire: any, pool: string) {
    const recommendations = [];

    // Stop-loss recommendation
    if (pool === 'high' || pool === 'medium') {
        recommendations.push({
            type: 'STOP_LOSS',
            description: 'Auto-exit if losses exceed threshold',
            suggestedThreshold: pool === 'high' ? -20 : -10,
            reasoning: 'Protects capital from extreme downside events',
        });
    }

    // Auto-withdrawal recommendation
    if (questionnaire.liquidityNeeds === 'high') {
        recommendations.push({
            type: 'AUTO_WITHDRAW',
            description: 'Automatically withdraw when window opens',
            suggestedTiming: 'immediate',
            reasoning: 'Ensures you dont miss withdrawal windows',
        });
    }

    // Target return exit
    if (questionnaire.investmentGoal === 'aggressive' || pool === 'high') {
        recommendations.push({
            type: 'TARGET_EXIT',
            description: 'Exit when target return is reached',
            suggestedTarget: pool === 'high' ? 15 : 8,
            reasoning: 'Locks in profits before potential reversals',
        });
    }

    return {
        recommended: recommendations.length > 0,
        automations: recommendations,
        benefits: [
            'Reduces from 8 signatures to 1 initial approval',
            'Agent monitors 24/7 and executes optimal timing',
            'Removes emotional decision-making',
            'Can revoke permissions any time',
        ],
    };
}
