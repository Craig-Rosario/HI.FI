// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

interface IDepositRouter {
    /// @notice Thrown when the swap output is insufficient
    error InsufficientSwapOutput();

    /// @notice Thrown when the cross-chain message fails
    error CrossChainFailed();

    struct SwapParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint256 amountIn;
        uint256 minAmountOut;
        bytes hookData;
    }

    /// @notice Deposits a token on the same chain, swaps to base asset via Uniswap V4, and enters Vault
    /// @param tokenIn The token user is depositing
    /// @param swapParams Struct containing Uniswap V4 swap details (PoolKey, direction, etc.)
    /// @param vault The target vault address
    /// @param minShares The minimum shares to receive
    /// @return shares The amount of shares minted
    function depositSameChain(
        address tokenIn,
        SwapParams calldata swapParams,
        address vault,
        uint256 minShares
    ) external returns (uint256 shares);

    /// @notice Deposits a token, swaps to USDC via Uniswap V4, and bridges to destination chain via CCTP
    /// @param tokenIn The token user is depositing
    /// @param swapParams Struct containing Uniswap V4 swap details
    /// @param destinationChainId The target chain ID (Circle Domain)
    /// @param targetVault The vault address on the destination chain
    /// @param minUSDC The minimum USDC to bridge (slippage protection for local swap)
    function depositCrossChain(
        address tokenIn,
        SwapParams calldata swapParams,
        uint32 destinationChainId,
        address targetVault,
        uint256 minUSDC
    ) external;
}
