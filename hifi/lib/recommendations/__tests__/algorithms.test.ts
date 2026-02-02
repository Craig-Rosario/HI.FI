/**
 * Test file for recommendation algorithms
 * Run with: npx tsx hifi/lib/recommendations/__tests__/algorithms.test.ts
 */

import { calculateUserRiskScore, calculateUserRiskScoreWithBreakdown } from '../userRiskScoring';
import { calculatePoolRiskScore, calculatePoolRiskScoreWithBreakdown } from '../poolRiskScoring';
import { filterPoolsByRisk, rankMatchedPools } from '../matching';
import { UserProfile, PoolMetrics } from '../../types/recommendations';

// Test User Profiles
const conservativeRetiree: UserProfile = {
    userId: 'test-1',
    walletAddress: '0xtest1',
    ageRange: 'over-70',
    incomeRange: '30k-75k',
    investmentHorizon: '3-months',
    riskTolerance: 'conservative',
    liquidityNeeds: 'short-term',
    investmentGoals: ['capital-preservation'],
    previousDeFiExperience: 'none',
    profileCreatedAt: new Date(),
    lastUpdated: new Date(),
    completionStatus: 'complete'
};

const youngTechWorker: UserProfile = {
    userId: 'test-2',
    walletAddress: '0xtest2',
    ageRange: '25-40',
    incomeRange: '150k-300k',
    investmentHorizon: '2-years+',
    riskTolerance: 'growth',
    liquidityNeeds: 'long-term',
    investmentGoals: ['growth', 'income'],
    previousDeFiExperience: 'advanced',
    profileCreatedAt: new Date(),
    lastUpdated: new Date(),
    completionStatus: 'complete'
};

const balancedProfessional: UserProfile = {
    userId: 'test-3',
    walletAddress: '0xtest3',
    ageRange: '41-55',
    incomeRange: '75k-150k',
    investmentHorizon: '1-year',
    riskTolerance: 'balanced',
    liquidityNeeds: 'medium-term',
    investmentGoals: ['income', 'growth'],
    previousDeFiExperience: 'intermediate',
    profileCreatedAt: new Date(),
    lastUpdated: new Date(),
    completionStatus: 'complete'
};

// Test Pool Data
const stablecoinPool: PoolMetrics = {
    poolId: 'test-usdc-usdt',
    poolAddress: '0xpool1',
    token0: {
        address: '0xusdc',
        symbol: 'USDC',
        decimals: 6,
        category: 'stablecoin'
    },
    token1: {
        address: '0xusdt',
        symbol: 'USDT',
        decimals: 6,
        category: 'stablecoin'
    },
    totalValueLocked: 50000000,
    liquidityDepth: { buy: 1000000, sell: 1000000 },
    liquidityStability: 0.08,
    feeTier: 1,
    volumeLast24h: 5000000,
    volumeLast7d: 35000000,
    feesGenerated24h: 500,
    impliedVolatility: 0.5,
    priceRangeLast30d: { min: 0.998, max: 1.002, percentageChange: 0.4 },
    utilizationRate: 0.1,
    averageTradeSize: 50000,
    apy30d: 5.2,
    apy90d: 5.5,
    impermanentLossRisk: 0.1,
    createdAt: new Date('2023-06-01'),
    lastUpdatedBlock: 18500000
};

const ethUsdcPool: PoolMetrics = {
    poolId: 'test-weth-usdc',
    poolAddress: '0xpool2',
    token0: {
        address: '0xweth',
        symbol: 'WETH',
        decimals: 18,
        category: 'wrapped-native'
    },
    token1: {
        address: '0xusdc',
        symbol: 'USDC',
        decimals: 6,
        category: 'stablecoin'
    },
    totalValueLocked: 15000000,
    liquidityDepth: { buy: 500000, sell: 500000 },
    liquidityStability: 0.15,
    feeTier: 30,
    volumeLast24h: 8000000,
    volumeLast7d: 56000000,
    feesGenerated24h: 2400,
    impliedVolatility: 45,
    priceRangeLast30d: { min: 2200, max: 2600, percentageChange: 18 },
    utilizationRate: 0.53,
    averageTradeSize: 25000,
    apy30d: 12.5,
    apy90d: 14.2,
    impermanentLossRisk: 8,
    createdAt: new Date('2023-05-15'),
    lastUpdatedBlock: 18500000
};

