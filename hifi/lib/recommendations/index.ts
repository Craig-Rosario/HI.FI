/**
 * Recommendation Engine - Public API
 * Export all recommendation functions and types
 */

// Core Engine
export { generateRecommendations, userDocumentToProfile, validateUserProfile, ALGORITHM_VERSION } from './engine';

// Risk Scoring
export { calculateUserRiskScore, calculateUserRiskScoreWithBreakdown, explainUserRiskScore } from './userRiskScoring';
export {
    calculatePoolRiskScore,
    calculatePoolRiskScoreWithBreakdown,
    calculateAssetPairRisk,
    normalizeVolatility,
    calculateLiquidityRisk,
    normalizeILRisk,
    getRiskLevel,
    explainAssetPairRisk,
    explainVolatility,
    explainLiquidity,
    explainIL
} from './poolRiskScoring';

// Matching & Ranking
export {
    calculateAcceptableRiskBand,
    filterPoolsByRisk,
    rankMatchedPools,
    calculateRankingScore,
    calculateRankingScoreWithBreakdown,
    getMatchQuality
} from './matching';

// Explanation
export {
    generateExplanation,
    generateRecommendationSummary,
    STANDARD_DISCLAIMERS
} from './explanation';

// Pool Data
export { fetchPoolData, classifyAsset } from './poolData';

// Re-export types
export type {
    UserProfile,
    PoolMetrics,
    RankedPool,
    RecommendationResponse,
    RecommendationExplanation,
    RiskBreakdown,
    RiskBand,
    AssetCategory,
    RiskLevel
} from '../types/recommendations';
