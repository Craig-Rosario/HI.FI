// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title TreasuryFunder - Centralized Treasury for Demo Yield Funding
 * @notice Manages treasury funds for subsidizing demo yields across all pools
 * @dev Owner can deposit USDC and authorize specific pools to withdraw for yield payments
 * 
 * Features:
 * - Single treasury contract for all demo pools
 * - Authorized pools can request yield funding
 * - Emergency withdrawal for owner
 * - Per-pool funding limits and tracking
 * - Event logging for transparency
 */

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract TreasuryFunder {
    // ===== STATE VARIABLES =====
    address public owner;
    IERC20 public immutable usdc;
    
    // Authorized pools that can request funding
    mapping(address => bool) public authorizedPools;
    
    // Track total funding provided to each pool
    mapping(address => uint256) public fundingProvided;
    
    // Optional per-pool funding limits (0 = unlimited)
    mapping(address => uint256) public poolFundingLimits;
    
    // Total funding provided across all pools
    uint256 public totalFundingProvided;
    
    // Global funding limit (0 = unlimited)
    uint256 public globalFundingLimit;
    
    // ===== EVENTS =====
    event TreasuryDeposit(address indexed depositor, uint256 amount);
    event PoolAuthorized(address indexed pool, uint256 fundingLimit);
    event PoolRevoked(address indexed pool);
    event YieldFunded(address indexed pool, address indexed recipient, uint256 amount);
    event EmergencyWithdrawal(address indexed owner, uint256 amount);
    event GlobalFundingLimitUpdated(uint256 newLimit);
    event PoolFundingLimitUpdated(address indexed pool, uint256 newLimit);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // ===== MODIFIERS =====
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyAuthorizedPool() {
        require(authorizedPools[msg.sender], "Not authorized");
        _;
    }
    
    // ===== CONSTRUCTOR =====
    /**
     * @param _usdc USDC token address (Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e)
     */
    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
        owner = msg.sender;
    }
    
    // ===== OWNER FUNCTIONS =====
    
    /**
     * @notice Deposit USDC into treasury for yield funding
     * @param amount Amount of USDC to deposit (6 decimals)
     */
    function depositTreasury(uint256 amount) external onlyOwner {
        require(amount > 0, "Zero amount");
        
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        
        emit TreasuryDeposit(msg.sender, amount);
    }
    
    /**
     * @notice Authorize a pool to request yield funding
     * @param pool Address of the pool contract
     * @param fundingLimit Maximum funding for this pool (0 = unlimited)
     */
    function authorizePool(address pool, uint256 fundingLimit) external onlyOwner {
        require(pool != address(0), "Invalid pool address");
        
        authorizedPools[pool] = true;
        poolFundingLimits[pool] = fundingLimit;
        
        emit PoolAuthorized(pool, fundingLimit);
    }
    
    /**
     * @notice Revoke a pool's authorization
     * @param pool Address of the pool contract
     */
    function revokePool(address pool) external onlyOwner {
        authorizedPools[pool] = false;
        emit PoolRevoked(pool);
    }
    
    /**
     * @notice Update per-pool funding limit
     * @param pool Address of the pool contract
     * @param newLimit New funding limit (0 = unlimited)
     */
    function updatePoolFundingLimit(address pool, uint256 newLimit) external onlyOwner {
        require(authorizedPools[pool], "Pool not authorized");
        poolFundingLimits[pool] = newLimit;
        emit PoolFundingLimitUpdated(pool, newLimit);
    }
    
    /**
     * @notice Update global funding limit across all pools
     * @param newLimit New global limit (0 = unlimited)
     */
    function updateGlobalFundingLimit(uint256 newLimit) external onlyOwner {
        globalFundingLimit = newLimit;
        emit GlobalFundingLimitUpdated(newLimit);
    }
    
    /**
     * @notice Emergency withdrawal of all treasury funds
     * @dev Should only be used in emergency situations
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No funds to withdraw");
        
        bool success = usdc.transfer(owner, balance);
        require(success, "Transfer failed");
        
        emit EmergencyWithdrawal(owner, balance);
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
    
    // ===== POOL FUNCTIONS =====
    
    /**
     * @notice Request yield funding from treasury (called by authorized pools only)
     * @param recipient Address to send the yield to
     * @param amount Amount of USDC to fund (6 decimals)
     */
    function fundYield(address recipient, uint256 amount) external onlyAuthorizedPool {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Zero amount");
        
        // Check pool-specific funding limit
        uint256 poolLimit = poolFundingLimits[msg.sender];
        if (poolLimit > 0) {
            require(fundingProvided[msg.sender] + amount <= poolLimit, "Pool funding limit exceeded");
        }
        
        // Check global funding limit
        if (globalFundingLimit > 0) {
            require(totalFundingProvided + amount <= globalFundingLimit, "Global funding limit exceeded");
        }
        
        // Check treasury balance
        uint256 balance = usdc.balanceOf(address(this));
        require(balance >= amount, "Insufficient treasury funds");
        
        // Update tracking
        fundingProvided[msg.sender] += amount;
        totalFundingProvided += amount;
        
        // Transfer funds
        bool success = usdc.transfer(recipient, amount);
        require(success, "Transfer failed");
        
        emit YieldFunded(msg.sender, recipient, amount);
    }
    
    // ===== VIEW FUNCTIONS =====
    
    /**
     * @notice Get current treasury balance
     */
    function treasuryBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
    
    /**
     * @notice Check remaining funding capacity for a pool
     * @param pool Address of the pool
     */
    function remainingPoolCapacity(address pool) external view returns (uint256) {
        if (!authorizedPools[pool]) return 0;
        
        uint256 poolLimit = poolFundingLimits[pool];
        if (poolLimit == 0) {
            // Check global limit
            if (globalFundingLimit == 0) {
                return type(uint256).max; // Unlimited
            }
            return globalFundingLimit - totalFundingProvided;
        }
        
        uint256 poolRemaining = poolLimit - fundingProvided[pool];
        
        // Also check global limit
        if (globalFundingLimit > 0) {
            uint256 globalRemaining = globalFundingLimit - totalFundingProvided;
            return poolRemaining < globalRemaining ? poolRemaining : globalRemaining;
        }
        
        return poolRemaining;
    }
    
    /**
     * @notice Check if a pool is authorized and has capacity
     * @param pool Address of the pool
     * @param amount Amount to check
     */
    function canFundAmount(address pool, uint256 amount) external view returns (bool) {
        if (!authorizedPools[pool]) return false;
        if (usdc.balanceOf(address(this)) < amount) return false;
        
        uint256 poolLimit = poolFundingLimits[pool];
        if (poolLimit > 0 && fundingProvided[pool] + amount > poolLimit) return false;
        
        if (globalFundingLimit > 0 && totalFundingProvided + amount > globalFundingLimit) return false;
        
        return true;
    }
}