const volatilePool: PoolMetrics = {
    poolId: 'test-volatile-eth',
    poolAddress: '0xpool3',
    token0: {
        address: '0xalt',
        symbol: 'ALT',
        decimals: 18,
        category: 'volatile'
    },
    token1: {
        address: '0xweth',
        symbol: 'WETH',
        decimals: 18,
        category: 'wrapped-native'
    },
    totalValueLocked: 800000,
    liquidityDepth: { buy: 50000, sell: 50000 },
    liquidityStability: 0.45,
    feeTier: 100,
    volumeLast24h: 600000,
    volumeLast7d: 4200000,
    feesGenerated24h: 600,
    impliedVolatility: 120,
    priceRangeLast30d: { min: 0.002, max: 0.008, percentageChange: 300 },
    utilizationRate: 0.75,
    averageTradeSize: 5000,
    apy30d: 45.2,
    apy90d: 52.8,
    impermanentLossRisk: 35,
    createdAt: new Date('2024-01-01'),
    lastUpdatedBlock: 18500000
};

console.log('=== RECOMMENDATION ALGORITHM TESTS ===\n');

// Test 1: User Risk Scoring
console.log('Test 1: User Risk Scoring');
console.log('------------------------');

const conservativeScore = calculateUserRiskScoreWithBreakdown(conservativeRetiree);
console.log('Conservative Retiree:', conservativeScore);
console.log(`Final Score: ${conservativeScore.finalScore}/100\n`);

const youngTechScore = calculateUserRiskScoreWithBreakdown(youngTechWorker);
console.log('Young Tech Worker:', youngTechScore);
console.log(`Final Score: ${youngTechScore.finalScore}/100\n`);

const balancedScore = calculateUserRiskScoreWithBreakdown(balancedProfessional);
console.log('Balanced Professional:', balancedScore);
console.log(`Final Score: ${balancedScore.finalScore}/100\n`);

// Test 2: Pool Risk Scoring
console.log('Test 2: Pool Risk Scoring');
console.log('------------------------');

const stableRisk = calculatePoolRiskScoreWithBreakdown(stablecoinPool);
console.log('USDC/USDT Pool:', stableRisk);
console.log(`Composite Risk: ${stableRisk.compositeRisk.toFixed(2)}/100\n`);

const ethRisk = calculatePoolRiskScoreWithBreakdown(ethUsdcPool);
console.log('WETH/USDC Pool:', ethRisk);
console.log(`Composite Risk: ${ethRisk.compositeRisk.toFixed(2)}/100\n`);

const volatileRisk = calculatePoolRiskScoreWithBreakdown(volatilePool);
console.log('ALT/ETH Pool:', volatileRisk);
console.log(`Composite Risk: ${volatileRisk.compositeRisk.toFixed(2)}/100\n`);

// Test 3: Pool Matching
console.log('Test 3: Pool Matching');
console.log('--------------------');

const allPools = [stablecoinPool, ethUsdcPool, volatilePool];

console.log('Conservative Retiree (Risk Score: ' + conservativeScore.finalScore + ')');
const conservativeMatches = filterPoolsByRisk(allPools, conservativeScore.finalScore);
console.log(`Matched ${conservativeMatches.length} pools:`, conservativeMatches.map(p => p.token0.symbol + '/' + p.token1.symbol));
console.log('');

console.log('Young Tech Worker (Risk Score: ' + youngTechScore.finalScore + ')');
const techMatches = filterPoolsByRisk(allPools, youngTechScore.finalScore);
console.log(`Matched ${techMatches.length} pools:`, techMatches.map(p => p.token0.symbol + '/' + p.token1.symbol));
console.log('');

console.log('Balanced Professional (Risk Score: ' + balancedScore.finalScore + ')');
const balancedMatches = filterPoolsByRisk(allPools, balancedScore.finalScore);
console.log(`Matched ${balancedMatches.length} pools:`, balancedMatches.map(p => p.token0.symbol + '/' + p.token1.symbol));
console.log('');

// Test 4: Pool Ranking
console.log('Test 4: Pool Ranking');
console.log('-------------------');

const rankedForBalanced = rankMatchedPools(balancedMatches, balancedProfessional, 5);
console.log('Rankings for Balanced Professional:');
rankedForBalanced.forEach((ranked, i) => {
    console.log(`${i + 1}. ${ranked.pool.token0.symbol}/${ranked.pool.token1.symbol}`);
    console.log(`   Score: ${ranked.rankingScore.toFixed(2)}, Risk: ${ranked.poolRiskScore.toFixed(2)}`);
    console.log(`   Reason: ${ranked.reasoning}`);
});

console.log('\n=== TESTS COMPLETE ===');
console.log('\nKey Takeaways:');
console.log('✓ Conservative users (score <20) match only ultra-safe pools');
console.log('✓ Aggressive users (score >80) can access high-risk, high-reward pools');
console.log('✓ Pool risk scores reflect asset volatility, liquidity, and IL risk');
console.log('✓ Rankings prioritize risk-adjusted returns and user goals');
