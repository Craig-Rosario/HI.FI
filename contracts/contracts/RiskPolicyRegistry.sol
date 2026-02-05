// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
<<<<<<< Updated upstream
 * @title RiskPolicyRegistry - HI.FI Risk Policy Storage
 * @notice Stores user/pool risk preferences that govern StrategyExecutor decisions
 * @dev Risk levels determine maximum Uniswap v4 exposure and other constraints
 * 
 * This is part of the AGENTIC EXECUTION LAYER:
 * User sets risk ONCE → StrategyExecutor reads and acts autonomously
 */
contract RiskPolicyRegistry {
    // ===== ENUMS =====
    enum RiskLevel {
        LOW,     // Conservative: no v4 exposure
        MEDIUM,  // Balanced: up to 30% v4 exposure
        HIGH     // Aggressive: up to 70% v4 exposure
    }
    
    enum ActionType {
        ADD_LIQUIDITY,
        REMOVE_LIQUIDITY,
        SWAP
    }

    // ===== STRUCTS =====
    struct RiskPolicy {
        RiskLevel level;
        uint16 maxV4AllocationBps;  // Max % to deploy to Uniswap v4 (basis points, 10000 = 100%)
        uint16 maxSlippageBps;       // Max slippage tolerance (basis points)
        bool allowSwaps;              // Whether swaps are permitted
        uint256 setAt;                // Timestamp when policy was set
    }

    // ===== STATE =====
    
    // Pool address → RiskPolicy
    mapping(address => RiskPolicy) public poolPolicies;
    
    // User address → personal RiskLevel (for future per-user strategies)
    mapping(address => RiskLevel) public userRiskLevels;
    
    // Authorized policy setters (pool owners)
    mapping(address => address) public poolOwners;

    // ===== EVENTS =====
    event PoolRiskPolicySet(
        address indexed pool, 
        RiskLevel level, 
        uint16 maxV4AllocationBps,
        uint16 maxSlippageBps,
        bool allowSwaps
    );
    event UserRiskLevelSet(address indexed user, RiskLevel level);
    event PoolOwnerSet(address indexed pool, address indexed owner);

    // ===== MODIFIERS =====
    modifier onlyPoolOwner(address pool) {
        require(poolOwners[pool] == msg.sender, "Not pool owner");
        _;
    }

    // ===== CONSTRUCTOR =====
    constructor() {}

    // ===== POOL OWNER MANAGEMENT =====

    /**
     * @notice Register as owner of a pool (first-come-first-serve or when pool sets this contract)
     * @param pool The pool vault address
     */
    function registerAsPoolOwner(address pool) external {
        require(poolOwners[pool] == address(0), "Pool already has owner");
        poolOwners[pool] = msg.sender;
        emit PoolOwnerSet(pool, msg.sender);
    }

    /**
     * @notice Transfer pool ownership
     */
    function transferPoolOwnership(address pool, address newOwner) external onlyPoolOwner(pool) {
        require(newOwner != address(0), "Invalid owner");
        poolOwners[pool] = newOwner;
        emit PoolOwnerSet(pool, newOwner);
    }

    // ===== SET RISK POLICY =====

    /**
     * @notice Set risk policy for a pool using preset levels
     * @param pool The pool vault address
     * @param level The risk level (LOW, MEDIUM, HIGH)
     */
    function setPoolRiskLevel(address pool, RiskLevel level) external onlyPoolOwner(pool) {
        RiskPolicy memory policy = _getPresetPolicy(level);
        poolPolicies[pool] = policy;
        
        emit PoolRiskPolicySet(
            pool,
            level,
            policy.maxV4AllocationBps,
            policy.maxSlippageBps,
            policy.allowSwaps
        );
    }

    /**
     * @notice Set custom risk policy for advanced users
     * @param pool The pool vault address
     * @param level The risk level category
     * @param maxV4AllocationBps Maximum v4 allocation (0-10000)
     * @param maxSlippageBps Maximum slippage tolerance (0-1000 = 0-10%)
     * @param allowSwaps Whether swaps are permitted
     */
    function setPoolRiskPolicyCustom(
        address pool,
        RiskLevel level,
        uint16 maxV4AllocationBps,
        uint16 maxSlippageBps,
        bool allowSwaps
    ) external onlyPoolOwner(pool) {
        require(maxV4AllocationBps <= 10000, "Invalid allocation");
        require(maxSlippageBps <= 1000, "Slippage too high"); // Max 10%
        
        poolPolicies[pool] = RiskPolicy({
            level: level,
            maxV4AllocationBps: maxV4AllocationBps,
            maxSlippageBps: maxSlippageBps,
            allowSwaps: allowSwaps,
            setAt: block.timestamp
        });
        
        emit PoolRiskPolicySet(pool, level, maxV4AllocationBps, maxSlippageBps, allowSwaps);
    }

    /**
     * @notice User sets their personal risk level (for future use)
     * @param level The risk level
     */
    function setUserRiskLevel(RiskLevel level) external {
        userRiskLevels[msg.sender] = level;
        emit UserRiskLevelSet(msg.sender, level);
    }

    // ===== VIEW FUNCTIONS =====

    /**
     * @notice Get risk policy for a pool
     * @param pool The pool vault address
     * @return The risk policy
     */
    function getPoolRiskPolicy(address pool) external view returns (RiskPolicy memory) {
        return poolPolicies[pool];
    }

    /**
     * @notice Check if an action is allowed for a pool given the amount
     * @param pool The pool vault address
     * @param amount The amount to check
     * @param totalAssets Total assets in the pool
     * @param action The action type
     * @return allowed Whether the action is within policy bounds
     */
    function isActionAllowed(
        address pool,
        uint256 amount,
        uint256 totalAssets,
        ActionType action
    ) external view returns (bool allowed) {
        RiskPolicy memory policy = poolPolicies[pool];
        
        if (action == ActionType.SWAP && !policy.allowSwaps) {
            return false;
        }
        
        if (action == ActionType.ADD_LIQUIDITY) {
            uint256 maxAllocation = (totalAssets * policy.maxV4AllocationBps) / 10000;
            return amount <= maxAllocation;
        }
        
        // REMOVE_LIQUIDITY is always allowed
        return true;
    }

    /**
     * @notice Calculate maximum v4 allocation for a pool
     * @param pool The pool vault address
     * @param totalAssets Total assets in the pool
     * @return maxAmount Maximum amount that can be deployed to v4
     */
    function getMaxV4Allocation(
        address pool,
        uint256 totalAssets
    ) external view returns (uint256 maxAmount) {
        RiskPolicy memory policy = poolPolicies[pool];
        return (totalAssets * policy.maxV4AllocationBps) / 10000;
    }

    // ===== INTERNAL =====

    /**
     * @notice Get preset policy for a risk level
     */
    function _getPresetPolicy(RiskLevel level) internal view returns (RiskPolicy memory) {
        if (level == RiskLevel.LOW) {
            return RiskPolicy({
                level: RiskLevel.LOW,
                maxV4AllocationBps: 0,      // No v4 exposure
                maxSlippageBps: 50,          // 0.5% max slippage
                allowSwaps: false,
                setAt: block.timestamp
            });
        } else if (level == RiskLevel.MEDIUM) {
            return RiskPolicy({
                level: RiskLevel.MEDIUM,
                maxV4AllocationBps: 3000,   // 30% max v4 exposure
                maxSlippageBps: 100,         // 1% max slippage
                allowSwaps: true,
                setAt: block.timestamp
            });
        } else {
            // HIGH
            return RiskPolicy({
                level: RiskLevel.HIGH,
                maxV4AllocationBps: 7000,   // 70% max v4 exposure
                maxSlippageBps: 300,         // 3% max slippage
                allowSwaps: true,
                setAt: block.timestamp
            });
        }
=======
 * @title RiskPolicyRegistry
 * @notice Stores risk policies for pools - enables deterministic, onchain risk enforcement
 */
contract RiskPolicyRegistry {
    
    enum RiskLevel { LOW, MEDIUM, HIGH }
    
    struct RiskPolicy {
        RiskLevel level;
        uint256 maxV4AllocationBps;  // Max % to Uniswap v4 (basis points)
        uint256 maxSlippageBps;       // Max slippage allowed
        bool allowSwaps;              // Allow swap operations
        bool isSet;
    }
    
    // Pool address => RiskPolicy
    mapping(address => RiskPolicy) public poolPolicies;
    
    // Pool address => Owner who can modify policy
    mapping(address => address) public poolOwners;
    
    // Preset policies for each risk level
    mapping(RiskLevel => RiskPolicy) public presetPolicies;
    
    event PolicySet(address indexed pool, RiskLevel level);
    event PoolOwnerRegistered(address indexed pool, address indexed owner);
    
    constructor() {
        // LOW risk: 0% v4 exposure, no swaps
        presetPolicies[RiskLevel.LOW] = RiskPolicy({
            level: RiskLevel.LOW,
            maxV4AllocationBps: 0,
            maxSlippageBps: 50,
            allowSwaps: false,
            isSet: true
        });
        
        // MEDIUM risk: 30% v4 exposure
        presetPolicies[RiskLevel.MEDIUM] = RiskPolicy({
            level: RiskLevel.MEDIUM,
            maxV4AllocationBps: 3000,
            maxSlippageBps: 100,
            allowSwaps: true,
            isSet: true
        });
        
        // HIGH risk: 70% v4 exposure
        presetPolicies[RiskLevel.HIGH] = RiskPolicy({
            level: RiskLevel.HIGH,
            maxV4AllocationBps: 7000,
            maxSlippageBps: 300,
            allowSwaps: true,
            isSet: true
        });
    }
    
    function registerAsPoolOwner(address pool) external {
        require(poolOwners[pool] == address(0), "Pool already has owner");
        poolOwners[pool] = msg.sender;
        emit PoolOwnerRegistered(pool, msg.sender);
    }
    
    function setPoolRiskLevel(address pool, RiskLevel level) external {
        require(poolOwners[pool] == msg.sender, "Not pool owner");
        
        RiskPolicy memory preset = presetPolicies[level];
        poolPolicies[pool] = preset;
        
        emit PolicySet(pool, level);
    }
    
    function getPolicy(address pool) external view returns (RiskPolicy memory) {
        RiskPolicy memory policy = poolPolicies[pool];
        if (!policy.isSet) {
            return presetPolicies[RiskLevel.LOW]; // Default to LOW
        }
        return policy;
    }
    
    function getMaxV4Allocation(address pool) external view returns (uint256) {
        RiskPolicy memory policy = poolPolicies[pool];
        if (!policy.isSet) {
            return 0;
        }
        return policy.maxV4AllocationBps;
>>>>>>> Stashed changes
    }
}
