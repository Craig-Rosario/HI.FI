import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Pool from '@/models/Pool';
import { ethers } from 'ethers';

/**
 * POST /api/agent/recommendation
 * Get AI agent recommendation for user based on current state
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, poolId, question } = body;

        if (!address) {
            return NextResponse.json(
                { error: 'Wallet address required' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        // Get user data
        const user = await User.findOne({ address: address.toLowerCase() });

        if (!user || !user.questionnaire) {
            return NextResponse.json({
                error: 'Please complete the questionnaire first',
                requiresQuestionnaire: true,
            }, { status: 400 });
        }

        // Get pool data if provided
        let poolData = null;
        let userPosition = null;

        if (poolId) {
            poolData = await Pool.findById(poolId);

            // Get user's position in this pool (from on-chain data)
            if (poolData) {
                userPosition = await getUserPosition(address, poolData.contractAddress, poolData.chainId);
            }
        }

        // Generate recommendation based on question type
        let recommendation;

        if (question === 'should_withdraw') {
            recommendation = await generateWithdrawalRecommendation(user, poolData, userPosition);
        } else if (question === 'best_pool') {
            recommendation = await generatePoolSelectionRecommendation(user);
        } else if (question === 'market_analysis') {
            recommendation = await generateMarketAnalysis(user, poolData);
        } else if (question === 'risk_assessment') {
            recommendation = await generateRiskAssessment(user, userPosition);
        } else {
            // General recommendation
            recommendation = await generateGeneralRecommendation(user, poolData, userPosition);
        }

        return NextResponse.json({
            success: true,
            recommendation,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error generating recommendation:', error);
        return NextResponse.json(
            { error: 'Failed to generate recommendation' },
            { status: 500 }
        );
    }
}

/**
 * Generate withdrawal recommendation
 */
async function generateWithdrawalRecommendation(
    user: any,
    pool: any,
    position: any
) {
    if (!position || position.shares === 0) {
        return {
            action: 'no_position',
            message: 'You have no active position in this pool.',
            suggestions: [],
        };
    }

    const { currentPnL, timeInPool, withdrawWindowOpen, riskMetrics } = position;
    const pnlPercent = (currentPnL / position.principal) * 100;

    // Decision factors
    const factors = [];
    let shouldWithdraw = false;
    let confidence = 0;

    // Check PnL
    if (pnlPercent > 10) {
        factors.push(`Strong profit: +${pnlPercent.toFixed(2)}%`);
        shouldWithdraw = true;
        confidence += 30;
    } else if (pnlPercent < -5) {
        factors.push(`Loss position: ${pnlPercent.toFixed(2)}%`);
        shouldWithdraw = true;
        confidence += 40;
    } else {
        factors.push(`Moderate position: ${pnlPercent.toFixed(2)}%`);
        confidence += 10;
    }

    // Check time in pool vs user's intended duration
    const daysInPool = timeInPool / 86400;
    const targetDays = user.questionnaire.investmentDuration;

    if (daysInPool >= targetDays) {
        factors.push(`Target duration reached (${Math.floor(daysInPool)} days)`);
        shouldWithdraw = true;
        confidence += 25;
    } else {
        factors.push(`${Math.floor(targetDays - daysInPool)} days until target`);
    }

    // Check pool-specific risk factors
    if (pool && pool.riskLevel === 'high' && riskMetrics) {
        if (riskMetrics.volatility > 200) {
            factors.push('⚠️ Extreme volatility detected');
            shouldWithdraw = true;
            confidence += 20;
        }
        if (riskMetrics.isLiquidated) {
            factors.push('🚨 Pool liquidated - withdraw immediately');
            shouldWithdraw = true;
            confidence = 100;
        }
    }

    // Check user's risk tolerance
    if (user.questionnaire.riskTolerance === 'low' && pnlPercent < -3) {
        factors.push('Low risk tolerance - cut losses early');
        shouldWithdraw = true;
        confidence += 15;
    }

    // Withdrawal window status
    if (!withdrawWindowOpen) {
        const timeUntil = position.timeUntilWithdraw;
        factors.push(`Withdraw window opens in ${formatDuration(timeUntil)}`);
    }

    return {
        action: shouldWithdraw ? 'withdraw' : 'hold',
        confidence: Math.min(100, confidence),
        message: generateRecommendationMessage(shouldWithdraw, confidence, factors),
        factors,
        currentPnL: pnlPercent,
        withdrawWindowOpen,
        timeUntilWindow: position.timeUntilWithdraw,
        automationSuggestion: shouldWithdraw
            ? 'Enable auto-withdrawal to execute when window opens'
            : null,
    };
}

/**
 * Generate pool selection recommendation
 */
