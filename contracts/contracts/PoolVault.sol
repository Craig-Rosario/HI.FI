// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PoolVault {
    IERC20 public immutable usdc;

    mapping(address => uint256) public balances;
    uint256 public totalDeposits;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "amount = 0");

        balances[msg.sender] += amount;
        totalDeposits += amount;

        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "transfer failed");

        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "amount = 0");
        require(balances[msg.sender] >= amount, "insufficient balance");

        balances[msg.sender] -= amount;
        totalDeposits -= amount;

        bool success = usdc.transfer(msg.sender, amount);
        require(success, "transfer failed");

        emit Withdrawn(msg.sender, amount);
    }
}
