// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, toBalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams as V4SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import "./interfaces/IDepositRouter.sol";
import "./interfaces/IVault.sol";

// Minimal interface for Circle CCTP TokenMessenger
interface ITokenMessenger {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 _nonce);
}

contract DepositRouter is IDepositRouter, IUnlockCallback {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    IERC20 public immutable usdc;
    IPoolManager public immutable poolManager;
    ITokenMessenger public immutable tokenMessenger;

    // Circle CCTP Domain ID for this chain
    uint32 public immutable localDomain;

    constructor(
        address _usdc,
        address _poolManager,
        address _tokenMessenger,
        uint32 _localDomain
    ) {
        usdc = IERC20(_usdc);
        poolManager = IPoolManager(_poolManager);
        tokenMessenger = ITokenMessenger(_tokenMessenger);
        localDomain = _localDomain;
    }

    /// @inheritdoc IDepositRouter
    function depositSameChain(
        address tokenIn,
        SwapParams calldata swapParams,
        address vault,
        uint256 minShares
    ) external override returns (uint256 shares) {
        // 1. Pull Token
        uint256 amountIn = swapParams.amountIn;
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // 2. Swap to USDC (if not already USDC)
        uint256 usdcAmount;
        if (tokenIn == address(usdc)) {
            usdcAmount = amountIn;
        } else {
            usdcAmount = _swapToUSDC(tokenIn, swapParams);
        }

        // 3. Approve Vault
        usdc.approve(vault, usdcAmount);

        // 4. Deposit into Vault
        shares = IVault(vault).deposit(usdcAmount, msg.sender);

        if (shares < minShares) revert InsufficientSwapOutput();
    }

    /// @inheritdoc IDepositRouter
    function depositCrossChain(
        address tokenIn,
        SwapParams calldata swapParams,
        uint32 destinationChainId,
        address targetVault,
        uint256 minUSDC
    ) external override {
        // 1. Pull Token
        uint256 amountIn = swapParams.amountIn;
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // 2. Swap to USDC (if not already USDC)
        uint256 usdcAmount;
        if (tokenIn == address(usdc)) {
            usdcAmount = amountIn;
        } else {
            usdcAmount = _swapToUSDC(tokenIn, swapParams);
        }

        if (usdcAmount < minUSDC) revert InsufficientSwapOutput();

        // 3. Burn via Circle CCTP
        usdc.approve(address(tokenMessenger), usdcAmount);
        
        // Pad address to bytes32 for CCTP
        bytes32 recipient = bytes32(uint256(uint160(targetVault)));

        tokenMessenger.depositForBurn(
            usdcAmount,
            destinationChainId,
            recipient,
            address(usdc)
        );
    }

    function _swapToUSDC(address tokenIn, SwapParams calldata params) internal returns (uint256 amountOut) {
        // Unlock PoolManager to perform swap actions
        bytes memory data = abi.encode(params, msg.sender);
        bytes memory result = poolManager.unlock(data);
        
        amountOut = abi.decode(result, (uint256));
    }

    /// @notice Callback from PoolManager.unlock()
    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        require(msg.sender == address(poolManager), "Caller not PoolManager");

        (SwapParams memory params, address payer) = abi.decode(data, (SwapParams, address));

        // Perform the swap on the PoolManager
        V4SwapParams memory poolSwapParams = V4SwapParams({
            zeroForOne: params.zeroForOne,
            amountSpecified: int256(params.amountIn), // Positive = Exact Input
            sqrtPriceLimitX96: 0 // No limit for now
        });

        PoolKey memory key = params.poolKey;
        
        // Execute Swap
        BalanceDelta delta = poolManager.swap(key, poolSwapParams, params.hookData);

        // Settle Deltas (Flash Accounting)
        // Delta amount0: positive = user owes (input), negative = user gets (output)
        // Delta amount1: vice versa
        
        int256 delta0 = delta.amount0();
        int256 delta1 = delta.amount1();

        if (delta0 > 0) {
            // We owe token0 (Input)
            IERC20(Currency.unwrap(key.currency0)).safeTransfer(address(poolManager), uint256(delta0));
        } else if (delta0 < 0) {
            // We get token0 (Output)
            poolManager.take(key.currency0, address(this), uint256(-delta0));
        }

        if (delta1 > 0) {
            // We owe token1 (Input)
            IERC20(Currency.unwrap(key.currency1)).safeTransfer(address(poolManager), uint256(delta1));
        } else if (delta1 < 0) {
            // We get token1 (Output)
            poolManager.take(key.currency1, address(this), uint256(-delta1));
        }

        // Return output amount (absolute value of the negative delta corresponding to tokenOut)
        // Assuming swapping to USDC, check which token is USDC
        uint256 outputAmount = params.zeroForOne ? uint256(-delta1) : uint256(-delta0);
        return abi.encode(outputAmount);
    }
}
