// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title DemoYieldController - Centralized Controller for Demo Yield Configuration
 * @notice Manages yield rates and treasury integration for all demo pools
 * @dev Allows owner to update yield rates without redeploying pool contracts
 * 
 * Features:
 * - Dynamic yield rate configuration per pool
 * - Integration with TreasuryFunder
 * - Support for time-based, percentage-based, and hybrid yield models
 * - Emergency pause functionality
 * - Rate limit enforcement
 */

interface ITreasuryFunder {
    function fundYield(address recipient, uint256 amount) external;
    function canFundAmount(address pool, uint256 amount) external view returns (bool);
}

contract DemoYieldController {
    // ===== STRUCTS =====
    
    /**
     * @notice Yield configuration for a pool
     * @param enabled Whether yield is enabled for this pool
     * @param yieldModel Type of yield calculation (0=fixed, 1=percentage, 2=mixed)
     * @param fixedRatePerMinute Fixed amount per minute (6 decimals, e.g., 30000 = 0.03 USDC)
     * @param percentageBps Percentage yield in basis points per year (e.g., 500 = 5%)
     * @param minYieldBps Minimum yield percentage (for variable models)
     * @param maxYieldBps Maximum yield percentage (for variable models)
     * @param capPerWithdrawal Maximum yield per withdrawal (0 = no cap)
     */
    struct YieldConfig {
        bool enabled;
        uint8 yieldModel; // 0=fixed, 1=percentage, 2=mixed
        uint256 fixedRatePerMinute;
        int256 percentageBps;
        int256 minYieldBps;
        int256 maxYieldBps;
        uint256 capPerWithdrawal;
    }
    
    // ===== STATE VARIABLES =====
    address public owner;
    ITreasuryFunder public treasuryFunder;
    
    // Pool -> YieldConfig
    mapping(address => YieldConfig) public poolConfigs;
    
    // Registered pools
    address[] public registeredPools;
    mapping(address => bool) public isRegistered;
    
    // Emergency pause
    bool public paused;
    
    // ===== EVENTS =====
    event PoolRegistered(address indexed pool, YieldConfig config);
    event YieldConfigUpdated(address indexed pool, YieldConfig config);
    event PoolDeregistered(address indexed pool);
    event YieldCalculated(address indexed pool, address indexed user, uint256 amount);
    event EmergencyPaused(bool paused);
    event TreasuryFunderUpdated(address indexed newTreasuryFunder);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // ===== MODIFIERS =====
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }
    
    modifier onlyRegisteredPool() {
        require(isRegistered[msg.sender], "Pool not registered");
        _;
    }
    
    // ===== CONSTRUCTOR =====
    constructor(address _treasuryFunder) {
        require(_treasuryFunder != address(0), "Invalid treasury address");
        owner = msg.sender;
        treasuryFunder = ITreasuryFunder(_treasuryFunder);
    }
    
    // ===== OWNER FUNCTIONS =====
    
    /**
     * @notice Register a new pool with yield configuration
     */
    function registerPool(
        address pool,
        bool enabled,
        uint8 yieldModel,
        uint256 fixedRatePerMinute,
        int256 percentageBps,
        int256 minYieldBps,
        int256 maxYieldBps,
        uint256 capPerWithdrawal
    ) external onlyOwner {
        require(pool != address(0), "Invalid pool");
        require(!isRegistered[pool], "Already registered");
        require(yieldModel <= 2, "Invalid yield model");
        
        YieldConfig memory config = YieldConfig({
            enabled: enabled,
            yieldModel: yieldModel,
            fixedRatePerMinute: fixedRatePerMinute,
            percentageBps: percentageBps,
            minYieldBps: minYieldBps,
            maxYieldBps: maxYieldBps,
            capPerWithdrawal: capPerWithdrawal
        });
        
        poolConfigs[pool] = config;
        registeredPools.push(pool);
        isRegistered[pool] = true;
        
        emit PoolRegistered(pool, config);
    }
    
    /**
     * @notice Update yield configuration for existing pool
     */
    function updatePoolConfig(
        address pool,
        bool enabled,
        uint8 yieldModel,
        uint256 fixedRatePerMinute,
        int256 percentageBps,
        int256 minYieldBps,
        int256 maxYieldBps,
        uint256 capPerWithdrawal
    ) external onlyOwner {
        require(isRegistered[pool], "Pool not registered");
        require(yieldModel <= 2, "Invalid yield model");
        
        YieldConfig memory config = YieldConfig({
            enabled: enabled,
            yieldModel: yieldModel,
            fixedRatePerMinute: fixedRatePerMinute,
            percentageBps: percentageBps,
            minYieldBps: minYieldBps,
            maxYieldBps: maxYieldBps,
            capPerWithdrawal: capPerWithdrawal
        });
        
        poolConfigs[pool] = config;
        
        emit YieldConfigUpdated(pool, config);
    }
    
    /**
     * @notice Deregister a pool
     */
    function deregisterPool(address pool) external onlyOwner {
        require(isRegistered[pool], "Pool not registered");
        
        delete poolConfigs[pool];
        isRegistered[pool] = false;
        
        // Remove from array (swap and pop)
        for (uint256 i = 0; i < registeredPools.length; i++) {
            if (registeredPools[i] == pool) {
                registeredPools[i] = registeredPools[registeredPools.length - 1];
                registeredPools.pop();
                break;
            }
        }
        
        emit PoolDeregistered(pool);
    }
    
    /**
     * @notice Emergency pause/unpause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyPaused(_paused);
    }
    
    /**
     * @notice Update treasury funder address
     */
    function updateTreasuryFunder(address newTreasuryFunder) external onlyOwner {
        require(newTreasuryFunder != address(0), "Invalid address");
        treasuryFunder = ITreasuryFunder(newTreasuryFunder);
        emit TreasuryFunderUpdated(newTreasuryFunder);
    }
    
    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
    
    // ===== POOL FUNCTIONS =====
    
    /**
     * @notice Calculate yield for a user (called by pool contracts)
     * @param user User address
     * @param principal User's principal amount
     * @param timeElapsed Time elapsed in seconds
     * @return yieldAmount Calculated yield amount
     */
    function calculateYield(
        address user,
        uint256 principal,
        uint256 timeElapsed
    ) external view onlyRegisteredPool whenNotPaused returns (int256 yieldAmount) {
        YieldConfig memory config = poolConfigs[msg.sender];
        
        if (!config.enabled || principal == 0 || timeElapsed == 0) {
            return 0;
        }
        
        if (config.yieldModel == 0) {
            // Fixed rate per minute
            uint256 minutesElapsed = timeElapsed / 60;
            yieldAmount = int256(minutesElapsed * config.fixedRatePerMinute);
        } else if (config.yieldModel == 1) {
            // Percentage-based (annualized)
            // yield = principal * percentageBps * timeElapsed / (10000 * 365 days)
            yieldAmount = (int256(principal) * config.percentageBps * int256(timeElapsed)) 
                         / (10000 * 31536000);
        } else {
            // Mixed model: fixed + percentage
            uint256 minutesElapsed = timeElapsed / 60;
            int256 fixedYield = int256(minutesElapsed * config.fixedRatePerMinute);
            int256 percentageYield = (int256(principal) * config.percentageBps * int256(timeElapsed)) 
                                    / (10000 * 31536000);
            yieldAmount = fixedYield + percentageYield;
        }
        
        // Apply bounds if configured
        if (config.minYieldBps != 0 || config.maxYieldBps != 0) {
            int256 minYield = (int256(principal) * config.minYieldBps * int256(timeElapsed)) 
                            / (10000 * 31536000);
            int256 maxYield = (int256(principal) * config.maxYieldBps * int256(timeElapsed)) 
                            / (10000 * 31536000);
            
            if (yieldAmount < minYield) yieldAmount = minYield;
            if (yieldAmount > maxYield) yieldAmount = maxYield;
        }
        
        // Apply per-withdrawal cap if configured
        if (config.capPerWithdrawal > 0 && yieldAmount > int256(config.capPerWithdrawal)) {
            yieldAmount = int256(config.capPerWithdrawal);
        }
        
        return yieldAmount;
    }
    
    /**
     * @notice Request yield funding from treasury (called by pool contracts)
     * @param recipient User to receive yield
     * @param amount Yield amount to fund
     */
    function requestYieldFunding(
        address recipient, 
        uint256 amount
    ) external onlyRegisteredPool whenNotPaused {
        YieldConfig memory config = poolConfigs[msg.sender];
        require(config.enabled, "Yield not enabled for pool");
        require(amount > 0, "Zero amount");
        
        // Check if treasury can fund this amount
        require(
            treasuryFunder.canFundAmount(msg.sender, amount),
            "Treasury cannot fund amount"
        );
        
        // Request funding from treasury
        treasuryFunder.fundYield(recipient, amount);
        
        emit YieldCalculated(msg.sender, recipient, amount);
    }
    
    // ===== VIEW FUNCTIONS =====
    
    /**
     * @notice Get configuration for a pool
     */
    function getPoolConfig(address pool) external view returns (YieldConfig memory) {
        return poolConfigs[pool];
    }
    
    /**
     * @notice Get all registered pools
     */
    function getAllPools() external view returns (address[] memory) {
        return registeredPools;
    }
    
    /**
     * @notice Get total number of registered pools
     */
    function poolCount() external view returns (uint256) {
        return registeredPools.length;
    }
    
    /**
     * @notice Preview yield calculation without state change
     */
    function previewYield(
        address pool,
        uint256 principal,
        uint256 timeElapsed
    ) external view returns (int256) {
        require(isRegistered[pool], "Pool not registered");
        
        YieldConfig memory config = poolConfigs[pool];
        
        if (!config.enabled || principal == 0 || timeElapsed == 0) {
            return 0;
        }
        
        int256 yieldAmount;
        
        if (config.yieldModel == 0) {
            uint256 minutesElapsed = timeElapsed / 60;
            yieldAmount = int256(minutesElapsed * config.fixedRatePerMinute);
        } else if (config.yieldModel == 1) {
            yieldAmount = (int256(principal) * config.percentageBps * int256(timeElapsed)) 
                         / (10000 * 31536000);
        } else {
            uint256 minutesElapsed = timeElapsed / 60;
            int256 fixedYield = int256(minutesElapsed * config.fixedRatePerMinute);
            int256 percentageYield = (int256(principal) * config.percentageBps * int256(timeElapsed)) 
                                    / (10000 * 31536000);
            yieldAmount = fixedYield + percentageYield;
        }
        
        if (config.minYieldBps != 0 || config.maxYieldBps != 0) {
            int256 minYield = (int256(principal) * config.minYieldBps * int256(timeElapsed)) 
                            / (10000 * 31536000);
            int256 maxYield = (int256(principal) * config.maxYieldBps * int256(timeElapsed)) 
                            / (10000 * 31536000);
            
            if (yieldAmount < minYield) yieldAmount = minYield;
            if (yieldAmount > maxYield) yieldAmount = maxYield;
        }
        
        if (config.capPerWithdrawal > 0 && yieldAmount > int256(config.capPerWithdrawal)) {
            yieldAmount = int256(config.capPerWithdrawal);
        }
        
        return yieldAmount;
    }
}
