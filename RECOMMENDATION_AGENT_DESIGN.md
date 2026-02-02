# Deterministic Financial Recommendation Agent - Design Document

## Executive Summary

This document specifies the design of a **deterministic financial recommendation agent** for HI.FI's DeFi platform. The agent maps user-defined risk profiles to observable Uniswap v4 pool characteristics, producing transparent and reproducible investment recommendations without speculative predictions or autonomous trade execution.

**Core Principle**: Advice → Explicit Consent → Deterministic Execution → Observable Accounting

---

## 1. System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Profile Collection                       │
│  (Age, Income, Horizon, Risk Tolerance) → User Risk Score        │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│               On-Chain Data Aggregation Layer                    │
│  Uniswap v4 Pools → (Liquidity, Fees, Volatility, Asset Type)   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Risk Matching & Ranking Engine                      │
│  Match User Risk Score to Pool Risk Scores → Ranked List        │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Explanation Generation System                       │
│  Generate transparent reasoning for each recommendation          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                 User Review & Authorization                      │
│  User reviews → Signs transaction → Executes via smart contract │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Integration Points

- **Frontend (Next.js)**: Collects user profile, displays recommendations
- **MongoDB**: Stores user profiles (non-PII on-chain)
- **Smart Contracts**: PoolVault for execution (no recommendation logic on-chain)
- **Off-Chain Service**: Recommendation engine runs as backend service
- **Uniswap v4 Hooks**: Query pool data via The Graph or direct RPC calls

---

## 2. Input Layer

### 2.1 User Profile Parameters

Collected during onboarding and stored in MongoDB:

```typescript
interface UserProfile {
  userId: string;              // MongoDB ObjectId
  walletAddress: string;       // Ethereum address
  
  // Risk Profile Inputs
  ageRange: 'under-25' | '25-40' | '41-55' | '56-70' | 'over-70';
  incomeRange: 'under-30k' | '30k-75k' | '75k-150k' | '150k-300k' | 'over-300k';
  investmentHorizon: '1-month' | '3-months' | '6-months' | '1-year' | '2-years+';
  riskTolerance: 'conservative' | 'moderate' | 'balanced' | 'growth' | 'aggressive';
  
  // Additional Context
  liquidityNeeds: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
  investmentGoals: ('capital-preservation' | 'income' | 'growth' | 'speculation')[];
  previousDeFiExperience: 'none' | 'beginner' | 'intermediate' | 'advanced';
  
  // Metadata
  profileCreatedAt: Date;
  lastUpdated: Date;
  completionStatus: 'incomplete' | 'complete';
}
```

**Privacy Note**: No sensitive data stored on-chain. Only wallet address and risk score used for matching.

### 2.2 On-Chain Pool Data (Uniswap v4)

Real-time and historical metrics fetched from Uniswap v4:

```typescript
interface PoolMetrics {
  poolId: string;                // Uniswap v4 pool identifier
  poolAddress: string;           // Contract address
  
  // Asset Information
  token0: {
    address: string;
    symbol: string;
    decimals: number;
    category: AssetCategory;     // Derived classification
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
    category: AssetCategory;
  };
  
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

type AssetCategory = 
  | 'stablecoin'        // USDC, USDT, DAI
  | 'wrapped-native'    // WETH, WMATIC
  | 'liquid-staking'    // stETH, rETH, cbETH
  | 'blue-chip'         // BTC, ETH (large cap)
  | 'mid-cap'           // UNI, AAVE, LINK
  | 'volatile'          // Newer/smaller tokens
  | 'exotic';           // Memecoins, new launches
```

**Data Sources**:
- The Graph: Historical pool data
- Direct RPC: Real-time state queries
- TWAP Oracles: Price volatility calculations
- Asset Classification Service: Categorize tokens by on-chain metrics (market cap, age, liquidity)

---

## 3. Decision Logic

### 3.1 User Risk Score Calculation

**Deterministic function** that converts profile parameters to a numerical risk score (0-100):

```typescript
function calculateUserRiskScore(profile: UserProfile): number {
  // Step 1: Base score from self-declared risk tolerance
  const baseScore = {
    'conservative': 20,
    'moderate': 35,
    'balanced': 50,
    'growth': 70,
    'aggressive': 85
  }[profile.riskTolerance];
  
  // Step 2: Age adjustment (younger = higher risk capacity)
  const ageModifier = {
    'under-25': +10,
    '25-40': +5,
    '41-55': 0,
    '56-70': -10,
    'over-70': -15
  }[profile.ageRange];
  
  // Step 3: Investment horizon adjustment (longer = higher risk tolerance)
  const horizonModifier = {
    '1-month': -15,
    '3-months': -5,
    '6-months': 0,
    '1-year': +5,
    '2-years+': +10
  }[profile.investmentHorizon];
  
  // Step 4: Income/capital adjustment (higher income = more risk capacity)
  const incomeModifier = {
    'under-30k': -10,
    '30k-75k': -5,
    '75k-150k': 0,
    '150k-300k': +5,
    'over-300k': +10
  }[profile.incomeRange];
  
  // Step 5: Liquidity needs constraint (reduces risk if needs are immediate)
  const liquidityPenalty = {
    'immediate': -10,
    'short-term': -5,
    'medium-term': 0,
    'long-term': +5
  }[profile.liquidityNeeds];
  
  // Step 6: Experience boost (advanced users can handle complexity)
  const experienceBoost = {
    'none': -5,
    'beginner': 0,
    'intermediate': +3,
    'advanced': +5
  }[profile.previousDeFiExperience];
  
  // Final score (clamped between 0-100)
  const rawScore = baseScore + ageModifier + horizonModifier + 
                   incomeModifier + liquidityPenalty + experienceBoost;
  
  return Math.max(0, Math.min(100, rawScore));
}
```

**Example Calculations**:
- Conservative 60-year-old, 1-month horizon: `20 - 10 - 15 + 0 - 10 + 0 = -15 → 0` (Ultra low risk)
- Aggressive 30-year-old, 2-year horizon, advanced: `85 + 5 + 10 + 5 + 5 + 5 = 115 → 100` (Max risk)
- Balanced 45-year-old, 6-month horizon: `50 + 0 + 0 + 0 + 0 + 0 = 50` (Medium risk)

**Properties**:
- ✅ Deterministic: Same inputs always produce same output
- ✅ Transparent: Each factor is explainable
- ✅ Auditable: Formula is public and verifiable
- ✅ Conservative bias: Defaults to lower risk when uncertain

