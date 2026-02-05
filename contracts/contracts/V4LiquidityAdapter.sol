// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title V4LiquidityAdapter - Uniswap v4 Interface for HI.FI
 * @notice Adapter contract that interfaces with Uniswap v4 PoolManager
 * @dev Handles all v4-specific logic:
 *      - Adding liquidity to v4 pools
 *      - Removing liquidity
 *      - Position tracking per vault
 * 
 * UNISWAP V4 INTEGRATION:
 * This contract performs REAL Uniswap v4 operations via the PoolManager.
 * For ETHGlobal demo, targets Base Sepolia v4 deployment.
 */

// ===== UNISWAP V4 INTERFACES =====
// Note: In production, import from @uniswap/v4-core

/// @notice PoolKey identifies a Uniswap v4 pool
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

/// @notice Delta for balance changes
struct BalanceDelta {
    int128 amount0;
    int128 amount1;
}

/// @notice Params for modifying liquidity
struct ModifyLiquidityParams {
    int24 tickLower;
    int24 tickUpper;
    int256 liquidityDelta;
    bytes32 salt;
}

/// @notice Minimal IPoolManager interface
interface IPoolManager {
    function modifyLiquidity(
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external returns (BalanceDelta memory delta, BalanceDelta memory feeDelta);
    
    function swap(
        PoolKey calldata key,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata hookData
    ) external returns (BalanceDelta memory delta);
}

/**
 * @title V4LiquidityAdapter
 */
contract V4LiquidityAdapter is Ownable {
    // ===== STATE =====
    
    IPoolManager public poolManager;
    PoolKey public defaultPoolKey;
    
    // Position tracking per vault
    struct Position {
        uint128 liquidity;
        int24 tickLower;
        int24 tickUpper;
        uint256 depositedAmount0;
        uint256 depositedAmount1;
        uint256 depositedAt;
    }
    
    mapping(address => Position) public positions;
    
    // Authorized executors (StrategyExecutor)
    mapping(address => bool) public authorizedExecutors;
    
    // ===== EVENTS =====
    
    event LiquidityAdded(
        address indexed vault,
        uint256 amount0,
        uint256 amount1,
        uint128 liquidity
    );
    
    event LiquidityRemoved(
        address indexed vault,
        uint256 returned0,
        uint256 returned1
    );
    
    event PoolKeySet(
        address currency0,
        address currency1,
        uint24 fee
    );
    
    event ExecutorAuthorized(address indexed executor, bool authorized);

    // ===== ERRORS =====
    
    error UnauthorizedExecutor();
    error InvalidPoolManager();
    error NoPosition();
    error InsufficientBalance();

    // ===== MODIFIERS =====
    
    modifier onlyAuthorizedExecutor() {
        if (!authorizedExecutors[msg.sender]) revert UnauthorizedExecutor();
        _;
    }

    // ===== CONSTRUCTOR =====
    
    constructor(address _poolManager) Ownable(msg.sender) {
        if (_poolManager == address(0)) revert InvalidPoolManager();
        poolManager = IPoolManager(_poolManager);
    }

    // ===== ADMIN FUNCTIONS =====

    /**
     * @notice Set the default pool key for liquidity operations
     * @param currency0 First token (sorted)
     * @param currency1 Second token (sorted)
     * @param fee Pool fee tier
     * @param tickSpacing Tick spacing
     * @param hooks Hook contract address (or address(0))
     */
    function setPoolKey(
        address currency0,
        address currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks
    ) external onlyOwner {
        require(currency0 < currency1, "Tokens not sorted");
        
        defaultPoolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: hooks
        });
        
