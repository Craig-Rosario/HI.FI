/**
 * Risk Matching and Ranking Algorithm
 * Matches users to appropriate pools and ranks them by suitability
 */

import {
    UserProfile,
    PoolMetrics,
    RankedPool,
    RiskBand,
    RankingScoreComponents
} from '../types/recommendations';
import { calculatePoolRiskScore } from './poolRiskScoring';

/**
 * Calculate acceptable risk band for a user
 * Users accept pools at or below their risk tolerance (+ small buffer)
 * Conservative users accept low-risk pools, aggressive users accept all pools
 */
export function calculateAcceptableRiskBand(userRiskScore: number): RiskBand {
    // Add a buffer of 10 points to help very conservative users see low-risk pools
    // This ensures users with score 0-10 can still see stablecoin pools (risk ~14)
    const buffer = 10;

    return {
        min: 0, // Always start from minimum risk
        max: userRiskScore + buffer // Up to user's risk tolerance + buffer
    };
}

/**
 * Filter pools to only those matching user's risk tolerance
 * Returns pools whose risk score falls within acceptable band
 */
export function filterPoolsByRisk(
    pools: PoolMetrics[],
    userRiskScore: number
): PoolMetrics[] {
    const band = calculateAcceptableRiskBand(userRiskScore);

    return pools.filter(pool => {
        const poolRisk = calculatePoolRiskScore(pool);
        return poolRisk >= band.min && poolRisk <= band.max;
    });
}

/**
 * Rank matched pools by suitability for the user
 * Returns top pools sorted by ranking score (descending)
 */
export function rankMatchedPools(
    matchedPools: PoolMetrics[],
    userProfile: UserProfile,
    topN: number = 10
): RankedPool[] {
    return matchedPools
        .map(pool => {
            const poolRiskScore = calculatePoolRiskScore(pool);
            const rankingScore = calculateRankingScore(pool, userProfile);
            const reasoning = generateRankingReasoning(pool, poolRiskScore, rankingScore);

            return {
                pool,
                poolRiskScore,
                rankingScore,
                reasoning
            };
        })
        .sort((a, b) => b.rankingScore - a.rankingScore) // Descending order
        .slice(0, topN); // Top N recommendations
}

/**
 * Calculate ranking score for a pool
 * Higher score = better match for user's needs
 */
export function calculateRankingScore(
    pool: PoolMetrics,
    userProfile: UserProfile
): number {
    const components = calculateRankingScoreWithBreakdown(pool, userProfile);
    return components.finalScore;
}

/**
 * Calculate ranking score with detailed breakdown
 */
export function calculateRankingScoreWithBreakdown(
    pool: PoolMetrics,
    userProfile: UserProfile
): RankingScoreComponents {
    // Factor 1: Capital efficiency (APY adjusted for risk)
    const poolRisk = calculatePoolRiskScore(pool);
    const riskAdjustedAPY = pool.apy30d / (1 + poolRisk / 100);
    const apyScore = Math.min(100, riskAdjustedAPY * 2); // Normalize to 0-100

    // Factor 2: Liquidity stability (prefer stable pools)
    const stabilityScore = (1 - pool.liquidityStability) * 100;

    // Factor 3: Fee tier efficiency
    const feeScore = calculateFeeScore(
        pool.feeTier,
        pool.volumeLast24h,
        pool.totalValueLocked
    );

    // Factor 4: Liquidity depth (prefer deep liquidity)
    const depthScore = Math.min(100, Math.log10(pool.totalValueLocked) * 10);

    // Factor 5: User preference alignment
    const preferenceScore = calculatePreferenceAlignment(pool, userProfile);

    // Weighted composite
    const finalScore = (
        apyScore * 0.35 +
        stabilityScore * 0.25 +
        feeScore * 0.15 +
        depthScore * 0.15 +
        preferenceScore * 0.10
    );

    return {
        apyScore,
        stabilityScore,
        feeScore,
        depthScore,
        preferenceScore,
        finalScore
    };
}

