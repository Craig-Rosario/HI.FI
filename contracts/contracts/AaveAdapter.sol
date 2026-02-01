// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IAavePool.sol";

contract AaveAdapter {
    IERC20 public immutable usdc;
    IERC20 public immutable aUSDC;
    IAavePool public immutable aavePool;

    constructor(
        address _usdc,
        address _aUSDC,
        address _aavePool
    ) {
        usdc = IERC20(_usdc);
        aUSDC = IERC20(_aUSDC);
        aavePool = IAavePool(_aavePool);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "amount = 0");

        // 1. Approve Aave Pool to pull USDC
        usdc.approve(address(aavePool), amount);

        // 2. Supply USDC to Aave
        aavePool.supply(
            address(usdc),
            amount,
            address(this),
            0
        );

        emit YieldDeployed(amount, block.timestamp);
    }

    function getBalance() external view returns (uint256) {
        return aUSDC.balanceOf(address(this));
    }

    event YieldDeployed(uint256 amount, uint256 timestamp);
    event BalanceReported(uint256 aTokenBalance, uint256 timestamp);
}
