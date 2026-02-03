// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IUniswapV4Strategy.sol";

contract UniswapV4Strategy is IStrategy, IUniswapV4Strategy, IUnlockCallback {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    address public immutable vault;
    IERC20 public immutable assetToken; // The base asset (e.g. USDC)
    IPoolManager public immutable override poolManager;
    PoolKey public poolKey;

    // Track total value (simplified, real world needs pricing oracle)
    uint256 public totalInvested;

    constructor(
        address _vault,
        address _asset,
        address _poolManager,
        PoolKey memory _poolKey
    ) {
        vault = _vault;
        assetToken = IERC20(_asset);
        poolManager = IPoolManager(_poolManager);
        poolKey = _poolKey;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "Not vault");
        _;
    }

    /// @inheritdoc IStrategy
    function asset() external view override returns (address) {
        return address(assetToken);
    }

    /// @inheritdoc IStrategy
    function totalAssets() external view override returns (uint256) {
        // In V4, value = liquidity * price + fees.
        // For MVP, we track invested amount assuming simple 1:1 or rely on off-chain indexing.
        // TODO: Implement precise valuation using TickMath and LiquidityAmounts
        return totalInvested;
    }

    /// @inheritdoc IStrategy
    function deposit(uint256 amount) external override onlyVault {
        totalInvested += amount;
        // Funds are effectively "in" the strategy now (sitting in this contract)
        // They await an explicit `addLiquidity` call from an Agent via callStrategy
    }

    /// @inheritdoc IStrategy
    function withdraw(uint256 amount) external override onlyVault {
        require(amount <= assetToken.balanceOf(address(this)), "Insufficient idle cash");
        // For simple MVP strategy, we assume funds are effectively "idle" or removed first.
        // Real logic: If idle < amount, force remove liquidity.
        
        totalInvested -= amount;
        assetToken.safeTransfer(vault, amount);
    }

    /// @inheritdoc IStrategy
    function emergencyExit() external override {
        // Withdraw everything from PoolManager
        // Send everything to Vault
        // TODO: Implement
    }

    // ===== UNISWAP V4 SPECIFIC ACTIONS (via callStrategy) =====

    /// @inheritdoc IUniswapV4Strategy
    function getPoolKey() external view override returns (PoolKey memory) {
        return poolKey;
    }

    /// @inheritdoc IUniswapV4Strategy
    function addLiquidity(
        uint256 amount0Max,
        uint256 amount1Max,
        int24 tickLower,
        int24 tickUpper
    ) external override onlyVault returns (uint128 liquidity) {
        // Unlock PoolManager to mint liquidity
         bytes memory data = abi.encode(
            Action.ADD_LIQUIDITY, 
            amount0Max, 
            amount1Max, 
            tickLower, 
            tickUpper
        );
        bytes memory result = poolManager.unlock(data);
        liquidity = abi.decode(result, (uint128));
    }

    /// @inheritdoc IUniswapV4Strategy
    function removeLiquidity(
        uint128 liquidity,
        int24 tickLower,
        int24 tickUpper
    ) external override onlyVault returns (uint256 amount0, uint256 amount1) {
         bytes memory data = abi.encode(
            Action.REMOVE_LIQUIDITY, 
            liquidity, 
            0, // amount0Min 
            0, // amount1Min
            tickLower, 
            tickUpper
        );
        bytes memory result = poolManager.unlock(data);
        (amount0, amount1) = abi.decode(result, (uint256, uint256));
    }

    function collectFees(int24 tickLower, int24 tickUpper) external override onlyVault returns (uint256 amount0, uint256 amount1) {
        // TODO: Implement standard collect call
        return (0, 0);
    }

    // ===== UNLOCK CALLBACK =====

    enum Action { ADD_LIQUIDITY, REMOVE_LIQUIDITY }

    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        require(msg.sender == address(poolManager), "Caller not PoolManager");
        
        (Action action, uint256 arg1, uint256 arg2, int24 tickLower, int24 tickUpper) = 
            abi.decode(data, (Action, uint256, uint256, int24, int24));

        if (action == Action.ADD_LIQUIDITY) {
             return _addLiquidityCallback(arg1, arg2, tickLower, tickUpper);
        } else {
             return _removeLiquidityCallback(uint128(arg1), tickLower, tickUpper);
        }
    }

    function _addLiquidityCallback(uint256 amount0Max, uint256 amount1Max, int24 tickLower, int24 tickUpper) internal returns (bytes memory) {
        // Defines the liquidity modification
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: int256(uint256(100)), // Dummy delta, need LiquidityAmounts.sol for real math
            salt: bytes32(0)
        });

        // Call modifyLiquidity
        (BalanceDelta delta,) = poolManager.modifyLiquidity(poolKey, params, "");
        
        // Settle Deltas (Pay tokens to PoolManager)
        if (delta.amount0() > 0) {
            IERC20(Currency.unwrap(poolKey.currency0)).safeTransfer(address(poolManager), uint256(int256(delta.amount0())));
        }
        if (delta.amount1() > 0) {
            IERC20(Currency.unwrap(poolKey.currency1)).safeTransfer(address(poolManager), uint256(int256(delta.amount1())));
        }

        // Return minted liquidity amount (dummy return for MVP structure)
        return abi.encode(uint128(100));
    }

    function _removeLiquidityCallback(uint128 liquidity, int24 tickLower, int24 tickUpper) internal returns (bytes memory) {
         ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: -int256(uint256(liquidity)),
            salt: bytes32(0)
        });

        (BalanceDelta delta,) = poolManager.modifyLiquidity(poolKey, params, "");

        // Settle Deltas (Take tokens from PoolManager)
        uint256 amount0 = uint256(int256(-delta.amount0()));
        uint256 amount1 = uint256(int256(-delta.amount1()));

        if (amount0 > 0) {
            poolManager.take(poolKey.currency0, address(this), amount0);
        }
        if (amount1 > 0) {
            poolManager.take(poolKey.currency1, address(this), amount1);
        }

        return abi.encode(amount0, amount1);
    }
}