### 3.2 Pool Risk Score Calculation

**Deterministic function** that assesses pool risk from on-chain metrics (0-100):

```typescript
function calculatePoolRiskScore(pool: PoolMetrics): number {
  // Component 1: Asset Pair Risk (40% weight)
  const assetRisk = calculateAssetPairRisk(pool.token0.category, pool.token1.category);
  
  // Component 2: Volatility Risk (25% weight)
  const volatilityRisk = normalizeVolatility(pool.impliedVolatility, pool.priceRangeLast30d.percentageChange);
  
  // Component 3: Liquidity Risk (20% weight)
  const liquidityRisk = calculateLiquidityRisk(pool.totalValueLocked, pool.liquidityStability);
  
  // Component 4: IL Risk (15% weight)
  const ilRisk = normalizeILRisk(pool.impermanentLossRisk);
  
  // Weighted composite score
  const compositeRisk = (
    assetRisk * 0.40 +
    volatilityRisk * 0.25 +
    liquidityRisk * 0.20 +
    ilRisk * 0.15
  );
  
  return Math.round(compositeRisk);
}

// Sub-component: Asset pair risk matrix
function calculateAssetPairRisk(cat0: AssetCategory, cat1: AssetCategory): number {
  const categoryRiskMap = {
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
  
  // Average risk with stability bonus for stable pairs
  const avgRisk = (risk0 + risk1) / 2;
  
  // Bonus: Stable-stable pairs get further reduction
  if (cat0 === 'stablecoin' && cat1 === 'stablecoin') {
    return 2; // Ultra low risk
  }
  
  // Bonus: ETH-LST pairs are correlated (reduced IL)
  if ((cat0 === 'wrapped-native' && cat1 === 'liquid-staking') ||
      (cat1 === 'wrapped-native' && cat0 === 'liquid-staking')) {
    return avgRisk * 0.7; // 30% risk reduction
  }
  
  return avgRisk;
}

// Sub-component: Volatility risk normalization
function normalizeVolatility(impliedVol: number, priceChange: number): number {
  // Implied volatility (annualized): 0-200%
  // Price change 30d: 0-100%+
  
  const volScore = Math.min(100, (impliedVol / 2)); // Map 0-200% vol to 0-100 risk
  const priceScore = Math.min(100, priceChange);    // Direct mapping
  
  return (volScore * 0.6 + priceScore * 0.4); // Weight IV more heavily
}

// Sub-component: Liquidity risk
function calculateLiquidityRisk(tvl: number, stability: number): number {
  // TVL thresholds (USD)
  let tvlRisk;
  if (tvl >= 10_000_000) tvlRisk = 10;       // Very deep liquidity
  else if (tvl >= 1_000_000) tvlRisk = 25;   // Good liquidity
  else if (tvl >= 100_000) tvlRisk = 50;     // Moderate liquidity
  else if (tvl >= 10_000) tvlRisk = 75;      // Thin liquidity
  else tvlRisk = 95;                         // Very risky
  
  // Stability: coefficient of variation (0-1, lower is better)
  const stabilityRisk = stability * 100;
  
  return (tvlRisk * 0.7 + stabilityRisk * 0.3); // TVL more important
}

// Sub-component: Impermanent loss risk
function normalizeILRisk(historicalIL: number): number {
  // Historical IL: percentage loss from holding vs LPing (0-100%+)
  return Math.min(100, historicalIL);
}
```

**Pool Risk Score Examples**:
- USDC/USDT, $50M TVL, 0.5% vol: `2 * 0.4 + 0.25 * 0.25 + 10 * 0.2 + 0 * 0.15 = 2.9` (Ultra safe)
- WETH/USDC, $5M TVL, 15% vol, 5% IL: `(30+5)/2 * 0.4 + 7.5 * 0.25 + 25 * 0.2 + 5 * 0.15 = 14.5` (Low-medium)
- ETH/ALT, $500k TVL, 60% vol, 25% IL: `50 * 0.4 + 30 * 0.25 + 50 * 0.2 + 25 * 0.15 = 41.3` (High)

### 3.3 Risk Matching Algorithm

Match users to pools within their acceptable risk band:

```typescript
interface RiskBand {
  min: number;  // Minimum acceptable pool risk
  max: number;  // Maximum acceptable pool risk
}

function calculateAcceptableRiskBand(userRiskScore: number): RiskBand {
  // Conservative approach: user can accept pools up to their risk score + small tolerance
  const tolerance = 5; // Allow slightly lower risk pools
  
  return {
    min: Math.max(0, userRiskScore - tolerance),
    max: userRiskScore
  };
}

function filterPoolsByRisk(
  pools: PoolMetrics[],
  userRiskScore: number
): PoolMetrics[] {
  const band = calculateAcceptableRiskBand(userRiskScore);
  
  return pools.filter(pool => {
    const poolRisk = calculatePoolRiskScore(pool);
    return poolRisk >= band.min && poolRisk <= band.max;
  });
}
```

**Matching Logic**:
1. User with risk score 50 → accepts pools with risk 45-50
2. User with risk score 20 → accepts pools with risk 15-20
3. User with risk score 85 → accepts pools with risk 80-85

**Conservative Bias**: Users are matched to pools **at or below** their risk tolerance, never above.

### 3.4 Ranking Algorithm

Among matched pools, rank by **capital efficiency** and **fee compensation**:

