// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title HiFiHook - Uniswap v4 Hook for HI.FI Vault Tracking
 * @notice Optional hook that tracks HI.FI vault activity on Uniswap v4
 * @dev Implements afterAddLiquidity and afterSwap hooks for analytics
 * 
 * HOOK FEATURES:
 * - Tracks which vault added liquidity
 * - Records fee accrual per vault
 * - Emits events for frontend tracking
 * 
 * Note: This is a simplified hook for the ETHGlobal hackathon.
 * Production would require proper v4-periphery integration.
 */

// Minimal v4 types (in production, import from @uniswap/v4-core)
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct BalanceDelta {
    int128 amount0;
    int128 amount1;
}

interface IPoolManager {
    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }
    
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }
}

/**
 * @title BaseHook
 * @notice Minimal base hook implementation
 */
abstract contract BaseHook {
    address public immutable poolManager;
    
    constructor(address _poolManager) {
        poolManager = _poolManager;
    }
    
    // Hook permission flags
    function getHookPermissions() external pure virtual returns (bytes32);
    
    // Callbacks
    function afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        BalanceDelta calldata delta,
        bytes calldata hookData
    ) external virtual returns (bytes4);
    
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta calldata delta,
        bytes calldata hookData
    ) external virtual returns (bytes4);
}

/**
 * @title HiFiHook
 */
contract HiFiHook is BaseHook {
    // ===== STATE =====
    
    // Track activity per vault
    struct VaultActivity {
        uint256 totalLiquidityAdded;
        uint256 totalLiquidityRemoved;
        uint256 totalSwapVolume;
        uint256 estimatedFeesEarned;
        uint256 lastActivityAt;
    }
    
    mapping(address => VaultActivity) public vaultActivities;
    
    // Global stats
    uint256 public totalVaultsActive;
    uint256 public totalValueManaged;
    
    // Authorized adapter
    address public v4Adapter;

    // ===== EVENTS =====
    
    event VaultLiquidityAdded(
        address indexed vault,
        uint256 amount0,
        uint256 amount1,
        uint256 timestamp
    );
    
    event VaultLiquidityRemoved(
        address indexed vault,
        uint256 amount0,
        uint256 amount1,
        uint256 timestamp
    );
    
    event SwapRecorded(
        address indexed vault,
        bool zeroForOne,
        int256 amountSpecified,
        uint256 timestamp
    );
    
    event FeesAccrued(
        address indexed vault,
        uint256 feeAmount,
        uint256 timestamp
    );

    // ===== CONSTRUCTOR =====
    
    constructor(address _poolManager) BaseHook(_poolManager) {}

    // ===== ADMIN =====
    
    function setV4Adapter(address _adapter) external {
        // In production: add access control
        v4Adapter = _adapter;
    }

    // ===== HOOK PERMISSIONS =====
    
    /**
     * @notice Define which hooks this contract implements
     * @dev Flags: afterAddLiquidity, afterRemoveLiquidity, afterSwap
     */
    function getHookPermissions() external pure override returns (bytes32) {
        // Bits: beforeSwap, afterSwap, beforeAddLiquidity, afterAddLiquidity, etc.
        // We only need: afterAddLiquidity (bit 3), afterSwap (bit 1)
        // Binary: 00001010 = 0x0A
        return bytes32(uint256(0x0A));
    }

    // ===== HOOK CALLBACKS =====

    /**
     * @notice Called after liquidity is added to the pool
     * @dev Tracks vault deposits for analytics
     */
    function afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        BalanceDelta calldata delta,
        bytes calldata hookData
    ) external override returns (bytes4) {
        // Only process if called by our adapter
        if (sender != v4Adapter && v4Adapter != address(0)) {
            return this.afterAddLiquidity.selector;
        }
        
        // Decode vault address from hookData
        if (hookData.length >= 32) {
            address vault = abi.decode(hookData, (address));
            
            uint256 amount0 = delta.amount0 < 0 ? uint256(uint128(-delta.amount0)) : 0;
            uint256 amount1 = delta.amount1 < 0 ? uint256(uint128(-delta.amount1)) : 0;
            
            // Update vault activity
            VaultActivity storage activity = vaultActivities[vault];
            
            if (activity.lastActivityAt == 0) {
                totalVaultsActive++;
            }
            
            activity.totalLiquidityAdded += amount0 + amount1;
            activity.lastActivityAt = block.timestamp;
            
            totalValueManaged += amount0 + amount1;
            
            emit VaultLiquidityAdded(vault, amount0, amount1, block.timestamp);
        }
        
        return this.afterAddLiquidity.selector;
    }

    /**
     * @notice Called after a swap occurs in the pool
     * @dev Tracks swap volume and estimates fees
     */
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta calldata delta,
        bytes calldata hookData
    ) external override returns (bytes4) {
        // Only track if we have vault data
        if (hookData.length >= 32) {
            address vault = abi.decode(hookData, (address));
            
            // Calculate swap volume
            uint256 swapVolume = params.amountSpecified > 0 
                ? uint256(params.amountSpecified) 
                : uint256(-params.amountSpecified);
            
            // Estimate fee earned (based on pool fee tier)
            // fee is in hundredths of a bip, so 3000 = 0.3%
            uint256 feeEarned = (swapVolume * key.fee) / 1_000_000;
            
            // Update vault activity
            VaultActivity storage activity = vaultActivities[vault];
            activity.totalSwapVolume += swapVolume;
            activity.estimatedFeesEarned += feeEarned;
            activity.lastActivityAt = block.timestamp;
            
            emit SwapRecorded(vault, params.zeroForOne, params.amountSpecified, block.timestamp);
            
            if (feeEarned > 0) {
                emit FeesAccrued(vault, feeEarned, block.timestamp);
            }
        }
        
        return this.afterSwap.selector;
    }

    // ===== VIEW FUNCTIONS =====

    /**
     * @notice Get vault's activity summary
     */
    function getVaultActivity(address vault) external view returns (VaultActivity memory) {
        return vaultActivities[vault];
    }

    /**
     * @notice Get estimated fees earned by a vault
     */
    function getVaultFees(address vault) external view returns (uint256) {
        return vaultActivities[vault].estimatedFeesEarned;
    }

    /**
     * @notice Get global statistics
     */
    function getGlobalStats() external view returns (
        uint256 vaultsActive,
        uint256 totalManaged
    ) {
        return (totalVaultsActive, totalValueManaged);
    }
}
