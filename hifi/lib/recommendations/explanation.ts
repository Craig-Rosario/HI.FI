/**
 * Explanation Generation System
 * Creates transparent, human-readable explanations for recommendations
 */

import {
    PoolMetrics,
    UserProfile,
    RankedPool,
    RecommendationExplanation,
    RiskLevel,
    RiskBreakdown
} from '../types/recommendations';
import {
    calculatePoolRiskScoreWithBreakdown,
    explainAssetPairRisk,
    explainVolatility,
    explainLiquidity,
    explainIL
} from './poolRiskScoring';

/**
 * Standard disclaimers shown with all recommendations
 */
export const STANDARD_DISCLAIMERS = [
    "Past performance does not guarantee future results.",
    "All investments carry risk of loss. You may lose some or all of your invested capital.",
    "Recommendations are based on current on-chain data and may change as market conditions evolve.",
    "This is not financial advice. Conduct your own research before investing.",
    "Impermanent loss is a real risk in liquidity provision and may exceed fee earnings.",
    "Smart contract risk exists - audit reports do not eliminate all vulnerabilities.",
    "Always verify pool addresses and asset contracts before depositing funds."
];

/**
 * Generate comprehensive explanation for a recommendation
 */
export function generateExplanation(
    rankedPool: RankedPool,
    userRiskScore: number,
    userProfile: UserProfile
): RecommendationExplanation {
    const { pool, poolRiskScore } = rankedPool;

    // Determine risk level label
    const riskLevel = getRiskLevelLabel(poolRiskScore);

    // Generate match reason
    const matchReason = generateMatchReason(poolRiskScore, userRiskScore, userProfile);

    // Generate risk breakdown with explanations
    const riskBreakdown = generateRiskBreakdown(pool);

    // Performance metrics
    const metrics = {
        apy30d: pool.apy30d,
        tvl: pool.totalValueLocked,
        feeTier: pool.feeTier,
        volumeLast24h: pool.volumeLast24h
    };

    // Ranking factors explanation
    const rankingFactors = {
        capitalEfficiency: `Risk-adjusted APY: ${(pool.apy30d / (1 + poolRiskScore / 100)).toFixed(2)}%`,
        liquidityStability: `Liquidity stability: ${((1 - pool.liquidityStability) * 100).toFixed(1)}% stable`,
        feeStructure: `${pool.feeTier} bps fee tier generating $${pool.feesGenerated24h.toLocaleString()} daily`
    };

    // Generate warnings
    const warnings = generateWarnings(pool, poolRiskScore, userProfile);

    // Generate considerations
    const considerations = generateConsiderations(pool, userProfile);

    return {
        poolName: `${pool.token0.symbol}/${pool.token1.symbol}`,
        poolAddress: pool.poolAddress,
        riskLevel,
        riskScore: poolRiskScore,
        userRiskScore,
        matchReason,
        riskBreakdown,
        metrics,
        rankingFactors,
        warnings,
        considerations
    };
}

/**
 * Get risk level label from numeric score
 */
function getRiskLevelLabel(score: number): RiskLevel {
    if (score < 15) return 'ULTRA_LOW';
    if (score < 30) return 'LOW';
    if (score < 50) return 'MEDIUM';
    if (score < 70) return 'HIGH';
    return 'VERY_HIGH';
}

/**
 * Generate explanation of why pool matches user
 */
function generateMatchReason(
    poolRisk: number,
    userRisk: number,
    profile: UserProfile
): string {
    const diff = userRisk - poolRisk;

    if (diff < 5) {
        return `This pool closely matches your ${profile.riskTolerance} risk profile (user risk: ${userRisk}, pool risk: ${poolRisk}).`;
    } else if (diff < 15) {
        return `This pool is slightly more conservative than your ${profile.riskTolerance} profile, offering additional safety (user risk: ${userRisk}, pool risk: ${poolRisk}).`;
    } else {
        return `This pool is significantly more conservative than your profile, prioritizing capital preservation (user risk: ${userRisk}, pool risk: ${poolRisk}).`;
    }
}

/**
 * Generate detailed risk breakdown with explanations
 */
function generateRiskBreakdown(pool: PoolMetrics): RiskBreakdown {
    const components = calculatePoolRiskScoreWithBreakdown(pool);

    return {
        assetPairRisk: {
            score: components.assetRisk,
            explanation: explainAssetPairRisk(pool.token0, pool.token1)
        },
        volatilityRisk: {
            score: components.volatilityRisk,
            explanation: explainVolatility(
                pool.impliedVolatility,
                pool.priceRangeLast30d.percentageChange
            )
        },
        liquidityRisk: {
            score: components.liquidityRisk,
            explanation: explainLiquidity(
                pool.totalValueLocked,
                pool.liquidityStability
            )
        },
        ilRisk: {
            score: components.ilRisk,
            explanation: explainIL(pool.impermanentLossRisk)
        }
    };
}

