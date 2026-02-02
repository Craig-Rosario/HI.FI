/**
 * Mock Pool Data Service
 * Provides sample Uniswap v4 pool data for testing
 * In production, this would fetch from The Graph and RPC
 */

import { PoolMetrics, AssetCategory } from '../types/recommendations';

/**
 * Get mock pool data for testing
 * TODO: Replace with actual on-chain data fetching
 */
export async function fetchPoolData(): Promise<PoolMetrics[]> {
    // Sample pools representing different risk profiles
    return [
        // Ultra-low risk: Stablecoin pair
        {
            poolId: 'pool-usdc-usdt',
            poolAddress: '0x1234567890123456789012345678901234567890',
            token0: {
                address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                symbol: 'USDC',
                decimals: 6,
                category: 'stablecoin' as AssetCategory
            },
            token1: {
                address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                symbol: 'USDT',
                decimals: 6,
                category: 'stablecoin' as AssetCategory
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
        },

        // Low risk: ETH-USDC
        {
            poolId: 'pool-weth-usdc',
            poolAddress: '0x2345678901234567890123456789012345678901',
            token0: {
                address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                symbol: 'WETH',
                decimals: 18,
                category: 'wrapped-native' as AssetCategory
            },
            token1: {
                address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                symbol: 'USDC',
                decimals: 6,
                category: 'stablecoin' as AssetCategory
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
        },

        // Low risk: stETH-ETH (correlated pair)
        {
            poolId: 'pool-steth-eth',
            poolAddress: '0x3456789012345678901234567890123456789012',
            token0: {
                address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
                symbol: 'stETH',
                decimals: 18,
                category: 'liquid-staking' as AssetCategory
            },
            token1: {
                address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                symbol: 'WETH',
                decimals: 18,
                category: 'wrapped-native' as AssetCategory
            },
            totalValueLocked: 25000000,
            liquidityDepth: { buy: 800000, sell: 800000 },
            liquidityStability: 0.12,
            feeTier: 5,
            volumeLast24h: 3000000,
            volumeLast7d: 21000000,
            feesGenerated24h: 150,
            impliedVolatility: 15,
            priceRangeLast30d: { min: 0.995, max: 1.005, percentageChange: 1 },
            utilizationRate: 0.12,
            averageTradeSize: 100000,
            apy30d: 6.8,
            apy90d: 7.1,
            impermanentLossRisk: 1.5,
            createdAt: new Date('2023-07-01'),
            lastUpdatedBlock: 18500000
        },

        // Medium risk: UNI-ETH
        {
            poolId: 'pool-uni-eth',
            poolAddress: '0x4567890123456789012345678901234567890123',
            token0: {
                address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
                symbol: 'UNI',
                decimals: 18,
                category: 'mid-cap' as AssetCategory
            },
            token1: {
                address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                symbol: 'WETH',
                decimals: 18,
                category: 'wrapped-native' as AssetCategory
            },
            totalValueLocked: 5000000,
            liquidityDepth: { buy: 200000, sell: 200000 },
            liquidityStability: 0.25,
            feeTier: 30,
            volumeLast24h: 2500000,
            volumeLast7d: 17500000,
            feesGenerated24h: 750,
            impliedVolatility: 65,
            priceRangeLast30d: { min: 8.5, max: 12.3, percentageChange: 45 },
            utilizationRate: 0.5,
            averageTradeSize: 15000,
            apy30d: 18.5,
            apy90d: 22.1,
            impermanentLossRisk: 15,
            createdAt: new Date('2023-08-01'),
            lastUpdatedBlock: 18500000
        },

        // Medium risk: AAVE-ETH
        {
            poolId: 'pool-aave-eth',
            poolAddress: '0x5678901234567890123456789012345678901234',
            token0: {
                address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
                symbol: 'AAVE',
                decimals: 18,
                category: 'mid-cap' as AssetCategory
            },
            token1: {
                address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                symbol: 'WETH',
                decimals: 18,
                category: 'wrapped-native' as AssetCategory
            },
            totalValueLocked: 3500000,
            liquidityDepth: { buy: 150000, sell: 150000 },
            liquidityStability: 0.28,
            feeTier: 30,
            volumeLast24h: 1800000,
            volumeLast7d: 12600000,
            feesGenerated24h: 540,
            impliedVolatility: 70,
            priceRangeLast30d: { min: 180, max: 260, percentageChange: 44 },
            utilizationRate: 0.51,
            averageTradeSize: 12000,
            apy30d: 20.3,
            apy90d: 24.5,
            impermanentLossRisk: 18,
            createdAt: new Date('2023-07-15'),
            lastUpdatedBlock: 18500000
        },

        // Higher risk: Volatile altcoin pair
        {
            poolId: 'pool-volatile-eth',
            poolAddress: '0x6789012345678901234567890123456789012345',
            token0: {
                address: '0x1234512345123451234512345123451234512345',
                symbol: 'ALT',
                decimals: 18,
                category: 'volatile' as AssetCategory
            },
            token1: {
                address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                symbol: 'WETH',
                decimals: 18,
                category: 'wrapped-native' as AssetCategory
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
        },

        // Medium-low risk: DAI-USDC
        {
            poolId: 'pool-dai-usdc',
            poolAddress: '0x7890123456789012345678901234567890123456',
            token0: {
                address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
                symbol: 'DAI',
                decimals: 18,
                category: 'stablecoin' as AssetCategory
            },
            token1: {
                address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                symbol: 'USDC',
                decimals: 6,
                category: 'stablecoin' as AssetCategory
            },
            totalValueLocked: 30000000,
            liquidityDepth: { buy: 800000, sell: 800000 },
            liquidityStability: 0.09,
            feeTier: 1,
            volumeLast24h: 3500000,
            volumeLast7d: 24500000,
            feesGenerated24h: 350,
            impliedVolatility: 1.2,
            priceRangeLast30d: { min: 0.996, max: 1.004, percentageChange: 0.8 },
            utilizationRate: 0.12,
            averageTradeSize: 75000,
            apy30d: 4.8,
            apy90d: 5.1,
            impermanentLossRisk: 0.2,
            createdAt: new Date('2023-06-15'),
            lastUpdatedBlock: 18500000
        },

        // Medium risk: LINK-ETH
        {
            poolId: 'pool-link-eth',
            poolAddress: '0x8901234567890123456789012345678901234567',
            token0: {
                address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
                symbol: 'LINK',
                decimals: 18,
                category: 'mid-cap' as AssetCategory
            },
            token1: {
                address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                symbol: 'WETH',
                decimals: 18,
                category: 'wrapped-native' as AssetCategory
            },
            totalValueLocked: 6000000,
            liquidityDepth: { buy: 250000, sell: 250000 },
            liquidityStability: 0.22,
            feeTier: 30,
            volumeLast24h: 3000000,
            volumeLast7d: 21000000,
            feesGenerated24h: 900,
            impliedVolatility: 58,
            priceRangeLast30d: { min: 14, max: 19, percentageChange: 36 },
            utilizationRate: 0.5,
            averageTradeSize: 18000,
            apy30d: 16.8,
            apy90d: 19.2,
            impermanentLossRisk: 12,
            createdAt: new Date('2023-09-01'),
            lastUpdatedBlock: 18500000
        }
    ];
}

/**
 * Classify an asset by its address
 * TODO: Implement proper classification logic
 */
export async function classifyAsset(address: string): Promise<AssetCategory> {
    // Simplified classification - in production, use on-chain data
    const stablecoins = [
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0x6B175474E89094C44Da98b954EedeAC495271d0F'  // DAI
    ];

    if (stablecoins.includes(address)) {
        return 'stablecoin';
    }

    // Default classification
    return 'mid-cap';
}