```typescript
interface RankedPool {
  pool: PoolMetrics;
  poolRiskScore: number;
  rankingScore: number;
  reasoning: string;
}

function rankMatchedPools(
  matchedPools: PoolMetrics[],
  userProfile: UserProfile
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
    .slice(0, 10); // Top 10 recommendations
}

function calculateRankingScore(pool: PoolMetrics, userProfile: UserProfile): number {
  // Factor 1: Capital efficiency (APY adjusted for risk)
  const riskAdjustedAPY = pool.apy30d / (1 + calculatePoolRiskScore(pool) / 100);
  const apyScore = Math.min(100, riskAdjustedAPY * 2); // Normalize to 0-100
  
  // Factor 2: Liquidity stability (prefer stable pools)
  const stabilityScore = (1 - pool.liquidityStability) * 100;
  
  // Factor 3: Fee tier efficiency (prefer optimal fee tiers)
  const feeScore = calculateFeeScore(pool.feeTier, pool.volumeLast24h, pool.totalValueLocked);
  
  // Factor 4: Liquidity depth (prefer deep liquidity)
  const depthScore = Math.min(100, Math.log10(pool.totalValueLocked) * 10);
  
  // Factor 5: User preference alignment
  const preferenceScore = calculatePreferenceAlignment(pool, userProfile);
  
  // Weighted composite
  return (
    apyScore * 0.35 +
    stabilityScore * 0.25 +
    feeScore * 0.15 +
    depthScore * 0.15 +
    preferenceScore * 0.10
  );
}

function calculateFeeScore(feeTier: number, volume24h: number, tvl: number): number {
  // Fee tier efficiency: are fees appropriate for volatility?
  // Higher volume/TVL ratio with appropriate fees = better score
  
  const utilizationRatio = volume24h / tvl;
  
  // Optimal fee tiers for utilization ranges
  if (utilizationRatio < 0.1) {
    // Low utilization: prefer lower fees (5-30 bps)
    return feeTier <= 30 ? 80 : 50;
  } else if (utilizationRatio < 0.5) {
    // Medium utilization: prefer medium fees (30-100 bps)
    return feeTier >= 30 && feeTier <= 100 ? 90 : 60;
  } else {
    // High utilization: can sustain higher fees
    return feeTier >= 100 ? 95 : 70;
  }
}

function calculatePreferenceAlignment(pool: PoolMetrics, userProfile: UserProfile): number {
  let score = 50; // Neutral baseline
  
  // Income-seeking users prefer stable, high-fee pools
  if (userProfile.investmentGoals.includes('income')) {
    if (pool.token0.category === 'stablecoin' || pool.token1.category === 'stablecoin') {
      score += 20;
    }
    if (pool.apy30d > 10) score += 15;
  }
  
  // Growth-seeking users prefer volatile, emerging pools
  if (userProfile.investmentGoals.includes('growth')) {
    if (pool.token0.category === 'mid-cap' || pool.token1.category === 'mid-cap') {
      score += 15;
    }
  }
  
  // Capital preservation users prefer stable pairs
  if (userProfile.investmentGoals.includes('capital-preservation')) {
    if (pool.token0.category === 'stablecoin' && pool.token1.category === 'stablecoin') {
      score += 30;
    }
  }
  
  return Math.min(100, score);
}
```

**Ranking Properties**:
- Higher scores = better recommendations
- Prioritizes risk-adjusted returns
- Considers liquidity safety and stability
- Aligns with user's stated goals

---

## 4. Explanation Generation System

Generate transparent, human-readable explanations for each recommendation:

```typescript
interface RecommendationExplanation {
  poolName: string;
  poolAddress: string;
  riskLevel: 'ULTRA_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  riskScore: number;
  userRiskScore: number;
  matchReason: string;
  
  // Breakdown of risk components
  riskBreakdown: {
    assetPairRisk: { score: number; explanation: string };
    volatilityRisk: { score: number; explanation: string };
    liquidityRisk: { score: number; explanation: string };
    ilRisk: { score: number; explanation: string };
  };
  
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

function generateExplanation(
  rankedPool: RankedPool,
  userRiskScore: number,
  userProfile: UserProfile
): RecommendationExplanation {
  const { pool, poolRiskScore } = rankedPool;
  
  // Risk level label
  const riskLevel = 
    poolRiskScore < 15 ? 'ULTRA_LOW' :
    poolRiskScore < 30 ? 'LOW' :
    poolRiskScore < 50 ? 'MEDIUM' :
    poolRiskScore < 70 ? 'HIGH' : 'VERY_HIGH';
  
  // Match reason
  const matchReason = generateMatchReason(poolRiskScore, userRiskScore, userProfile);
  
  // Risk breakdown explanations
  const riskBreakdown = {
    assetPairRisk: {
      score: calculateAssetPairRisk(pool.token0.category, pool.token1.category),
      explanation: explainAssetPairRisk(pool.token0, pool.token1)
    },
    volatilityRisk: {
      score: normalizeVolatility(pool.impliedVolatility, pool.priceRangeLast30d.percentageChange),
      explanation: explainVolatility(pool.impliedVolatility, pool.priceRangeLast30d)
    },
    liquidityRisk: {
      score: calculateLiquidityRisk(pool.totalValueLocked, pool.liquidityStability),
      explanation: explainLiquidity(pool.totalValueLocked, pool.liquidityStability)
    },
    ilRisk: {
      score: normalizeILRisk(pool.impermanentLossRisk),
      explanation: explainIL(pool.impermanentLossRisk)
    }
  };
  
  // Ranking factors explanation
  const rankingFactors = {
    capitalEfficiency: `Risk-adjusted APY: ${(pool.apy30d / (1 + poolRiskScore/100)).toFixed(2)}%`,
    liquidityStability: `Liquidity coefficient of variation: ${(pool.liquidityStability * 100).toFixed(1)}%`,
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
    metrics: {
      apy30d: pool.apy30d,
      tvl: pool.totalValueLocked,
      feeTier: pool.feeTier,
      volumeLast24h: pool.volumeLast24h
    },
    rankingFactors,
    warnings,
    considerations
  };
}

// Helper: Explain why pool matches user
function generateMatchReason(poolRisk: number, userRisk: number, profile: UserProfile): string {
  const diff = userRisk - poolRisk;
  
  if (diff < 5) {
    return `This pool closely matches your ${profile.riskTolerance} risk profile (user risk: ${userRisk}, pool risk: ${poolRisk}).`;
  } else if (diff < 15) {
    return `This pool is slightly more conservative than your ${profile.riskTolerance} profile, offering additional safety (user risk: ${userRisk}, pool risk: ${poolRisk}).`;
  } else {
    return `This pool is significantly more conservative than your profile, prioritizing capital preservation (user risk: ${userRisk}, pool risk: ${poolRisk}).`;
  }
}

// Helper: Explain asset pair risk
function explainAssetPairRisk(token0: any, token1: any): string {
  const cat0 = token0.category;
  const cat1 = token1.category;
  
  if (cat0 === 'stablecoin' && cat1 === 'stablecoin') {
    return `Ultra-low risk: Both assets are stablecoins pegged to the same value, minimizing impermanent loss.`;
  }
  
  if ((cat0 === 'wrapped-native' && cat1 === 'liquid-staking') ||
      (cat1 === 'wrapped-native' && cat0 === 'liquid-staking')) {
    return `Low risk: Highly correlated assets (ETH and liquid staked ETH) reduce divergence risk.`;
  }
  
  if (cat0 === 'volatile' || cat1 === 'volatile') {
    return `High risk: One or both assets are highly volatile, increasing impermanent loss potential.`;
  }
  
  return `Moderate risk: Asset pair has standard correlation and volatility characteristics.`;
}

// Helper: Explain volatility
function explainVolatility(impliedVol: number, priceChange: any): string {
  if (impliedVol < 20) {
    return `Low volatility: Prices have been stable (${impliedVol.toFixed(1)}% annualized vol), suitable for income generation.`;
  } else if (impliedVol < 60) {
    return `Moderate volatility: Standard price fluctuations (${impliedVol.toFixed(1)}% annualized vol) typical of crypto markets.`;
  } else {
    return `High volatility: Significant price swings (${impliedVol.toFixed(1)}% annualized vol) increase impermanent loss risk.`;
  }
}

// Helper: Explain liquidity
function explainLiquidity(tvl: number, stability: number): string {
  const tvlLabel = tvl >= 10_000_000 ? 'very deep' :
                   tvl >= 1_000_000 ? 'strong' :
                   tvl >= 100_000 ? 'moderate' : 'limited';
  
  const stabilityLabel = stability < 0.2 ? 'very stable' :
                         stability < 0.4 ? 'stable' :
                         stability < 0.6 ? 'moderately variable' : 'unstable';
  
  return `${tvlLabel.charAt(0).toUpperCase() + tvlLabel.slice(1)} liquidity ($${(tvl/1000000).toFixed(2)}M TVL) with ${stabilityLabel} participation.`;
}

// Helper: Explain IL
function explainIL(ilRisk: number): string {
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

// Helper: Generate warnings
function generateWarnings(pool: PoolMetrics, poolRisk: number, profile: UserProfile): string[] {
  const warnings: string[] = [];
  
  // Low liquidity warning
  if (pool.totalValueLocked < 100_000) {
    warnings.push(`⚠️ Low liquidity ($${pool.totalValueLocked.toLocaleString()}) may result in slippage on large withdrawals.`);
  }
  
  // High volatility warning
  if (pool.impliedVolatility > 80) {
    warnings.push(`⚠️ High volatility (${pool.impliedVolatility.toFixed(0)}% annualized) may cause significant temporary losses.`);
  }
  
  // IL warning for correlated users
  if (poolRisk > 40 && profile.riskTolerance === 'conservative') {
    warnings.push(`⚠️ This pool's risk level may exceed comfort zone for conservative investors.`);
  }
  
  // Liquidity need mismatch
  if (profile.liquidityNeeds === 'immediate' && pool.totalValueLocked < 500_000) {
    warnings.push(`⚠️ Limited liquidity may not support immediate large withdrawals.`);
  }
  
  // New pool warning
  const poolAgeInDays = (Date.now() - pool.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (poolAgeInDays < 30) {
    warnings.push(`⚠️ Newly created pool (<30 days old) - limited historical data available.`);
  }
  
  return warnings;
}

