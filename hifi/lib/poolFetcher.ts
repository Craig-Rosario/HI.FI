/**
 * Blockchain Pool Data Fetcher
 * Fetches real pool data from Arc testnet
 */

import { ethers } from 'ethers';
import { CONTRACTS, POOL_ADDRESSES, POOL_VAULT_ABI, PoolState } from './contracts';
import { PoolMetrics, AssetCategory } from './types/recommendations';

/**
 * Fetches real pool data from the blockchain
 * Connects to Arc testnet and queries deployed PoolVault contracts
 */
export async function fetchRealPoolData(): Promise<PoolMetrics[]> {
    try {
        const provider = new ethers.JsonRpcProvider(CONTRACTS.ARC.RPC);
        const pools: PoolMetrics[] = [];

        // Fetch data from all deployed pool contracts
        for (let i = 0; i < POOL_ADDRESSES.length; i++) {
            const poolAddress = POOL_ADDRESSES[i];

            try {
                const contract = new ethers.Contract(poolAddress, POOL_VAULT_ABI, provider);

                // Fetch pool data in parallel
                const [nav, threshold, state, totalShares] = await Promise.all([
                    contract.nav(),
                    contract.threshold(),
                    contract.state(),
                    contract.totalShares(),
                ]);

                // Convert BigInt values to numbers (USDC has 6 decimals)
                const navUSDC = Number(ethers.formatUnits(nav, 6));
                const thresholdUSDC = Number(ethers.formatUnits(threshold, 6));
                const totalSharesValue = Number(ethers.formatUnits(totalShares, 6));
                const isActive = state === BigInt(PoolState.Active);

                // Calculate progress percentage
                const progress = thresholdUSDC > 0 ? (navUSDC / thresholdUSDC) * 100 : 0;

                // Calculate APY based on pool characteristics
                // For now, we'll use a base rate for USDC pools
                // In production, this would come from historical data or yield protocols
                const baseAPY = 5.0; // Base stablecoin yield
                const bonusAPY = isActive ? 3.0 : 0; // Bonus for active pools deploying to Aave
                const estimatedAPY = baseAPY + bonusAPY;

                // Create pool metrics object
                const poolMetrics: PoolMetrics = {
                    poolId: `pool-${i + 1}`,
                    poolAddress: poolAddress,
                    token0: {
                        address: CONTRACTS.ARC.USDC,
                        symbol: 'USDC',
                        decimals: 6,
                        category: 'stablecoin' as AssetCategory
                    },
                    token1: {
                        address: CONTRACTS.ARC.USDC,
                        symbol: 'USDC',
                        decimals: 6,
                        category: 'stablecoin' as AssetCategory
                    },
                    totalValueLocked: navUSDC,
                    liquidityDepth: {
                        buy: navUSDC * 0.2,
                        sell: navUSDC * 0.2
                    },
                    liquidityStability: 0.05, // Low volatility for stablecoin pools
                    feeTier: 0, // No swap fees in PoolVault
                    volumeLast24h: navUSDC * 0.1, // Estimated
                    volumeLast7d: navUSDC * 0.7, // Estimated
                    feesGenerated24h: 0, // Yield comes from Aave, not trading fees
                    impliedVolatility: 0.5, // Very low for stablecoins
                    priceRangeLast30d: {
                        min: 0.998,
                        max: 1.002,
                        percentageChange: 0.4
                    },
                    utilizationRate: isActive ? 0.9 : progress / 100, // High when active
                    averageTradeSize: navUSDC / (totalSharesValue || 1), // Average deposit size
                    apy30d: estimatedAPY,
                    apy90d: estimatedAPY * 1.05, // Slightly higher for longer term
                    impermanentLossRisk: 0.1, // Minimal for stablecoin pools
                    createdAt: new Date('2026-02-02'), // Deployment date
                    lastUpdatedBlock: await provider.getBlockNumber(),

                    // Additional metadata
                    state: isActive ? 'Active' : 'Collecting',
                    threshold: thresholdUSDC,
                    progress: progress,
                    totalShares: totalSharesValue
                };

                pools.push(poolMetrics);

            } catch (error) {
                console.error(`Error fetching data for pool ${poolAddress}:`, error);
                // Continue with other pools even if one fails
            }
        }

        return pools;

    } catch (error) {
        console.error('Error fetching pool data from blockchain:', error);
        throw new Error('Failed to fetch pool data from blockchain');
    }
}

/**
 * Cache for pool data to reduce RPC calls
 */
let poolDataCache: {
    data: PoolMetrics[];
    timestamp: number;
} | null = null;

const CACHE_DURATION = 60 * 1000; // 1 minute cache

/**
 * Fetches pool data with caching
 */
export async function fetchPoolDataWithCache(): Promise<PoolMetrics[]> {
    const now = Date.now();

    // Return cached data if still valid
    if (poolDataCache && (now - poolDataCache.timestamp) < CACHE_DURATION) {
        return poolDataCache.data;
    }

    // Fetch fresh data
    const data = await fetchRealPoolData();

    // Update cache
    poolDataCache = {
        data,
        timestamp: now
    };

    return data;
}
