// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

interface IUniswapV4Strategy {
    /// @notice Returns the PoolKey this strategy manages liquidity for
    function getPoolKey() external view returns (PoolKey memory);

    /// @notice Returns the Uniswap V4 PoolManager instance
    function poolManager() external view returns (IPoolManager);

    /// @notice Adds liquidity to the V4 Pool
    /// @dev Only callable by the Vault
    /// @param amount0Max Max amount of token0 to add
    /// @param amount1Max Max amount of token1 to add
    /// @param tickLower The lower tick of the position range
    /// @param tickUpper The upper tick of the position range
    /// @return liquidity The amount of liquidity minted
    function addLiquidity(
        uint256 amount0Max,
        uint256 amount1Max,
        int24 tickLower,
        int24 tickUpper
    ) external returns (uint128 liquidity);

    /// @notice Removes liquidity from the V4 Pool
    /// @dev Only callable by the Vault
    /// @param liquidity The amount of liquidity to remove
    /// @param tickLower The lower tick of the position range
    /// @param tickUpper The upper tick of the position range
    /// @return amount0 The amount of token0 received
    /// @return amount1 The amount of token1 received
    function removeLiquidity(
        uint128 liquidity,
        int24 tickLower,
        int24 tickUpper
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Collects fees from the position
    function collectFees(int24 tickLower, int24 tickUpper) external returns (uint256 amount0, uint256 amount1);
}