/**
 * Generate warnings based on pool characteristics
 */
function generateWarnings(
    pool: PoolMetrics,
    poolRisk: number,
    profile: UserProfile
): string[] {
    const warnings: string[] = [];

    // Low liquidity warning
    if (pool.totalValueLocked < 100_000) {
        warnings.push(
            `⚠️ Low liquidity ($${pool.totalValueLocked.toLocaleString()}) may result in slippage on large withdrawals.`
        );
    }

    // High volatility warning
    if (pool.impliedVolatility > 80) {
        warnings.push(
            `⚠️ High volatility (${pool.impliedVolatility.toFixed(0)}% annualized) may cause significant temporary losses.`
        );
    }

    // Risk mismatch warning for conservative users
    if (poolRisk > 40 && profile.riskTolerance === 'conservative') {
        warnings.push(
            `⚠️ This pool's risk level may exceed comfort zone for conservative investors.`
        );
    }

    // Liquidity need mismatch
    if (profile.liquidityNeeds === 'immediate' && pool.totalValueLocked < 500_000) {
        warnings.push(
            `⚠️ Limited liquidity may not support immediate large withdrawals.`
        );
    }

    // New pool warning
    const poolAgeInDays = (Date.now() - pool.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (poolAgeInDays < 30) {
        warnings.push(
            `⚠️ Newly created pool (<30 days old) - limited historical data available.`
        );
    }

    // High impermanent loss risk
    if (pool.impermanentLossRisk > 20) {
        warnings.push(
            `⚠️ Significant impermanent loss risk (${pool.impermanentLossRisk.toFixed(1)}%) - fees may not fully compensate.`
        );
    }

    return warnings;
}

/**
 * Generate considerations for user review
 */
function generateConsiderations(
    pool: PoolMetrics,
    profile: UserProfile
): string[] {
    const considerations: string[] = [];

    // APY expectation management
    considerations.push(
        `✓ Historical APY (${pool.apy30d.toFixed(1)}%) is not a guarantee of future returns.`
    );

    // Fee tier explanation
    considerations.push(
        `✓ ${pool.feeTier} basis point fee tier optimized for this pool's volatility profile.`
    );

    // Time horizon alignment
    if (profile.investmentHorizon === '1-month' || profile.investmentHorizon === '3-months') {
        considerations.push(
            `✓ Short time horizon may not allow IL to be fully offset by fees.`
        );
    } else {
        considerations.push(
            `✓ Longer time horizon allows fee accumulation to potentially offset IL.`
        );
    }

    // Gas cost consideration
    considerations.push(
        `✓ Consider gas costs when entering/exiting positions, especially for smaller amounts.`
    );

    // Diversification consideration
    if (pool.token0.category === pool.token1.category) {
        considerations.push(
            `✓ Both assets are ${pool.token0.category} tokens - consider diversifying across categories.`
        );
    }

    // Volume consideration
    if (pool.volumeLast24h > pool.totalValueLocked) {
        considerations.push(
            `✓ High trading volume indicates strong market interest and fee generation potential.`
        );
    }

    return considerations;
}

/**
 * Generate summary statistics for all recommendations
 */
export function generateRecommendationSummary(
    recommendations: RankedPool[],
    userRiskScore: number
): {
    totalPools: number;
    averagePoolRisk: number;
    averageAPY: number;
    totalTVL: number;
    riskDistribution: Record<RiskLevel, number>;
} {
    const totalPools = recommendations.length;
    const averagePoolRisk = recommendations.reduce((sum, r) => sum + r.poolRiskScore, 0) / totalPools;
    const averageAPY = recommendations.reduce((sum, r) => sum + r.pool.apy30d, 0) / totalPools;
    const totalTVL = recommendations.reduce((sum, r) => sum + r.pool.totalValueLocked, 0);

    // Risk distribution
    const riskDistribution: Record<RiskLevel, number> = {
        'ULTRA_LOW': 0,
        'LOW': 0,
        'MEDIUM': 0,
        'HIGH': 0,
        'VERY_HIGH': 0
    };

    recommendations.forEach(r => {
        const level = getRiskLevelLabel(r.poolRiskScore);
        riskDistribution[level]++;
    });

    return {
        totalPools,
        averagePoolRisk,
        averageAPY,
        totalTVL,
        riskDistribution
    };
}