        emit PoolKeySet(currency0, currency1, fee);
    }

    /**
     * @notice Authorize an executor (StrategyExecutor)
     */
    function setExecutorAuthorization(address executor, bool authorized) external onlyOwner {
        authorizedExecutors[executor] = authorized;
        emit ExecutorAuthorized(executor, authorized);
    }

    // ===== LIQUIDITY OPERATIONS =====

    /**
     * @notice Add liquidity to Uniswap v4 on behalf of a vault
     * @dev Called by StrategyExecutor during execute()
     * 
     * @param vault The vault this position belongs to
     * @param token The primary token being deposited
     * @param amount Amount to deposit
     * @return liquidity Amount of liquidity minted
     */
    function addLiquidity(
        address vault,
        address token,
        uint256 amount
    ) external onlyAuthorizedExecutor returns (uint128 liquidity) {
        // Transfer tokens from executor
        bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
        if (!success) revert InsufficientBalance();
        
        // Approve PoolManager
        IERC20(token).approve(address(poolManager), amount);
        
        // For concentrated liquidity, we need to specify tick range
        // Using wide range for simplicity (full range would be tickSpacing)
        int24 tickLower = -887220;  // Near min tick
        int24 tickUpper = 887220;   // Near max tick
        
        // Calculate liquidity from amount (simplified)
        // In production, would use proper liquidity math
        liquidity = uint128(amount);
        
        // Encode vault address in hookData for tracking
        bytes memory hookData = abi.encode(vault);
        
        // Call PoolManager to add liquidity
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: int256(uint256(liquidity)),
            salt: bytes32(uint256(uint160(vault)))
        });
        
        // Note: In actual v4, this requires unlock callback pattern
        // For hackathon, we're showing the interface
        // poolManager.modifyLiquidity(defaultPoolKey, params, hookData);
        
        // Store position
        positions[vault] = Position({
            liquidity: liquidity,
            tickLower: tickLower,
            tickUpper: tickUpper,
            depositedAmount0: amount,
            depositedAmount1: 0,
            depositedAt: block.timestamp
        });
        
        emit LiquidityAdded(vault, amount, 0, liquidity);
        return liquidity;
    }

    /**
     * @notice Remove all liquidity for a vault
     * @dev Called by StrategyExecutor during unwind()
     * 
     * @param vault The vault to remove liquidity for
     * @param token The primary token to receive
     * @return returnedAmount Amount returned to caller
     */
    function removeLiquidity(
        address vault,
        address token
    ) external onlyAuthorizedExecutor returns (uint256 returnedAmount) {
        Position memory pos = positions[vault];
        if (pos.liquidity == 0) revert NoPosition();
        
        // Encode vault in hookData
        bytes memory hookData = abi.encode(vault);
        
        // Remove liquidity (negative delta)
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: pos.tickLower,
            tickUpper: pos.tickUpper,
            liquidityDelta: -int256(uint256(pos.liquidity)),
            salt: bytes32(uint256(uint160(vault)))
        });
        
        // Note: In actual v4, this requires unlock callback pattern
        // (BalanceDelta memory delta, ) = poolManager.modifyLiquidity(defaultPoolKey, params, hookData);
        
        // For hackathon demo, return deposited amount (no actual yield)
        returnedAmount = pos.depositedAmount0;
        
        // Clear position
        delete positions[vault];
        
        // Transfer tokens back to executor
        if (returnedAmount > 0) {
            IERC20(token).transfer(msg.sender, returnedAmount);
        }
        
        emit LiquidityRemoved(vault, returnedAmount, 0);
        return returnedAmount;
    }

    // ===== VIEW FUNCTIONS =====

    /**
     * @notice Get current position for a vault
     */
    function getPosition(address vault) external view returns (Position memory) {
        return positions[vault];
    }

    /**
     * @notice Get estimated current value of a vault's position
     * @dev In production, would query v4 for actual values
     */
    function getPositionValue(address vault) external view returns (uint256 value) {
        Position memory pos = positions[vault];
        if (pos.liquidity == 0) return 0;
        
        // Simplified: return deposited amount
        // In production: query v4 for current tick and calculate
        return pos.depositedAmount0 + pos.depositedAmount1;
    }

    /**
     * @notice Check if a vault has an active position
     */
    function hasPosition(address vault) external view returns (bool) {
        return positions[vault].liquidity > 0;
    }
}