/**
 * Calculate fee tier efficiency score
 * Optimal fee tiers vary by pool utilization
 */
function calculateFeeScore(
    feeTier: number,
    volume24h: number,
    tvl: number
): number {
    // Calculate utilization ratio
    const utilizationRatio = volume24h / tvl;

    // Optimal fee tiers for different utilization ranges
    if (utilizationRatio < 0.1) {
        // Low utilization: prefer lower fees (1-30 bps)
        return feeTier <= 30 ? 80 : 50;
    } else if (utilizationRatio < 0.5) {
        // Medium utilization: prefer medium fees (30-100 bps)
        return feeTier >= 30 && feeTier <= 100 ? 90 : 60;
    } else {
        // High utilization: can sustain higher fees
        return feeTier >= 100 ? 95 : 70;
    }
}

/**
 * Calculate how well pool aligns with user's stated goals
 */
function calculatePreferenceAlignment(
    pool: PoolMetrics,
    userProfile: UserProfile
): number {
    let score = 50; // Neutral baseline

    const goals = userProfile.investmentGoals;

    // Income-seeking users prefer stable, high-fee pools
    if (goals.includes('income')) {
        if (pool.token0.category === 'stablecoin' || pool.token1.category === 'stablecoin') {
            score += 20;
        }
        if (pool.apy30d > 10) {
            score += 15;
        }
    }

    // Growth-seeking users prefer volatile, emerging pools
    if (goals.includes('growth')) {
        if (pool.token0.category === 'mid-cap' || pool.token1.category === 'mid-cap') {
            score += 15;
        }
        if (pool.token0.category === 'blue-chip' || pool.token1.category === 'blue-chip') {
            score += 10;
        }
    }

    // Capital preservation users prefer stable pairs
    if (goals.includes('capital-preservation')) {
        if (pool.token0.category === 'stablecoin' && pool.token1.category === 'stablecoin') {
            score += 30;
        }
        // Penalize volatile assets
        if (pool.token0.category === 'volatile' || pool.token1.category === 'volatile') {
            score -= 20;
        }
    }

    // Speculation users prefer higher volatility
    if (goals.includes('speculation')) {
        if (pool.impliedVolatility > 60) {
            score += 20;
        }
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * Generate human-readable reasoning for ranking
 */
function generateRankingReasoning(
    pool: PoolMetrics,
    poolRiskScore: number,
    rankingScore: number
): string {
    const reasons: string[] = [];

    // APY factor
    if (pool.apy30d > 15) {
        reasons.push(`High APY (${pool.apy30d.toFixed(1)}%)`);
    } else if (pool.apy30d > 8) {
        reasons.push(`Good APY (${pool.apy30d.toFixed(1)}%)`);
    } else {
        reasons.push(`Stable APY (${pool.apy30d.toFixed(1)}%)`);
    }

    // Liquidity factor
    if (pool.totalValueLocked >= 10_000_000) {
        reasons.push('Deep liquidity');
    } else if (pool.totalValueLocked >= 1_000_000) {
        reasons.push('Strong liquidity');
    }

    // Stability factor
    if (pool.liquidityStability < 0.2) {
        reasons.push('Very stable');
    } else if (pool.liquidityStability < 0.4) {
        reasons.push('Stable');
    }

    // Risk factor
    if (poolRiskScore < 15) {
        reasons.push('Ultra-low risk');
    } else if (poolRiskScore < 30) {
        reasons.push('Low risk');
    } else if (poolRiskScore < 50) {
        reasons.push('Moderate risk');
    } else {
        reasons.push('Higher risk');
    }

    return reasons.join(', ');
}

/**
 * Get match quality description
 */
export function getMatchQuality(userRisk: number, poolRisk: number): string {
    const diff = userRisk - poolRisk;

    if (diff < 5) {
        return 'Perfect match';
    } else if (diff < 15) {
        return 'Good match';
    } else {
        return 'Conservative match';
    }
}
