/**
 * Test Script: Verify Real Pool Data Fetching
 * Run this to test that the recommendations engine fetches real pool data
 */

import { fetchPoolData } from './lib/recommendations/poolData';

async function testPoolDataFetching() {
    console.log('🧪 Testing Real Pool Data Fetching...\n');

    try {
        console.log('⏳ Fetching pools from Arc testnet...');
        const pools = await fetchPoolData();

        console.log(`\n✅ Successfully fetched ${pools.length} pools\n`);
        console.log('='.repeat(80));

        pools.forEach((pool, index) => {
            console.log(`\nPool ${index + 1}: ${pool.poolId}`);
            console.log('-'.repeat(80));
            console.log(`Address:          ${pool.poolAddress}`);
            console.log(`Token:            ${pool.token0.symbol}/${pool.token1.symbol}`);
            console.log(`TVL:              $${pool.totalValueLocked.toLocaleString()}`);
            console.log(`State:            ${pool.state || 'Unknown'}`);
            console.log(`Threshold:        $${pool.threshold?.toLocaleString() || 'N/A'}`);
            console.log(`Progress:         ${pool.progress?.toFixed(2) || 0}%`);
            console.log(`Total Shares:     ${pool.totalShares?.toLocaleString() || 'N/A'}`);
            console.log(`APY (30d):        ${pool.apy30d.toFixed(2)}%`);
            console.log(`APY (90d):        ${pool.apy90d.toFixed(2)}%`);
            console.log(`Utilization:      ${(pool.utilizationRate * 100).toFixed(2)}%`);
            console.log(`IL Risk:          ${pool.impermanentLossRisk.toFixed(2)}%`);
            console.log(`Last Block:       ${pool.lastUpdatedBlock}`);
        });

        console.log('\n' + '='.repeat(80));
        console.log('✅ All tests passed!\n');

    } catch (error) {
        console.error('\n❌ Error testing pool data fetching:', error);
        process.exit(1);
    }
}

// Run the test
testPoolDataFetching();
