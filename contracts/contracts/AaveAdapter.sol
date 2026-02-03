// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAavePool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
}

contract AaveAdapter {
    IERC20 public immutable arcUSDC;      // underlying
    IERC20 public immutable aArcUSDC;     // aToken
    IAavePool public immutable aavePool;
    address public immutable vault;

    // ===== EVENTS =====
    event DepositedToAave(uint256 amount);
    event WithdrawnFromAave(uint256 amount);

    constructor(
        address _arcUSDC,
        address _aArcUSDC,
        address _aavePool,
        address _vault
    ) {
        arcUSDC = IERC20(_arcUSDC);
        aArcUSDC = IERC20(_aArcUSDC);
        aavePool = IAavePool(_aavePool);
        vault = _vault;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "Not vault");
        _;
    }

    // ===== DEPOSIT =====
    // arcUSDC must already be transferred to this contract
    function deposit(uint256 amount) external onlyVault {
        require(amount > 0, "Zero amount");

        arcUSDC.approve(address(aavePool), amount);

        aavePool.supply(
            address(arcUSDC),
            amount,
            address(this),
            0
        );

        emit DepositedToAave(amount);
    }

    // ===== WITHDRAW =====
    function withdraw(uint256 amount) external onlyVault {
        require(amount > 0, "Zero amount");

        aavePool.withdraw(
            address(arcUSDC),
            amount,
            vault
        );

        emit WithdrawnFromAave(amount);
    }

    // ===== VIEW =====
    function totalValue() external view returns (uint256) {
        return aArcUSDC.balanceOf(address(this));
    }
}
