/**
 * User Risk Scoring Algorithm
 * Deterministic function that converts profile parameters to numerical risk score (0-100)
 */

import {
    UserProfile,
    UserRiskScoreComponents,
    AgeRange,
    InvestmentHorizon,
    IncomeRange,
    LiquidityNeeds,
    DeFiExperience,
    RiskTolerance
} from '../types/recommendations';

/**
 * Calculate user risk score from profile parameters
 * Returns a score between 0-100 where higher = more risk tolerance
 * 
 * @param profile User profile with risk parameters
 * @returns Risk score (0-100) and component breakdown
 */
export function calculateUserRiskScore(profile: UserProfile): number {
    const components = calculateUserRiskScoreWithBreakdown(profile);
    return components.finalScore;
}

/**
 * Calculate user risk score with detailed component breakdown
 * Useful for debugging and explaining the score to users
 */
export function calculateUserRiskScoreWithBreakdown(
    profile: UserProfile
): UserRiskScoreComponents {
    // Step 1: Base score from self-declared risk tolerance
    const baseScore = getBaseScore(profile.riskTolerance);

    // Step 2: Age adjustment (younger = higher risk capacity)
    const ageModifier = getAgeModifier(profile.ageRange);

    // Step 3: Investment horizon adjustment (longer = higher risk tolerance)
    const horizonModifier = getHorizonModifier(profile.investmentHorizon);

    // Step 4: Income/capital adjustment (higher income = more risk capacity)
    const incomeModifier = getIncomeModifier(profile.incomeRange);

    // Step 5: Liquidity needs constraint (reduces risk if needs are immediate)
    const liquidityPenalty = getLiquidityPenalty(profile.liquidityNeeds);

    // Step 6: Experience boost (advanced users can handle complexity)
    const experienceBoost = getExperienceBoost(profile.previousDeFiExperience);

    // Final score (clamped between 0-100)
    const rawScore = baseScore + ageModifier + horizonModifier +
        incomeModifier + liquidityPenalty + experienceBoost;

    const finalScore = Math.max(0, Math.min(100, rawScore));

    return {
        baseScore,
        ageModifier,
        horizonModifier,
        incomeModifier,
        liquidityPenalty,
        experienceBoost,
        finalScore
    };
}

/**
 * Get base score from risk tolerance
 * Conservative users start at 20, aggressive at 85
 */
function getBaseScore(tolerance: RiskTolerance): number {
    const scoreMap: Record<RiskTolerance, number> = {
        'conservative': 20,
        'moderate': 35,
        'balanced': 50,
        'growth': 70,
        'aggressive': 85
    };

    return scoreMap[tolerance];
}

/**
 * Age adjustment: younger investors have higher risk capacity
 */
function getAgeModifier(ageRange: AgeRange): number {
    const modifierMap: Record<AgeRange, number> = {
        'under-25': +10,
        '25-40': +5,
        '41-55': 0,
        '56-70': -10,
        'over-70': -15
    };

    return modifierMap[ageRange];
}

/**
 * Investment horizon: longer horizons allow more risk
 */
function getHorizonModifier(horizon: InvestmentHorizon): number {
    const modifierMap: Record<InvestmentHorizon, number> = {
        '1-month': -15,
        '3-months': -5,
        '6-months': 0,
        '1-year': +5,
        '2-years+': +10
    };

    return modifierMap[horizon];
}

/**
 * Income adjustment: higher income provides more risk capacity
 */
function getIncomeModifier(income: IncomeRange): number {
    const modifierMap: Record<IncomeRange, number> = {
        'under-30k': -10,
        '30k-75k': -5,
        '75k-150k': 0,
        '150k-300k': +5,
        'over-300k': +10
    };

    return modifierMap[income];
}

/**
 * Liquidity penalty: immediate needs reduce risk tolerance
 */
function getLiquidityPenalty(needs: LiquidityNeeds): number {
    const penaltyMap: Record<LiquidityNeeds, number> = {
        'immediate': -10,
        'short-term': -5,
        'medium-term': 0,
        'long-term': +5
    };

    return penaltyMap[needs];
}

/**
 * Experience boost: advanced users can handle more complex/risky strategies
 */
function getExperienceBoost(experience: DeFiExperience): number {
    const boostMap: Record<DeFiExperience, number> = {
        'none': -5,
        'beginner': 0,
        'intermediate': +3,
        'advanced': +5
    };

    return boostMap[experience];
}

/**
 * Get human-readable explanation of risk score
 */
export function explainUserRiskScore(
    profile: UserProfile,
    components: UserRiskScoreComponents
): string {
    const parts: string[] = [];

    parts.push(`Base risk tolerance (${profile.riskTolerance}): ${components.baseScore}`);

    if (components.ageModifier !== 0) {
        parts.push(`Age adjustment (${profile.ageRange}): ${components.ageModifier > 0 ? '+' : ''}${components.ageModifier}`);
    }

    if (components.horizonModifier !== 0) {
        parts.push(`Investment horizon (${profile.investmentHorizon}): ${components.horizonModifier > 0 ? '+' : ''}${components.horizonModifier}`);
    }

    if (components.incomeModifier !== 0) {
        parts.push(`Income level (${profile.incomeRange}): ${components.incomeModifier > 0 ? '+' : ''}${components.incomeModifier}`);
    }

    if (components.liquidityPenalty !== 0) {
        parts.push(`Liquidity needs (${profile.liquidityNeeds}): ${components.liquidityPenalty > 0 ? '+' : ''}${components.liquidityPenalty}`);
    }

    if (components.experienceBoost !== 0) {
        parts.push(`DeFi experience (${profile.previousDeFiExperience}): ${components.experienceBoost > 0 ? '+' : ''}${components.experienceBoost}`);
    }

    parts.push(`\nFinal Risk Score: ${components.finalScore}/100`);

    return parts.join('\n');
}
