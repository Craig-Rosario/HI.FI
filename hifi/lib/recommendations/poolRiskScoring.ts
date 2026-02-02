/**
 * Pool Risk Scoring Algorithm
 * Deterministic function that assesses pool risk from on-chain metrics (0-100)
 */

import {
    PoolMetrics,
    PoolRiskScoreComponents,
    AssetCategory,
    TokenInfo
} from '../types/recommendations';

/**
 * Calculate pool risk score from on-chain metrics
 * Returns a score between 0-100 where higher = more risky
 * 
 * @param pool Pool metrics from on-chain data
 * @returns Risk score (0-100)
 */
export function calculatePoolRiskScore(pool: PoolMetrics): number {
    const components = calculatePoolRiskScoreWithBreakdown(pool);
    return Math.round(components.compositeRisk);
}

/**
 * Calculate pool risk score with detailed component breakdown
 */
export function calculatePoolRiskScoreWithBreakdown(
    pool: PoolMetrics
): PoolRiskScoreComponents {
    // Component 1: Asset Pair Risk (40% weight)
    const assetRisk = calculateAssetPairRisk(pool.token0.category, pool.token1.category);

    // Component 2: Volatility Risk (25% weight)
    const volatilityRisk = normalizeVolatility(
        pool.impliedVolatility,
        pool.priceRangeLast30d.percentageChange
    );

    // Component 3: Liquidity Risk (20% weight)
    const liquidityRisk = calculateLiquidityRisk(
        pool.totalValueLocked,
        pool.liquidityStability
    );

    // Component 4: IL Risk (15% weight)
    const ilRisk = normalizeILRisk(pool.impermanentLossRisk);

    // Weighted composite score
    const compositeRisk = (
        assetRisk * 0.40 +
        volatilityRisk * 0.25 +
        liquidityRisk * 0.20 +
        ilRisk * 0.15
    );

    return {
        assetRisk,
        volatilityRisk,
        liquidityRisk,
        ilRisk,
        compositeRisk
    };
}

/**
 * Calculate risk based on asset pair characteristics
 * Stable pairs = low risk, volatile pairs = high risk
 */
export function calculateAssetPairRisk(
    cat0: AssetCategory,
    cat1: AssetCategory
): number {
    // Individual asset category risk levels
    const categoryRiskMap: Record<AssetCategory, number> = {
        'stablecoin': 5,
        'wrapped-native': 30,
        'liquid-staking': 25,
        'blue-chip': 40,
        'mid-cap': 60,
        'volatile': 80,
        'exotic': 95
    };

    const risk0 = categoryRiskMap[cat0];
    const risk1 = categoryRiskMap[cat1];

    // Average risk
    let avgRisk = (risk0 + risk1) / 2;

    // Special case: Stable-stable pairs get ultra-low risk
    if (cat0 === 'stablecoin' && cat1 === 'stablecoin') {
        return 2;
    }

    // Special case: ETH-LST pairs are highly correlated (reduced IL)
    if ((cat0 === 'wrapped-native' && cat1 === 'liquid-staking') ||
        (cat1 === 'wrapped-native' && cat0 === 'liquid-staking')) {
        avgRisk *= 0.7; // 30% risk reduction
    }

    return avgRisk;
}

/**
 * Normalize volatility metrics to 0-100 risk score
 * Uses both implied volatility and recent price changes
 */
export function normalizeVolatility(
    impliedVol: number,
    priceChange: number
): number {
    // Implied volatility (annualized): 0-200%
    // Map to 0-100 risk score
    const volScore = Math.min(100, (impliedVol / 2));

    // Price change 30d: 0-100%+
    const priceScore = Math.min(100, priceChange);

    // Weight IV more heavily (60/40 split)
    return (volScore * 0.6 + priceScore * 0.4);
}

/**
 * Calculate liquidity risk based on TVL and stability
 * Deep, stable liquidity = low risk
 */
export function calculateLiquidityRisk(
    tvl: number,
    stability: number
): number {
    // TVL-based risk score
    let tvlRisk: number;

    if (tvl >= 10_000_000) {
        tvlRisk = 10;       // Very deep liquidity
    } else if (tvl >= 1_000_000) {
        tvlRisk = 25;       // Good liquidity
    } else if (tvl >= 100_000) {
        tvlRisk = 50;       // Moderate liquidity
    } else if (tvl >= 10_000) {
        tvlRisk = 75;       // Thin liquidity
    } else {
        tvlRisk = 95;       // Very risky
    }

    // Stability: coefficient of variation (0-1, lower is better)
    // Convert to risk score (0-100)
    const stabilityRisk = stability * 100;

    // TVL is more important (70/30 split)
    return (tvlRisk * 0.7 + stabilityRisk * 0.3);
}