// Helper: Generate considerations
function generateConsiderations(pool: PoolMetrics, profile: UserProfile): string[] {
  const considerations: string[] = [];
  
  // APY expectation management
  considerations.push(`✓ Historical APY is not a guarantee of future returns.`);
  
  // Fee tier explanation
  considerations.push(`✓ ${pool.feeTier} basis point fee tier optimized for this pool's volatility profile.`);
  
  // Time horizon alignment
  if (profile.investmentHorizon === '1-month' || profile.investmentHorizon === '3-months') {
    considerations.push(`✓ Short time horizon may not allow IL to be fully offset by fees.`);
  } else {
    considerations.push(`✓ Longer time horizon allows fee accumulation to potentially offset IL.`);
  }
  
  // Gas cost consideration
  considerations.push(`✓ Consider gas costs when entering/exiting positions, especially for smaller amounts.`);
  
  return considerations;
}
```

**Explanation Output Example**:

```json
{
  "poolName": "USDC/USDT",
  "poolAddress": "0x1234...",
  "riskLevel": "ULTRA_LOW",
  "riskScore": 3,
  "userRiskScore": 25,
  "matchReason": "This pool is significantly more conservative than your profile, prioritizing capital preservation (user risk: 25, pool risk: 3).",
  "riskBreakdown": {
    "assetPairRisk": {
      "score": 2,
      "explanation": "Ultra-low risk: Both assets are stablecoins pegged to the same value, minimizing impermanent loss."
    },
    "volatilityRisk": {
      "score": 0.5,
      "explanation": "Low volatility: Prices have been stable (0.5% annualized vol), suitable for income generation."
    },
    "liquidityRisk": {
      "score": 10,
      "explanation": "Very deep liquidity ($50.00M TVL) with very stable participation."
    },
    "ilRisk": {
      "score": 0.1,
      "explanation": "Negligible impermanent loss risk based on historical data (<0.1%)."
    }
  },
  "metrics": {
    "apy30d": 5.2,
    "tvl": 50000000,
    "feeTier": 1,
    "volumeLast24h": 5000000
  },
  "rankingFactors": {
    "capitalEfficiency": "Risk-adjusted APY: 5.05%",
    "liquidityStability": "Liquidity coefficient of variation: 8.5%",
    "feeStructure": "1 bps fee tier generating $500 daily"
  },
  "warnings": [],
  "considerations": [
    "✓ Historical APY is not a guarantee of future returns.",
    "✓ 1 basis point fee tier optimized for this pool's volatility profile.",
    "✓ Longer time horizon allows fee accumulation to potentially offset IL.",
    "✓ Consider gas costs when entering/exiting positions, especially for smaller amounts."
  ]
}
```

---

## 5. Output Layer

### 5.1 Recommendation Response Format

```typescript
interface RecommendationResponse {
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

// Standard disclaimers
const STANDARD_DISCLAIMERS = [
  "Past performance does not guarantee future results.",
  "All investments carry risk of loss. You may lose some or all of your invested capital.",
  "Recommendations are based on current on-chain data and may change as market conditions evolve.",
  "This is not financial advice. Conduct your own research before investing.",
  "Impermanent loss is a real risk in liquidity provision and may exceed fee earnings.",
  "Smart contract risk exists - audit reports do not eliminate all vulnerabilities.",
  "Always verify pool addresses and asset contracts before depositing funds."
];
```

### 5.2 Frontend Display

Recommendations displayed in the Next.js frontend:

```typescript
// UI Component Structure
<RecommendationsView>
  <UserRiskSummary userRiskScore={25} riskTolerance="moderate" />
  