async function generatePoolSelectionRecommendation(user: any) {
    const riskScore = calculateRiskScore(user.questionnaire);

    // Get all available pools
    const pools = await Pool.find({ status: 'active' });

    // Score each pool
    const scoredPools = pools.map((pool: any) => {
        let score = 0;
        let reasoning: string[] = [];

        // Match risk level to user's risk tolerance
        if (pool.riskLevel === 'low' && riskScore < 35) {
            score += 40;
            reasoning.push('Risk level matches your conservative profile');
        } else if (pool.riskLevel === 'medium' && riskScore >= 35 && riskScore < 65) {
            score += 40;
            reasoning.push('Balanced risk-reward for your profile');
        } else if (pool.riskLevel === 'high' && riskScore >= 65) {
            score += 40;
            reasoning.push('High upside potential for risk-tolerant investor');
        }

        // APY vs risk tolerance
        const expectedAPY = pool.projectedAPY || 0;
        if (expectedAPY > 50 && user.questionnaire.investmentGoal === 'aggressive') {
            score += 20;
            reasoning.push('High yield matches aggressive growth goal');
        } else if (expectedAPY < 20 && user.questionnaire.investmentGoal === 'preservation') {
            score += 20;
            reasoning.push('Stable returns for capital preservation');
        }

        // TVL and liquidity
        if (pool.tvl > 1000) {
            score += 15;
            reasoning.push('Strong liquidity and TVL');
        }

        // Current state
        if (pool.state === 'collecting' && pool.tvl < pool.cap * 0.8) {
            score += 10;
            reasoning.push('Good timing to enter pool');
        }

        // Historical performance (if available)
        if (pool.historicalAPY && pool.historicalAPY > pool.projectedAPY) {
            score += 15;
            reasoning.push('Outperforming projections');
        }

        return {
            pool,
            score,
            reasoning,
        };
    });

    // Sort by score
    scoredPools.sort((a: any, b: any) => b.score - a.score);

    return {
        recommendedPool: scoredPools[0],
        alternatives: scoredPools.slice(1, 3),
        userRiskScore: riskScore,
        reasoning: 'Based on your risk tolerance, investment goals, and market conditions',
    };
}

/**
 * Generate market analysis
 */
async function generateMarketAnalysis(user: any, pool: any) {
    // This is a simplified demo version
    // In production, would integrate with real market data APIs (1inch, etc.)

    const analysis = {
        marketSentiment: 'neutral', // Would come from external APIs
        volatilityIndex: 65, // 0-100
        liquidityConditions: 'good',
        recommendations: [] as string[],
        insights: [] as string[],
    };

    // Generate insights based on pool type
    if (pool) {
        if (pool.riskLevel === 'high') {
            analysis.insights.push('High volatility environment detected');
            analysis.insights.push('Consider shorter holding periods');
        } else if (pool.riskLevel === 'low') {
            analysis.insights.push('Stable conditions favor conservative pools');
        }
    }

    // User-specific insights
    if (user.questionnaire.marketConditionView === 'bullish') {
        analysis.insights.push('Your bullish view aligns with current momentum');
        analysis.recommendations.push('Consider medium-to-high risk pools');
    } else if (user.questionnaire.marketConditionView === 'bearish') {
        analysis.insights.push('Defensive positioning recommended');
        analysis.recommendations.push('Focus on Easy Pool for capital preservation');
    }

    return analysis;
}

/**
 * Generate risk assessment
 */
async function generateRiskAssessment(user: any, position: any) {
    if (!position) {
        return {
            currentRisk: 'none',
            message: 'No active position',
        };
    }

    const pnlPercent = (position.currentPnL / position.principal) * 100;

    return {
        currentRisk: pnlPercent < -10 ? 'high' : pnlPercent < -5 ? 'medium' : 'low',
        pnlPercent,
        principalAtRisk: pnlPercent < 0 ? Math.abs(position.currentPnL) : 0,
        recommendations: [
            pnlPercent < -10 ? 'Consider stop-loss automation' : null,
            position.timeInPool > 7 * 86400 ? 'Approaching optimal exit window' : null,
        ].filter(Boolean),
        automationRecommendations: pnlPercent < -5 ? ['STOP_LOSS'] : [],
    };
}

/**
 * Generate general recommendation
 */
async function generateGeneralRecommendation(user: any, pool: any, position: any) {
    const recommendations = [];

    // Check if user should complete questionnaire
    if (!user.questionnaire) {
        return {
            priority: 'high',
            message: 'Complete the risk assessment questionnaire to get personalized recommendations',
            nextAction: 'questionnaire',
        };
    }

    // Check if user has positions
    if (!position || position.shares === 0) {
        return {
            priority: 'medium',
            message: 'Ready to start investing',
            recommendations: [
                'Review pool options based on your risk profile',
                'Start with Easy Pool to learn the system',
                'Enable agent automation for optimal timing',
            ],
            nextAction: 'select_pool',
        };
    }

    // User has active position
    const pnlPercent = (position.currentPnL / position.principal) * 100;

    return {
        priority: 'normal',
        message: `Your position is ${pnlPercent > 0 ? 'profitable' : 'underwater'}`,
        currentPnL: pnlPercent,
        recommendations: [
            pnlPercent > 5 ? 'Consider taking profits' : 'Monitor position closely',
            'Enable stop-loss automation for protection',
            position.withdrawWindowOpen ? 'Withdrawal window is open' : `Window opens in ${formatDuration(position.timeUntilWithdraw)}`,
        ],
        nextAction: position.withdrawWindowOpen ? 'consider_withdrawal' : 'monitor',
    };
}