/**
 * Normalize impermanent loss risk
 * Historical IL percentage directly maps to risk score
 */
export function normalizeILRisk(historicalIL: number): number {
    // Historical IL: percentage loss from holding vs LPing (0-100%+)
    return Math.min(100, historicalIL);
}

/**
 * Get risk level label from numeric score
 */
export function getRiskLevel(score: number): string {
    if (score < 15) return 'ULTRA_LOW';
    if (score < 30) return 'LOW';
    if (score < 50) return 'MEDIUM';
    if (score < 70) return 'HIGH';
    return 'VERY_HIGH';
}

/**
 * Explain asset pair risk in human-readable form
 */
export function explainAssetPairRisk(token0: TokenInfo, token1: TokenInfo): string {
    const cat0 = token0.category;
    const cat1 = token1.category;

    if (cat0 === 'stablecoin' && cat1 === 'stablecoin') {
        return `Ultra-low risk: Both assets are stablecoins pegged to the same value, minimizing impermanent loss.`;
    }

    if ((cat0 === 'wrapped-native' && cat1 === 'liquid-staking') ||
        (cat1 === 'wrapped-native' && cat0 === 'liquid-staking')) {
        return `Low risk: Highly correlated assets (${token0.symbol}/${token1.symbol}) reduce divergence risk.`;
    }

    if (cat0 === 'volatile' || cat1 === 'volatile') {
        return `High risk: One or both assets are highly volatile, increasing impermanent loss potential.`;
    }

    if (cat0 === 'exotic' || cat1 === 'exotic') {
        return `Very high risk: Exotic/memecoin exposure with extreme volatility and potential for rapid price changes.`;
    }

    return `Moderate risk: Asset pair has standard correlation and volatility characteristics.`;
}

/**
 * Explain volatility in human-readable form
 */
export function explainVolatility(impliedVol: number, priceChange: number): string {
    if (impliedVol < 20) {
        return `Low volatility: Prices have been stable (${impliedVol.toFixed(1)}% annualized vol), suitable for income generation.`;
    } else if (impliedVol < 60) {
        return `Moderate volatility: Standard price fluctuations (${impliedVol.toFixed(1)}% annualized vol) typical of crypto markets.`;
    } else {
        return `High volatility: Significant price swings (${impliedVol.toFixed(1)}% annualized vol) increase impermanent loss risk.`;
    }
}

/**
 * Explain liquidity in human-readable form
 */
export function explainLiquidity(tvl: number, stability: number): string {
    const tvlLabel = tvl >= 10_000_000 ? 'very deep' :
        tvl >= 1_000_000 ? 'strong' :
            tvl >= 100_000 ? 'moderate' : 'limited';

    const stabilityLabel = stability < 0.2 ? 'very stable' :
        stability < 0.4 ? 'stable' :
            stability < 0.6 ? 'moderately variable' : 'unstable';

    const tvlFormatted = tvl >= 1_000_000
        ? `$${(tvl / 1_000_000).toFixed(2)}M`
        : `$${(tvl / 1_000).toFixed(0)}K`;

    return `${tvlLabel.charAt(0).toUpperCase() + tvlLabel.slice(1)} liquidity (${tvlFormatted} TVL) with ${stabilityLabel} participation.`;
}

/**
 * Explain impermanent loss risk in human-readable form
 */
export function explainIL(ilRisk: number): string {
    if (ilRisk < 2) {
        return `Negligible impermanent loss risk based on historical data (<${ilRisk.toFixed(1)}%).`;
    } else if (ilRisk < 10) {
        return `Low impermanent loss risk (${ilRisk.toFixed(1)}% historical), manageable for LPs.`;
    } else if (ilRisk < 25) {
        return `Moderate impermanent loss risk (${ilRisk.toFixed(1)}% historical), offset by fee generation.`;
    } else {
        return `High impermanent loss risk (${ilRisk.toFixed(1)}% historical), suitable only for active managers.`;
    }
}