  <RecommendationsList>
    {recommendations.map(rec => (
      <PoolCard
        key={rec.pool.poolAddress}
        poolName={rec.explanation.poolName}
        riskLevel={rec.explanation.riskLevel}
        riskScore={rec.explanation.riskScore}
        apy={rec.pool.apy30d}
        tvl={rec.pool.totalValueLocked}
        
        // Expandable details
        explanation={rec.explanation}
        warnings={rec.explanation.warnings}
        considerations={rec.explanation.considerations}
        
        // Action buttons
        onReview={() => navigateToReview(rec.pool)}
        onLearnMore={() => showDetailedAnalysis(rec)}
      />
    ))}
  </RecommendationsList>
  
  <DisclaimerFooter disclaimers={STANDARD_DISCLAIMERS} />
</RecommendationsView>
```

**User Flow**:
1. User sees top 10 ranked pools
2. Each pool shows: Name, Risk Level, APY, TVL, Risk Score
3. User expands pool → sees detailed explanation
4. User clicks "Review" → navigates to detailed review page
5. User reviews allocation → signs transaction → executes deposit

---

## 6. Technical Architecture

### 6.1 System Components

```
┌──────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                        │
│  - Risk Profiling UI   - Recommendation Display               │
│  - Authorization Flow  - Portfolio Dashboard                  │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS/REST
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              Recommendation Engine (Node.js/TypeScript)       │
│  /api/recommendations/generate                                │
│  /api/recommendations/refresh                                 │
│  /api/recommendations/explain                                 │
└────────┬───────────────┬────────────────┬─────────────────────┘
         │               │                │
         ▼               ▼                ▼
  ┌─────────────┐  ┌──────────┐   ┌─────────────────┐
  │  MongoDB    │  │The Graph │   │ Uniswap v4 RPC  │
  │  (Profiles) │  │ (History)│   │  (Real-time)    │
  └─────────────┘  └──────────┘   └─────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│              Smart Contracts (Polygon/Sepolia)                │
│  - PoolVault (Execution only, no recommendation logic)        │
│  - AaveAdapter (Yield generation)                             │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 API Endpoints

**Generate Recommendations**
```typescript
POST /api/recommendations/generate
Authorization: Bearer <JWT>

Request:
{
  "userId": "507f1f77bcf86cd799439011",
  "refreshData": true  // Optional: force re-fetch on-chain data
}

Response:
{
  "success": true,
  "recommendations": RecommendationResponse,
  "cached": false,
  "generatedAt": "2024-02-03T10:30:00Z"
}
```

**Refresh Recommendations**
```typescript
POST /api/recommendations/refresh
Authorization: Bearer <JWT>

Request:
{
  "userId": "507f1f77bcf86cd799439011"
}

Response:
{
  "success": true,
  "updated": true,
  "newRecommendationsCount": 10,
  "changesDetected": ["POOL_001", "POOL_005"] // Pools with updated metrics
}
```

**Explain Recommendation**
```typescript
GET /api/recommendations/explain/:poolAddress
Authorization: Bearer <JWT>

Response:
{
  "explanation": RecommendationExplanation,
  "comparisonWithUserProfile": { ... },
  "historicalPerformance": { ... }
}
```

### 6.3 Data Pipeline

**Step 1: Data Ingestion**
- Frequency: Every 15 minutes
- Sources: The Graph (historical), Uniswap v4 RPC (real-time)
- Storage: Redis cache (5-minute TTL), PostgreSQL (historical archive)

```typescript
// Data ingestion job
async function ingestPoolData() {
  // 1. Fetch all Uniswap v4 pools
  const pools = await fetchAllUniv4Pools();
  
  // 2. For each pool, fetch metrics
  const poolMetrics = await Promise.all(
    pools.map(async (pool) => {
      const [onchain, historical] = await Promise.all([
        fetchRealTimeMetrics(pool.address),
        fetchHistoricalMetrics(pool.address, 90) // 90 days
      ]);
      
      return {
        ...pool,
        ...onchain,
        ...calculateDerivedMetrics(onchain, historical)
      };
    })
  );
  
  // 3. Classify assets
  const classified = await Promise.all(
    poolMetrics.map(async (pool) => ({
      ...pool,
      token0: { ...pool.token0, category: await classifyAsset(pool.token0.address) },
      token1: { ...pool.token1, category: await classifyAsset(pool.token1.address) }
    }))
  );
  
  // 4. Cache and store
  await cachePoolData(classified);
  await archivePoolData(classified);
  
  return classified;
}
```

**Step 2: Recommendation Generation**
```typescript
async function generateRecommendations(userId: string): Promise<RecommendationResponse> {
  // 1. Fetch user profile
  const userProfile = await fetchUserProfile(userId);
  
  // 2. Calculate user risk score
  const userRiskScore = calculateUserRiskScore(userProfile);
  
  // 3. Fetch pool data (cached)
  const allPools = await getCachedPoolData();
  
  // 4. Calculate pool risk scores
  const poolsWithRisk = allPools.map(pool => ({
    pool,
    riskScore: calculatePoolRiskScore(pool)
  }));
  
  // 5. Filter by risk match
  const matchedPools = poolsWithRisk.filter(p => {
    const band = calculateAcceptableRiskBand(userRiskScore);
    return p.riskScore >= band.min && p.riskScore <= band.max;
  });
  
  // 6. Rank pools
  const rankedPools = rankMatchedPools(
    matchedPools.map(p => p.pool),
    userProfile
  );
  
  // 7. Generate explanations
  const recommendations = rankedPools.map(ranked => ({
    pool: ranked.pool,
    explanation: generateExplanation(ranked, userRiskScore, userProfile),
    rankingScore: ranked.rankingScore
  }));
  
  // 8. Construct response
  return {
    userId,
    walletAddress: userProfile.walletAddress,
    userProfile,
    userRiskScore,
    recommendations,
    generatedAt: new Date(),
    dataSourceTimestamp: await getLastDataUpdate(),
    totalPoolsEvaluated: allPools.length,
    totalPoolsMatched: matchedPools.length,
    algorithmVersion: '1.0.0',
    disclaimers: STANDARD_DISCLAIMERS
  };
}
```

### 6.4 Caching Strategy

- **Pool Data**: Redis cache, 5-minute TTL
- **User Recommendations**: Redis cache, 1-hour TTL (invalidate on profile update)
- **Asset Classifications**: Redis cache, 24-hour TTL
- **Historical Data**: PostgreSQL, permanent storage

### 6.5 Performance Optimization

1. **Parallel Processing**: Fetch and score pools concurrently
2. **Incremental Updates**: Only recalculate changed pools
3. **Pre-computation**: Calculate risk scores during ingestion
4. **Pagination**: Return top 10, fetch more on demand
5. **CDN Caching**: Cache static recommendation UI components

---

## 7. Security & Trust Model

### 7.1 No Autonomous Execution

**Critical Constraint**: The agent NEVER executes transactions autonomously.

```typescript
// ❌ FORBIDDEN
async function autoExecuteTrade(recommendation) {
  // Agent cannot call this without user signature
  await poolVault.deposit(amount);
}

// ✅ CORRECT
async function presentRecommendationToUser(recommendation) {
  // User reviews, then signs transaction in their wallet
  const userApproval = await promptUserSignature(recommendation);
  if (userApproval.signed) {
    // User's wallet executes transaction, not the agent
    return userApproval.txHash;
  }
}
```

### 7.2 No Private Key Access

- Agent operates entirely off-chain
- No access to user private keys or Circle wallet secrets
- All transactions initiated by user's MetaMask signature

### 7.3 Data Privacy

**On-Chain**:
- Only wallet address and risk score stored
- No PII (age, income, etc.) on-chain

**Off-Chain (MongoDB)**:
- User profile data encrypted at rest
- Access controlled by JWT authentication
- No sharing with third parties

### 7.4 Algorithm Transparency

- All risk scoring formulas published in documentation
- Algorithm version tracked in responses
- Users can verify calculations

**Example Verification**:
```typescript
// User can verify their risk score
const myProfile = {
  riskTolerance: 'moderate',
  ageRange: '25-40',
  investmentHorizon: '1-year',
  incomeRange: '75k-150k',
  liquidityNeeds: 'medium-term',
  previousDeFiExperience: 'intermediate'
};

const calculatedScore = calculateUserRiskScore(myProfile);
console.log(calculatedScore); // 35 + 5 + 5 + 0 + 0 + 3 = 48
```

### 7.5 Audit Trail

Every recommendation logged for auditability:

```typescript
interface AuditLog {
  timestamp: Date;
  userId: string;
  userRiskScore: number;
  poolsEvaluated: number;
  poolsRecommended: number;
  topRecommendation: {
    poolAddress: string;
    riskScore: number;
    rankingScore: number;
  };
  algorithmVersion: string;
  dataSourceVersion: string;
}
```

---

## 8. Constraints & Limitations

### 8.1 No Price Predictions

❌ **The agent does NOT**:
- Predict future token prices
- Forecast market trends
- Use ML models for price movement

✅ **The agent DOES**:
- Use historical volatility to assess risk
- Use current APY as trailing performance metric
- Classify assets by observable characteristics

### 8.2 No Guarantees

All recommendations include disclaimers:
- "Past performance does not guarantee future results"
- "All investments carry risk of loss"
- "APY is historical and may change"

### 8.3 Data Staleness

- Pool data refreshed every 15 minutes
- User sees timestamp of data source
- Stale data (>30 minutes) triggers warning

### 8.4 Limited to Uniswap v4

- Initial version only supports Uniswap v4 pools
- Future versions may integrate other DEXs (Balancer, Curve)

### 8.5 No Tax/Legal Advice

- Agent does not provide tax optimization guidance
- Does not consider jurisdiction-specific regulations
- Users responsible for compliance

---

## 9. Extensibility & Future Enhancements

### 9.1 Multi-Protocol Support

Extend to other DeFi protocols:
- Balancer weighted pools
- Curve stable pools
- Aave lending markets

```typescript
interface ProtocolAdapter {
  fetchPools(): Promise<Pool[]>;
  calculateRiskScore(pool: Pool): number;
  generateExplanation(pool: Pool): string;
}

class UniversalRecommendationEngine {
  adapters: Map<string, ProtocolAdapter>;
  
  async aggregateRecommendations(userProfile: UserProfile) {
    const allRecommendations = await Promise.all(
      Array.from(this.adapters.values()).map(adapter =>
        adapter.fetchPools().then(pools =>
          this.rankPools(pools, userProfile)
        )
      )
    );
    
    return this.mergeAndRank(allRecommendations);
  }
}
```

### 9.2 Dynamic Risk Tolerance

Allow users to override risk bands for specific pools:

```typescript
interface OverridePreferences {
  allowHigherRisk: boolean;        // Accept pools above user risk score
  riskTolerance: number;           // Manual override (0-100)
  preferredAssets: string[];       // Whitelist specific tokens
  excludedAssets: string[];        // Blacklist specific tokens
}
```

### 9.3 Portfolio Optimization

Multi-pool allocation recommendations:

```typescript
interface PortfolioRecommendation {
  totalAllocation: number;         // USD amount to invest
  allocations: {
    pool: PoolMetrics;
    percentage: number;            // % of total
    amount: number;                // USD amount
    reasoning: string;
  }[];
  diversificationScore: number;    // 0-100, higher = more diversified
  aggregateRisk: number;           // Weighted average risk
  expectedAPY: number;             // Weighted average APY
}
```

### 9.4 Backtesting & Historical Analysis

Show users how recommendations would have performed historically:

```typescript
interface BacktestResult {
  period: { start: Date; end: Date };
  initialInvestment: number;
  finalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  
  events: {
    timestamp: Date;
    action: 'recommend' | 'un-recommend';
    reason: string;
  }[];
}
```

### 9.5 Real-Time Alerts

Notify users when pool metrics change significantly:

```typescript
interface Alert {
  poolAddress: string;
  alertType: 'risk_increase' | 'risk_decrease' | 'apy_change' | 'liquidity_warning';
  previousValue: number;
  newValue: number;
  recommendation: 'review' | 'consider_exit' | 'no_action';
  explanation: string;
}
```

---

## 10. Implementation Roadmap

### Phase 1: MVP (Weeks 1-4)
- [ ] User risk scoring algorithm
- [ ] Basic pool risk scoring (TVL, volatility, asset category)
- [ ] Simple matching logic (risk band filtering)
- [ ] Top 10 ranking
- [ ] Basic explanation generation
- [ ] Frontend display components

### Phase 2: Enhanced Risk Modeling (Weeks 5-8)
- [ ] IL risk calculation from historical data
- [ ] Liquidity stability scoring
- [ ] Fee tier efficiency analysis
- [ ] Advanced asset classification service
- [ ] Preference alignment scoring

### Phase 3: Data Pipeline (Weeks 9-12)
- [ ] The Graph integration for historical data
- [ ] Real-time RPC polling
- [ ] Redis caching layer
- [ ] PostgreSQL historical archive
- [ ] Automated data quality checks

### Phase 4: User Experience (Weeks 13-16)
- [ ] Detailed explanation UI
- [ ] Risk breakdown visualizations
- [ ] Comparison tools
- [ ] Portfolio simulator
- [ ] Recommendation history

### Phase 5: Advanced Features (Weeks 17-20)
- [ ] Multi-pool portfolio allocation
- [ ] Backtesting engine
- [ ] Real-time alerts
- [ ] Dynamic risk override
- [ ] Multi-protocol support (Balancer, Curve)

---

## 11. Testing & Validation

### 11.1 Unit Tests

Test individual components:

```typescript
describe('calculateUserRiskScore', () => {
  it('should return 20 for ultra-conservative profile', () => {
    const profile = {
      riskTolerance: 'conservative',
      ageRange: 'over-70',
      investmentHorizon: '1-month',
      incomeRange: 'under-30k',
      liquidityNeeds: 'immediate',
      previousDeFiExperience: 'none'
    };
    
    expect(calculateUserRiskScore(profile)).toBe(0); // Clamped to 0
  });
  
  it('should return consistent scores for same input', () => {
    const profile = { /* ... */ };
    const score1 = calculateUserRiskScore(profile);
    const score2 = calculateUserRiskScore(profile);
    
    expect(score1).toBe(score2); // Deterministic
  });
});

describe('calculatePoolRiskScore', () => {
  it('should score USDC/USDT pool as ultra-low risk', () => {
    const pool = {
      token0: { category: 'stablecoin' },
      token1: { category: 'stablecoin' },
      totalValueLocked: 50000000,
      impliedVolatility: 0.5,
      liquidityStability: 0.1,
      impermanentLossRisk: 0.1,
      // ...
    };
    
    expect(calculatePoolRiskScore(pool)).toBeLessThan(10);
  });
});
```

### 11.2 Integration Tests

Test end-to-end recommendation flow:

```typescript
describe('Recommendation Generation', () => {
  it('should generate recommendations for moderate risk user', async () => {
    const userId = 'test-user-123';
    const response = await generateRecommendations(userId);
    
    expect(response.recommendations).toHaveLength(10);
    expect(response.recommendations[0].rankingScore).toBeGreaterThan(
      response.recommendations[1].rankingScore
    ); // Sorted descending
  });
  
  it('should only recommend pools within user risk band', async () => {
    const userId = 'conservative-user';
    const response = await generateRecommendations(userId);
    
    response.recommendations.forEach(rec => {
      expect(rec.explanation.riskScore).toBeLessThanOrEqual(
        response.userRiskScore
      );
    });
  });
});
```

### 11.3 Simulation Tests

Test with historical data:

```typescript
describe('Historical Backtesting', () => {
  it('should have recommended profitable pools in 2023', async () => {
    const historicalPools = await fetchHistoricalPoolData('2023-01-01', '2023-12-31');
    const recommendations = await rankPools(historicalPools, testUserProfile);
    
    const topPool = recommendations[0];
    const actualPerformance = await getHistoricalPerformance(topPool, '2023');
    
    expect(actualPerformance.totalReturn).toBeGreaterThan(0);
  });
});
```

### 11.4 Edge Case Tests

```typescript
describe('Edge Cases', () => {
  it('should handle user with risk score 100', () => {
    const recommendations = filterPoolsByRisk(allPools, 100);
    expect(recommendations.length).toBeGreaterThan(0); // Can accept all pools
  });
  
  it('should handle empty pool list gracefully', async () => {
    const response = await generateRecommendations('user', []);
    expect(response.recommendations).toEqual([]);
    expect(response.totalPoolsEvaluated).toBe(0);
  });
  
  it('should handle stale data', async () => {
    const staleTimestamp = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    mockDataTimestamp(staleTimestamp);
    
    const response = await generateRecommendations('user');
    expect(response.warnings).toContain('Data may be stale');
  });
});
```

---

## 12. Monitoring & Observability

### 12.1 Key Metrics

Track system health:

```typescript
interface SystemMetrics {
  // Performance
  avgRecommendationGenerationTime: number; // ms
  p95RecommendationGenerationTime: number;
  cacheHitRate: number;                    // %
  
  // Data Quality
  poolDataFreshnessMedian: number;         // minutes
  poolDataFailureRate: number;             // %
  assetClassificationAccuracy: number;     // %
  
  // User Engagement
  recommendationsGenerated24h: number;
  uniqueUsers24h: number;
  avgPoolsRecommendedPerUser: number;
  
  // Business Metrics
  recommendationClickRate: number;         // %
  conversionRate: number;                  // % of views → deposits
}
```

### 12.2 Alerting

Alert on anomalies:
- Data fetch failures > 5% for 15 minutes
- Recommendation generation time > 10 seconds
- No pools matched for 10+ consecutive users
- Risk scoring drift (significant changes in score distribution)

### 12.3 Logging

Structured logging for debugging:

```typescript
logger.info('Recommendation generated', {
  userId,
  userRiskScore,
  poolsEvaluated: allPools.length,
  poolsMatched: matchedPools.length,
  poolsRecommended: recommendations.length,
  topPoolRiskScore: recommendations[0]?.explanation.riskScore,
  generationTimeMs: performance.now() - startTime,
  cacheHit,
  algorithmVersion: '1.0.0'
});
```

---

## 13. Compliance & Disclaimers

### 13.1 Standard Disclaimers

Display prominently on recommendation UI:

```
⚠️ IMPORTANT RISK DISCLOSURES

1. NOT FINANCIAL ADVICE: These recommendations are automated suggestions based on 
   on-chain data and your stated risk profile. They do not constitute financial, 
   investment, or legal advice.

2. PAST PERFORMANCE: Historical returns do not guarantee future performance. APY 
   rates shown are trailing metrics and may change at any time.

3. RISK OF LOSS: All DeFi investments carry risk of loss, including but not limited 
   to impermanent loss, smart contract vulnerabilities, and market volatility. 
   You may lose some or all of your invested capital.

4. IMPERMANENT LOSS: Providing liquidity to volatile asset pairs may result in 
   impermanent loss that exceeds fee earnings.

5. SMART CONTRACT RISK: Even audited smart contracts may contain undiscovered 
   vulnerabilities. No audit eliminates all risks.

6. NO GUARANTEES: This system makes no guarantees about returns, safety, or 
   suitability of any investment.

7. DO YOUR OWN RESEARCH: Always verify pool addresses, audit reports, and 
   asset contracts before depositing funds.

8. REGULATORY RISK: DeFi protocols may face changing regulatory environments. 
   Consult a legal professional regarding your jurisdiction.

By proceeding, you acknowledge that you have read and understood these risks.
```

### 13.2 Terms of Service Snippet

```
USER RESPONSIBILITY

The User acknowledges that:
a) All investment decisions are made solely by the User
b) The Platform provides information only and does not execute trades automatically
c) The User is responsible for verifying all information before transacting
d) The Platform is not liable for losses resulting from User decisions
e) Risk scores and recommendations are estimates based on historical data
f) No prediction or forecast is made about future performance

LIMITATION OF LIABILITY

The Platform shall not be liable for:
a) Losses resulting from impermanent loss
b) Smart contract failures or exploits
c) Market volatility or price changes
d) Data inaccuracies or delays
e) User error in executing transactions

Maximum liability is limited to the platform fees paid by the User, if any.
```

---

## 14. Conclusion

This design document specifies a **deterministic, transparent, and auditable** financial recommendation agent for HI.FI's DeFi platform. The system:

✅ **Operates deterministically**: No ML black boxes, no speculative predictions  
✅ **Prioritizes transparency**: Every recommendation is explainable  
✅ **Maintains user control**: Never executes trades autonomously  
✅ **Respects privacy**: No PII on-chain  
✅ **Is auditable**: All calculations are public and reproducible  

### Core Philosophy

**The agent is a decision-support tool, not an autonomous trader.**

It maps observable on-chain characteristics to user-defined risk preferences, producing recommendations that users can verify, understand, and choose to act upon—but only with explicit authorization.

### Next Steps

1. **Review & Feedback**: Gather stakeholder feedback on design
2. **Prototype**: Build MVP with basic risk scoring and matching
3. **Test**: Validate with historical data and edge cases
4. **Deploy**: Launch beta version with limited user group
5. **Iterate**: Enhance based on user feedback and performance

---

## Appendix A: Risk Scoring Examples

### Example 1: Conservative Retiree

**User Profile**:
- Age: 68
- Income: $45k
- Horizon: 3 months
- Tolerance: Conservative
- Liquidity: Short-term

**User Risk Score**: `20 - 10 - 5 - 5 - 5 + 0 = -5 → 0`

**Matched Pools**:
- USDC/USDT (risk 2)
- DAI/USDC (risk 3)

### Example 2: Young Tech Worker

**User Profile**:
- Age: 28
- Income: $120k
- Horizon: 2+ years
- Tolerance: Growth
- Liquidity: Long-term

**User Risk Score**: `70 + 5 + 10 + 5 + 5 + 3 = 98 → 98`

**Matched Pools**:
- ETH/AAVE (risk 85)
- WBTC/UNI (risk 92)
- MATIC/LINK (risk 78)

### Example 3: Middle-Aged Professional

**User Profile**:
- Age: 45
- Income: $90k
- Horizon: 1 year
- Tolerance: Balanced
- Liquidity: Medium-term

**User Risk Score**: `50 + 0 + 5 + 0 + 0 + 0 = 55 → 55`

**Matched Pools**:
- WETH/USDC (risk 45)
- stETH/ETH (risk 52)

---

## Appendix B: Pool Risk Score Examples

### USDC/USDT Stablecoin Pool

```typescript
{
  token0: { symbol: 'USDC', category: 'stablecoin' },
  token1: { symbol: 'USDT', category: 'stablecoin' },
  totalValueLocked: 50000000,
  liquidityStability: 0.08,
  impliedVolatility: 0.5,
  priceRangeLast30d: { percentageChange: 0.2 },
  impermanentLossRisk: 0.05,
  feeTier: 1
}

// Risk Calculation:
assetRisk = 2 (stable/stable bonus)
volatilityRisk = 0.25 (ultra low)
liquidityRisk = (10 * 0.7 + 8 * 0.3) = 9.4 (very deep, stable)
ilRisk = 0.05

compositeRisk = 2 * 0.4 + 0.25 * 0.25 + 9.4 * 0.2 + 0.05 * 0.15
              = 0.8 + 0.0625 + 1.88 + 0.0075
              = 2.75 ≈ 3

Risk Level: ULTRA_LOW
```

### WETH/USDC Blue Chip Pool

```typescript
{
  token0: { symbol: 'WETH', category: 'wrapped-native' },
  token1: { symbol: 'USDC', category: 'stablecoin' },
  totalValueLocked: 5000000,
  liquidityStability: 0.15,
  impliedVolatility: 45,
  priceRangeLast30d: { percentageChange: 18 },
  impermanentLossRisk: 12,
  feeTier: 30
}

// Risk Calculation:
assetRisk = (30 + 5) / 2 = 17.5
volatilityRisk = (45/2 * 0.6 + 18 * 0.4) = 20.7
liquidityRisk = (25 * 0.7 + 15 * 0.3) = 22
ilRisk = 12

compositeRisk = 17.5 * 0.4 + 20.7 * 0.25 + 22 * 0.2 + 12 * 0.15
              = 7 + 5.175 + 4.4 + 1.8
              = 18.375 ≈ 18

Risk Level: LOW
```

### ALT/ETH Volatile Pool

```typescript
{
  token0: { symbol: 'ALT', category: 'volatile' },
  token1: { symbol: 'ETH', category: 'wrapped-native' },
  totalValueLocked: 500000,
  liquidityStability: 0.45,
  impliedVolatility: 120,
  priceRangeLast30d: { percentageChange: 85 },
  impermanentLossRisk: 35,
  feeTier: 100
}

// Risk Calculation:
assetRisk = (80 + 30) / 2 = 55
volatilityRisk = (120/2 * 0.6 + 85 * 0.4) = 70
liquidityRisk = (50 * 0.7 + 45 * 0.3) = 48.5
ilRisk = 35

compositeRisk = 55 * 0.4 + 70 * 0.25 + 48.5 * 0.2 + 35 * 0.15
              = 22 + 17.5 + 9.7 + 5.25
              = 54.45 ≈ 54

Risk Level: MEDIUM
```

---

**Document Version**: 1.0.0  
**Last Updated**: 2024-02-03  
**Author**: HI.FI Development Team  
**Status**: Design Phase
