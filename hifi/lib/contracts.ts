/**
 * Contract Addresses and Configuration
 * Deployed on Arc Testnet and Sepolia
 */

export const CONTRACTS = {
    ARC: {
        POOL_VAULT_1: "0x5BF5868E09D9395968F7C2A989679F4a5b415683", // 1000 USDC threshold
        POOL_VAULT_2: "0x2Ab5B38Cc67D3B23677d3e3A6C726baf0dBed65c", // 10 USDC threshold
        POOL_VAULT_3: "0xddC39afa01D12911340975eFe6379FF92E22445f", // 10 USDC threshold - FRESH
        USDC: "0x3600000000000000000000000000000000000000",
        RPC: "https://rpc.testnet.arc.network",
        CHAIN_ID: 5042002
    },
    SEPOLIA: {
        AAVE_ADAPTER: "0x67247676e21331f866b820d5C0CD05219c939b89",
        USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
        CHAIN_ID: 11155111
    }
} as const;

/**
 * All deployed pool addresses
 */
export const POOL_ADDRESSES = [
    CONTRACTS.ARC.POOL_VAULT_1,
    CONTRACTS.ARC.POOL_VAULT_2,
    CONTRACTS.ARC.POOL_VAULT_3
] as const;

/**
 * PoolVault Contract ABI (minimal, only what we need)
 */
export const POOL_VAULT_ABI = [
    'function nav() view returns (uint256)',
    'function threshold() view returns (uint256)',
    'function state() view returns (uint8)',
    'function totalShares() view returns (uint256)',
    'function usdc() view returns (address)',
] as const;

/**
 * Pool state enum
 */
export enum PoolState {
    Collecting = 0,
    Active = 1
}
