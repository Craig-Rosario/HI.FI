/**
 * Debug Script: Test Pool Risk Scoring and Matching
 * Diagnose why pools aren't matching with user risk profiles
 */

import { fetchPoolData } from './lib/recommendations/poolData';
import { calculatePoolRiskScore } from './lib/recommendations/poolRiskScoring';
import { calculateUserRiskScore } from './lib/recommendations/userRiskScoring';
import { filterPoolsByRisk, calculateAcceptableRiskBand } from './lib/recommendations/matching';
import { UserProfile } from './lib/types/recommendations';

async function debugPoolMatching() {
    console.log('🔍 Debugging Pool Risk Matching...\n');

    try {
        // Fetch pools
        console.log('⏳ Fetching pools...');
        const pools = await fetchPoolData();
        console.log(`✅ Fetched ${pools.length} pools\n`);

        // Calculate pool risk scores
        console.log('📊 Pool Risk Scores:');
        console.log('='.repeat(80));
        pools.forEach((pool, index) => {
            const riskScore = calculatePoolRiskScore(pool);
            console.log(`Pool ${index + 1} (${pool.poolId}):`);
            console.log(`  Address: ${pool.poolAddress}`);
            console.log(`  Token Pair: ${pool.token0.symbol}/${pool.token1.symbol}`);
            console.log(`  Token Categories: ${pool.token0.category} / ${pool.token1.category}`);
            console.log(`  TVL: $${pool.totalValueLocked.toLocaleString()}`);
            console.log(`  Implied Volatility: ${pool.impliedVolatility}`);
            console.log(`  IL Risk: ${pool.impermanentLossRisk}%`);
            console.log(`  🎯 Pool Risk Score: ${riskScore}/100`);
            console.log('');
        });

        // Test with different user risk profiles
        const testProfiles: Array<{ name: string, riskScore: number }> = [
            { name: 'Very Conservative', riskScore: 10 },
            { name: 'Conservative', riskScore: 25 },
            { name: 'Moderate', riskScore: 50 },
            { name: 'Aggressive', riskScore: 75 },
            { name: 'Very Aggressive', riskScore: 90 }
        ];

        console.log('\n📋 Matching Tests:');
        console.log('='.repeat(80));

        testProfiles.forEach(profile => {
            const band = calculateAcceptableRiskBand(profile.riskScore);
            const matched = filterPoolsByRisk(pools, profile.riskScore);

            console.log(`\n${profile.name} User (Risk Score: ${profile.riskScore})`);
            console.log(`  Acceptable Risk Band: ${band.min} - ${band.max}`);
            console.log(`  Matched Pools: ${matched.length}`);

            if (matched.length > 0) {
                matched.forEach(pool => {
                    const poolRisk = calculatePoolRiskScore(pool);
                    console.log(`    ✅ ${pool.poolId} (Risk: ${poolRisk})`);
                });
            } else {
                console.log(`    ❌ No pools matched this risk profile`);
            }
        });

        // Summary
        console.log('\n' + '='.repeat(80));
        console.log('💡 Summary:');
        const allPoolRisks = pools.map(p => calculatePoolRiskScore(p));
        console.log(`  Pool Risk Range: ${Math.min(...allPoolRisks)} - ${Math.max(...allPoolRisks)}`);
        console.log(`  Average Pool Risk: ${(allPoolRisks.reduce((a, b) => a + b, 0) / allPoolRisks.length).toFixed(1)}`);

    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

// Run debug
debugPoolMatching();
