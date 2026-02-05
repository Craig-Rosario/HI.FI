// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title AgentPermissionManager - Permission System for Agent Automation
 * @notice Allows users to delegate specific actions to an AI agent smart contract
 * @dev Reduces signature requirements from 8 to 1 for automated operations
 * 
 * Features:
 * - Granular permission scopes (withdraw, rebalance, emergency exit)
 * - Time-bound approvals with expiration
 * - Per-pool permissions
 * - Emergency revoke functionality
 * - Agent operator management
 * - Permission history tracking
 * 
 * Security:
 * - User signs once to approve agent for specific actions
 * - Permissions can be revoked at any time
 * - Time-limited permissions auto-expire
 * - Per-pool isolation prevents cross-pool risks
 * - Owner can pause entire system
 */

interface IPoolVault {
    function withdraw(uint256 shareAmount) external;
    function shares(address user) external view returns (uint256);
    function isWithdrawOpen() external view returns (bool);
}

contract AgentPermissionManager {
    // ===== PERMISSION TYPES =====
    enum PermissionType {
        WITHDRAW,           // Auto-withdraw when conditions met
        REBALANCE,          // Move between pools
        EMERGENCY_EXIT,     // Exit position immediately
        AUTO_COMPOUND,      // Reinvest yields
        STOP_LOSS          // Auto-exit on loss threshold
    }
    
    // ===== STRUCTS =====
    
    /**
     * @notice Permission granted by user to agent
     * @param permissionType Type of permission granted
     * @param pool Pool address this permission applies to
     * @param enabled Whether permission is active
     * @param expiresAt Unix timestamp when permission expires (0 = no expiry)
     * @param maxAmount Maximum amount agent can withdraw (0 = unlimited)
     * @param thresholdBps Threshold in basis points (for stop-loss, etc.)
     * @param grantedAt When permission was granted
     * @param usedCount How many times this permission has been used
     * @param maxUses Maximum number of uses (0 = unlimited)
     */
    struct Permission {
        PermissionType permissionType;
        address pool;
        bool enabled;
        uint256 expiresAt;
        uint256 maxAmount;
        int256 thresholdBps;
        uint256 grantedAt;
        uint256 usedCount;
        uint256 maxUses;
    }
    
    /**
     * @notice Agent operator info
     * @param isAuthorized Whether operator can execute actions
     * @param addedAt When operator was authorized
     * @param actionsExecuted Total actions executed by this operator
     */
    struct AgentOperator {
        bool isAuthorized;
        uint256 addedAt;
        uint256 actionsExecuted;
    }
    
    // ===== STATE VARIABLES =====
    address public owner;
    
    // user => pool => PermissionType => Permission
    mapping(address => mapping(address => mapping(PermissionType => Permission))) public permissions;
    
    // user => all pools they've granted permissions for
    mapping(address => address[]) public userPools;
    mapping(address => mapping(address => bool)) public userPoolExists;
    
    // Authorized agent operators (off-chain agents that can execute)
    mapping(address => AgentOperator) public agentOperators;
    address[] public operatorList;
    
    // Emergency pause
    bool public paused;
    
    // Global limits
    uint256 public maxPermissionDuration = 30 days;
    
    // Action logs for transparency
    struct ActionLog {
        address user;
        address pool;
        PermissionType permissionType;
        address executor;
        uint256 amount;
        uint256 timestamp;
        bool success;
    }
    
    ActionLog[] public actionHistory;
    mapping(address => uint256[]) public userActionHistory; // user => action indices
    
    // ===== EVENTS =====
    event PermissionGranted(
        address indexed user,
        address indexed pool,
        PermissionType permissionType,
        uint256 expiresAt,
        uint256 maxAmount
    );
    event PermissionRevoked(
        address indexed user,
        address indexed pool,
        PermissionType permissionType
    );
    event PermissionUsed(
        address indexed user,
        address indexed pool,
        PermissionType permissionType,
        address indexed executor,
        uint256 amount
    );
    event AgentOperatorAdded(address indexed operator);
    event AgentOperatorRemoved(address indexed operator);
    event EmergencyPaused(bool paused);
    event MaxDurationUpdated(uint256 newMaxDuration);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // ===== MODIFIERS =====
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyAuthorizedOperator() {
        require(agentOperators[msg.sender].isAuthorized, "Not authorized operator");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "System paused");
        _;
    }
    
    // ===== CONSTRUCTOR =====
    constructor() {
        owner = msg.sender;
    }
    
    // ===== USER PERMISSION MANAGEMENT =====
    
    /**
     * @notice Grant permission to agent for specific action on specific pool
     * @param pool Pool address
     * @param permissionType Type of permission to grant
     * @param duration How long permission is valid (seconds, 0 = max duration)
     * @param maxAmount Maximum amount for this permission (0 = unlimited)
     * @param thresholdBps Threshold in basis points (for stop-loss, etc.)
     * @param maxUses Maximum number of times this can be used (0 = unlimited)
     */
    function grantPermission(
        address pool,
        PermissionType permissionType,
        uint256 duration,
        uint256 maxAmount,
        int256 thresholdBps,
        uint256 maxUses
    ) external whenNotPaused {
        require(pool != address(0), "Invalid pool");
        
        // Validate duration
        if (duration == 0) {
            duration = maxPermissionDuration;
        }
        require(duration <= maxPermissionDuration, "Duration too long");
        
        uint256 expiresAt = block.timestamp + duration;
        
        // Create permission
        Permission storage perm = permissions[msg.sender][pool][permissionType];
        perm.permissionType = permissionType;
        perm.pool = pool;
        perm.enabled = true;
        perm.expiresAt = expiresAt;
        perm.maxAmount = maxAmount;
        perm.thresholdBps = thresholdBps;
        perm.grantedAt = block.timestamp;
        perm.usedCount = 0;
        perm.maxUses = maxUses;
        
        // Track user pools
        if (!userPoolExists[msg.sender][pool]) {
            userPools[msg.sender].push(pool);
            userPoolExists[msg.sender][pool] = true;
        }
        
        emit PermissionGranted(msg.sender, pool, permissionType, expiresAt, maxAmount);
    }
    
    /**
     * @notice Revoke specific permission
     */
    function revokePermission(address pool, PermissionType permissionType) external {
        Permission storage perm = permissions[msg.sender][pool][permissionType];
        require(perm.enabled, "Permission not granted");
        
        perm.enabled = false;
        
        emit PermissionRevoked(msg.sender, pool, permissionType);
    }
    
    /**
     * @notice Revoke ALL permissions for a user (emergency)
     */
    function revokeAllPermissions() external {
        address[] memory pools = userPools[msg.sender];
        
        for (uint256 i = 0; i < pools.length; i++) {
            address pool = pools[i];
            
            for (uint256 j = 0; j <= uint256(PermissionType.STOP_LOSS); j++) {
                PermissionType permType = PermissionType(j);
                Permission storage perm = permissions[msg.sender][pool][permType];
                
                if (perm.enabled) {
                    perm.enabled = false;
                    emit PermissionRevoked(msg.sender, pool, permType);
                }
            }
        }
    }
    
    /**
     * @notice Extend permission expiration
     */
    function extendPermission(
        address pool,
        PermissionType permissionType,
        uint256 additionalDuration
    ) external {
        Permission storage perm = permissions[msg.sender][pool][permissionType];
        require(perm.enabled, "Permission not granted");
        require(perm.expiresAt > block.timestamp, "Permission expired");
        
        uint256 newExpiry = perm.expiresAt + additionalDuration;
        require(newExpiry <= block.timestamp + maxPermissionDuration, "Extension too long");
        
        perm.expiresAt = newExpiry;
        
        emit PermissionGranted(msg.sender, pool, permissionType, newExpiry, perm.maxAmount);
    }
    
    // ===== AGENT OPERATOR FUNCTIONS =====
    
    /**
     * @notice Execute withdrawal on behalf of user
     * @param user User who granted permission
     * @param pool Pool to withdraw from
     * @param shareAmount Amount of shares to withdraw
     */
    function executeWithdrawal(
        address user,
        address pool,
        uint256 shareAmount
    ) external onlyAuthorizedOperator whenNotPaused returns (bool) {
        // Check permission
        Permission storage perm = permissions[user][pool][PermissionType.WITHDRAW];
        require(_isPermissionValid(perm), "Invalid permission");
        
        // Check pool state
        IPoolVault vault = IPoolVault(pool);
        require(vault.isWithdrawOpen(), "Withdraw window not open");
        require(vault.shares(user) >= shareAmount, "Insufficient shares");
        
        // Check amount limit
        if (perm.maxAmount > 0) {
            require(shareAmount <= perm.maxAmount, "Amount exceeds limit");
        }
        
        // Check usage limit
        if (perm.maxUses > 0) {
            require(perm.usedCount < perm.maxUses, "Permission used up");
        }
        
        // Update usage
        perm.usedCount++;
        agentOperators[msg.sender].actionsExecuted++;
        
        // Execute withdrawal (requires user to have approved this contract)
        // NOTE: User must call pool.approve(agentPermissionManager, shares) first
        try vault.withdraw(shareAmount) {
            // Log action
            _logAction(user, pool, PermissionType.WITHDRAW, shareAmount, true);
            
            emit PermissionUsed(user, pool, PermissionType.WITHDRAW, msg.sender, shareAmount);
            return true;
        } catch {
            // Log failed action
            _logAction(user, pool, PermissionType.WITHDRAW, shareAmount, false);
            return false;
        }
    }
    
    /**
     * @notice Execute stop-loss exit
     * @param user User who granted permission
     * @param pool Pool to exit from
     */
    function executeStopLoss(
        address user,
        address pool
    ) external onlyAuthorizedOperator whenNotPaused returns (bool) {
        Permission storage perm = permissions[user][pool][PermissionType.STOP_LOSS];
        require(_isPermissionValid(perm), "Invalid permission");
        
        // Check if stop-loss threshold is met
        // This would require reading pool PnL and comparing to threshold
        // Simplified for demo - in production, would check actual pool state
        
        IPoolVault vault = IPoolVault(pool);
        uint256 userShares = vault.shares(user);
        require(userShares > 0, "No shares to exit");
        
        // Update usage
        perm.usedCount++;
        agentOperators[msg.sender].actionsExecuted++;
        
        // Execute full withdrawal
        try vault.withdraw(userShares) {
            _logAction(user, pool, PermissionType.STOP_LOSS, userShares, true);
            emit PermissionUsed(user, pool, PermissionType.STOP_LOSS, msg.sender, userShares);
            return true;
        } catch {
            _logAction(user, pool, PermissionType.STOP_LOSS, userShares, false);
            return false;
        }
    }
    
    // ===== OWNER FUNCTIONS =====
    
    /**
     * @notice Add authorized agent operator
     */
    function addAgentOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator");
        require(!agentOperators[operator].isAuthorized, "Already authorized");
        
        agentOperators[operator] = AgentOperator({
            isAuthorized: true,
            addedAt: block.timestamp,
            actionsExecuted: 0
        });
        
        operatorList.push(operator);
        
        emit AgentOperatorAdded(operator);
    }
    
    /**
     * @notice Remove agent operator authorization
     */
    function removeAgentOperator(address operator) external onlyOwner {
        require(agentOperators[operator].isAuthorized, "Not authorized");
        
        agentOperators[operator].isAuthorized = false;
        
        emit AgentOperatorRemoved(operator);
    }
    
    /**
     * @notice Emergency pause/unpause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyPaused(_paused);
    }
    
    /**
     * @notice Update max permission duration
     */
    function setMaxPermissionDuration(uint256 newMaxDuration) external onlyOwner {
        require(newMaxDuration >= 1 hours && newMaxDuration <= 365 days, "Invalid duration");
        maxPermissionDuration = newMaxDuration;
        emit MaxDurationUpdated(newMaxDuration);
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
    
    // ===== VIEW FUNCTIONS =====
    
    /**
     * @notice Check if permission is valid (enabled, not expired, etc.)
     */
    function _isPermissionValid(Permission storage perm) internal view returns (bool) {
        if (!perm.enabled) return false;
        if (perm.expiresAt > 0 && block.timestamp > perm.expiresAt) return false;
        if (perm.maxUses > 0 && perm.usedCount >= perm.maxUses) return false;
        return true;
    }
    
    /**
     * @notice Get permission details
     */
    function getPermission(
        address user,
        address pool,
        PermissionType permissionType
    ) external view returns (Permission memory) {
        return permissions[user][pool][permissionType];
    }
    
    /**
     * @notice Check if user has valid permission
     */
    function hasValidPermission(
        address user,
        address pool,
        PermissionType permissionType
    ) external view returns (bool) {
        Permission storage perm = permissions[user][pool][permissionType];
        return _isPermissionValid(perm);
    }
    
    /**
     * @notice Get all pools user has granted permissions for
     */
    function getUserPools(address user) external view returns (address[] memory) {
        return userPools[user];
    }
    
    /**
     * @notice Get all agent operators
     */
    function getAllOperators() external view returns (address[] memory) {
        return operatorList;
    }
    
    /**
     * @notice Get action history for user
     */
    function getUserActionHistory(address user) external view returns (uint256[] memory) {
        return userActionHistory[user];
    }
    
    /**
     * @notice Get specific action details
     */
    function getAction(uint256 index) external view returns (ActionLog memory) {
        require(index < actionHistory.length, "Invalid index");
        return actionHistory[index];
    }
    
    /**
     * @notice Get total actions executed
     */
    function getTotalActions() external view returns (uint256) {
        return actionHistory.length;
    }
    
    // ===== INTERNAL FUNCTIONS =====
    
    /**
     * @notice Log action for transparency
     */
    function _logAction(
        address user,
        address pool,
        PermissionType permissionType,
        uint256 amount,
        bool success
    ) internal {
        ActionLog memory log = ActionLog({
            user: user,
            pool: pool,
            permissionType: permissionType,
            executor: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            success: success
        });
        
        uint256 index = actionHistory.length;
        actionHistory.push(log);
        userActionHistory[user].push(index);
    }
}
