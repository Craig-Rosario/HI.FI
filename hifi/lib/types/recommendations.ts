/**
 * Type definitions for the Deterministic Financial Recommendation Agent
 * Based on RECOMMENDATION_AGENT_DESIGN.md
 */

// ============================================================================
// User Profile Types
// ============================================================================

export type AgeRange = 'under-25' | '25-40' | '41-55' | '56-70' | 'over-70';
export type IncomeRange = 'under-30k' | '30k-75k' | '75k-150k' | '150k-300k' | 'over-300k';
export type InvestmentHorizon = '1-month' | '3-months' | '6-months' | '1-year' | '2-years+';
export type RiskTolerance = 'conservative' | 'moderate' | 'balanced' | 'growth' | 'aggressive';
export type LiquidityNeeds = 'immediate' | 'short-term' | 'medium-term' | 'long-term';
export type InvestmentGoal = 'capital-preservation' | 'income' | 'growth' | 'speculation';
export type DeFiExperience = 'none' | 'beginner' | 'intermediate' | 'advanced';

export interface UserProfile {
    userId: string;
    walletAddress: string;

    // Risk Profile Inputs
    ageRange: AgeRange;
    incomeRange: IncomeRange;
    investmentHorizon: InvestmentHorizon;
    riskTolerance: RiskTolerance;

    // Additional Context
    liquidityNeeds: LiquidityNeeds;
    investmentGoals: InvestmentGoal[];
    previousDeFiExperience: DeFiExperience;

    // Metadata
    profileCreatedAt: Date;
    lastUpdated: Date;
    completionStatus: 'incomplete' | 'complete';
}

// ============================================================================
// Asset & Pool Types
// ============================================================================

export type AssetCategory =
    | 'stablecoin'        // USDC, USDT, DAI
    | 'wrapped-native'    // WETH, WMATIC
    | 'liquid-staking'    // stETH, rETH, cbETH
    | 'blue-chip'         // BTC, ETH (large cap)
    | 'mid-cap'           // UNI, AAVE, LINK
    | 'volatile'          // Newer/smaller tokens
    | 'exotic';           // Memecoins, new launches

export interface TokenInfo {
    address: string;
    symbol: string;
    decimals: number;
    category: AssetCategory;
}

export interface PoolMetrics {
    poolId: string;
    poolAddress: string;

    // Asset Information
    token0: TokenInfo;
    token1: TokenInfo;

    // Liquidity Metrics
    totalValueLocked: number;      // USD value
    liquidityDepth: {
        buy: number;                 // USD within 2% of spot
        sell: number;
    };
    liquidityStability: number;    // Coefficient of variation (30d)

    // Fee Structure
    feeTier: number;               // Basis points (e.g., 5, 30, 100)
    volumeLast24h: number;         // USD volume
    volumeLast7d: number;
    feesGenerated24h: number;      // USD fees collected

    // Volatility Metrics
    impliedVolatility: number;     // Derived from TWAP changes (30d)
    priceRangeLast30d: {
        min: number;
        max: number;
        percentageChange: number;
    };

    // Utilization
    utilizationRate: number;       // Swaps vs available liquidity
    averageTradeSize: number;      // Median trade size (USD)

    // Historical Performance
    apy30d: number;                // Trailing 30-day APY (fees only)
    apy90d: number;
    impermanentLossRisk: number;   // Historical IL metric

    // Metadata
    createdAt: Date;
    lastUpdatedBlock: number;
}

// ============================================================================
// Risk Scoring Types
// ============================================================================

export interface RiskBand {
    min: number;  // Minimum acceptable pool risk
    max: number;  // Maximum acceptable pool risk
}

export interface RiskBreakdown {
    assetPairRisk: {
        score: number;
        explanation: string;
    };
    volatilityRisk: {
        score: number;
        explanation: string;
    };
    liquidityRisk: {
        score: number;
        explanation: string;
    };
    ilRisk: {
        score: number;
        explanation: string;
    };
}

// ============================================================================
// Recommendation Types
// ============================================================================

export type RiskLevel = 'ULTRA_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface RecommendationExplanation {
    poolName: string;
    poolAddress: string;
    riskLevel: RiskLevel;
    riskScore: number;
    userRiskScore: number;
    matchReason: string;

    // Breakdown of risk components
    riskBreakdown: RiskBreakdown;

    // Performance metrics
    metrics: {
        apy30d: number;
        tvl: number;
        feeTier: number;
        volumeLast24h: number;
    };

    // Ranking factors
    rankingFactors: {
        capitalEfficiency: string;
        liquidityStability: string;
        feeStructure: string;
    };

    // Warnings and considerations
    warnings: string[];
    considerations: string[];
}

export interface RankedPool {
    pool: PoolMetrics;
    poolRiskScore: number;
    rankingScore: number;
    reasoning: string;
}

export interface RecommendationResponse {
    userId: string;
    walletAddress: string;
    userProfile: UserProfile;
    userRiskScore: number;

    // Ranked recommendations
    recommendations: {
        pool: PoolMetrics;
        explanation: RecommendationExplanation;
        rankingScore: number;
    }[];

    // Metadata
    generatedAt: Date;
    dataSourceTimestamp: Date;
    totalPoolsEvaluated: number;
    totalPoolsMatched: number;
    algorithmVersion: string;

    // Disclaimers
    disclaimers: string[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GenerateRecommendationsRequest {
    userId: string;
    refreshData?: boolean;
}

export interface GenerateRecommendationsResponse {
    success: boolean;
    recommendations?: RecommendationResponse;
    cached?: boolean;
    generatedAt: string;
    error?: string;
}

export interface RefreshRecommendationsRequest {
    userId: string;
}

export interface RefreshRecommendationsResponse {
    success: boolean;
    updated: boolean;
    newRecommendationsCount: number;
    changesDetected: string[];
}

// ============================================================================
// Internal Calculation Types
// ============================================================================

export interface UserRiskScoreComponents {
    baseScore: number;
    ageModifier: number;
    horizonModifier: number;
    incomeModifier: number;
    liquidityPenalty: number;
    experienceBoost: number;
    finalScore: number;
}

export interface PoolRiskScoreComponents {
    assetRisk: number;
    volatilityRisk: number;
    liquidityRisk: number;
    ilRisk: number;
    compositeRisk: number;
}

export interface RankingScoreComponents {
    apyScore: number;
    stabilityScore: number;
    feeScore: number;
    depthScore: number;
    preferenceScore: number;
    finalScore: number;
}
