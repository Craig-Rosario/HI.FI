/**
 * Main Recommendation Engine
 * Orchestrates the complete recommendation generation process
 */

import {
    UserProfile,
    PoolMetrics,
    RecommendationResponse,
    RankedPool
} from '../types/recommendations';
import { calculateUserRiskScore } from './userRiskScoring';
import { filterPoolsByRisk, rankMatchedPools } from './matching';
import { generateExplanation, STANDARD_DISCLAIMERS } from './explanation';

/**
 * Algorithm version for tracking changes
 */
export const ALGORITHM_VERSION = '1.0.0';

/**
 * Generate personalized pool recommendations for a user
 * 
 * @param userProfile User's risk profile
 * @param availablePools All pools to consider
 * @param topN Number of recommendations to return (default: 10)
 * @returns Complete recommendation response
 */
export async function generateRecommendations(
    userProfile: UserProfile,
    availablePools: PoolMetrics[],
    topN: number = 10
): Promise<RecommendationResponse> {
    // Step 1: Calculate user risk score
    const userRiskScore = calculateUserRiskScore(userProfile);

    // Step 2: Filter pools by risk match
    const matchedPools = filterPoolsByRisk(availablePools, userRiskScore);

    // Step 3: Rank matched pools
    const rankedPools = rankMatchedPools(matchedPools, userProfile, topN);

    // Step 4: Generate explanations for each recommendation
    const recommendations = rankedPools.map(ranked => ({
        pool: ranked.pool,
        explanation: generateExplanation(ranked, userRiskScore, userProfile),
        rankingScore: ranked.rankingScore
    }));

    // Step 5: Construct response
    return {
        userId: userProfile.userId,
        walletAddress: userProfile.walletAddress,
        userProfile,
        userRiskScore,
        recommendations,
        generatedAt: new Date(),
        dataSourceTimestamp: new Date(), // Should be actual pool data timestamp
        totalPoolsEvaluated: availablePools.length,
        totalPoolsMatched: matchedPools.length,
        algorithmVersion: ALGORITHM_VERSION,
        disclaimers: STANDARD_DISCLAIMERS
    };
}

/**
 * Convert MongoDB user document to UserProfile
 */
export function userDocumentToProfile(user: any): UserProfile | null {
    if (!user.riskProfile || user.riskProfile.completionStatus !== 'complete') {
        return null; // Profile not complete
    }

    return {
        userId: user._id.toString(),
        walletAddress: user.walletAddress,
        ageRange: user.riskProfile.ageRange,
        incomeRange: user.riskProfile.incomeRange,
        investmentHorizon: user.riskProfile.investmentHorizon,
        riskTolerance: user.riskProfile.riskTolerance,
        liquidityNeeds: user.riskProfile.liquidityNeeds,
        investmentGoals: user.riskProfile.investmentGoals || [],
        previousDeFiExperience: user.riskProfile.previousDeFiExperience,
        profileCreatedAt: user.createdAt,
        lastUpdated: user.riskProfile.lastUpdated || user.updatedAt,
        completionStatus: user.riskProfile.completionStatus
    };
}

/**
 * Validate user profile completeness
 */
export function validateUserProfile(profile: Partial<UserProfile>): {
    isValid: boolean;
    missingFields: string[];
} {
    const requiredFields: (keyof UserProfile)[] = [
        'ageRange',
        'incomeRange',
        'investmentHorizon',
        'riskTolerance',
        'liquidityNeeds',
        'investmentGoals',
        'previousDeFiExperience'
    ];

    const missingFields = requiredFields.filter(field => !profile[field]);

    return {
        isValid: missingFields.length === 0,
        missingFields
    };
}