/**
 * Get user position from on-chain data
 */
async function getUserPosition(address: string, contractAddress: string, chainId: number) {
    try {
        const rpcUrl = chainId === 84532 ? 'https://sepolia.base.org' : null;
        if (!rpcUrl) return null;

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const poolABI = [
            'function shares(address) view returns (uint256)',
            'function state() view returns (uint8)',
            'function isWithdrawOpen() view returns (bool)',
            'function timeUntilWithdraw() view returns (uint256)',
            'function currentPnL() view returns (int256)',
            'function deployedAt() view returns (uint256)',
            'function deployedAssets() view returns (uint256)',
            'function totalShares() view returns (uint256)',
            // High risk specific
            'function getRiskMetrics() view returns (uint256, int256, uint256, bool)',
        ];

        const pool = new ethers.Contract(contractAddress, poolABI, provider);

        const shares = await pool.shares(address);
        if (shares === BigInt(0)) {
            return { shares: 0 };
        }

        const state = await pool.state();
        const withdrawWindowOpen = await pool.isWithdrawOpen();
        const timeUntilWithdraw = await pool.timeUntilWithdraw();

        let currentPnL = BigInt(0);
        let deployedAssets = BigInt(0);
        let totalShares = BigInt(0);
        let riskMetrics = null;

        if (state === 1) { // DEPLOYED
            try {
                currentPnL = await pool.currentPnL();
                deployedAssets = await pool.deployedAssets();
                totalShares = await pool.totalShares();

                // Try to get risk metrics (high risk pool only)
                try {
                    const metrics = await pool.getRiskMetrics();
                    riskMetrics = {
                        volatility: Number(metrics[0]),
                        pnlPercent: Number(metrics[1]),
                        timeInMarket: Number(metrics[2]),
                        isLiquidated: metrics[3],
                    };
                } catch {
                    // Not a high risk pool
                }
            } catch (error) {
                console.error('Error reading deployed state:', error);
            }
        }

        const deployedAt = await pool.deployedAt();
        const timeInPool = state === 1 ? Date.now() / 1000 - Number(deployedAt) : 0;

        // Calculate user's principal and current value
        const userSharesNum = Number(ethers.formatUnits(shares, 6));
        const totalSharesNum = Number(ethers.formatUnits(totalShares, 6));
        const deployedAssetsNum = Number(ethers.formatUnits(deployedAssets, 6));
        const currentPnLNum = Number(ethers.formatUnits(currentPnL, 6));

        const userPrincipal = totalSharesNum > 0 ? (userSharesNum / totalSharesNum) * deployedAssetsNum : 0;
        const userPnL = totalSharesNum > 0 ? (userSharesNum / totalSharesNum) * currentPnLNum : 0;

        return {
            shares: userSharesNum,
            principal: userPrincipal,
            currentValue: userPrincipal + userPnL,
            currentPnL: userPnL,
            withdrawWindowOpen,
            timeUntilWithdraw: Number(timeUntilWithdraw),
            timeInPool,
            riskMetrics,
        };
    } catch (error) {
        console.error('Error getting user position:', error);
        return null;
    }
}

/**
 * Helper: Calculate risk score from questionnaire
 */
function calculateRiskScore(questionnaire: any): number {
    let score = 0;
    const riskToleranceScores: Record<string, number> = { low: 10, medium: 25, high: 40 };
    score += riskToleranceScores[questionnaire.riskTolerance] || 20;
    const goalScores: Record<string, number> = { preservation: 5, income: 10, growth: 15, aggressive: 20 };
    score += goalScores[questionnaire.investmentGoal] || 10;
    const duration = parseInt(questionnaire.investmentDuration);
    if (duration <= 7) score += 5;
    else if (duration <= 30) score += 10;
    else if (duration <= 90) score += 15;
    else score += 20;
    return Math.min(100, Math.max(0, score));
}

/**
 * Helper: Generate recommendation message
 */
function generateRecommendationMessage(shouldWithdraw: boolean, confidence: number, factors: string[]) {
    if (confidence > 80) {
        return shouldWithdraw
            ? '🎯 Strong recommendation: Withdraw your position now'
            : '✅ High confidence: Hold your position';
    } else if (confidence > 50) {
        return shouldWithdraw
            ? '💡 Mild recommendation: Consider withdrawing'
            : '📊 Moderate confidence: Continue holding';
    } else {
        return shouldWithdraw
            ? '⚖️ Neutral: Withdrawal is an option but not urgent'
            : '⏳ Low urgency: Monitor and reassess';
    }
}

/**
 * Helper: Format duration
 */
function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
}
