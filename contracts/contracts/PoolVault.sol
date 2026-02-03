// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PoolVault is Ownable {
    enum State {
        COLLECTING,
        DEPLOYED,
        WITHDRAW_WINDOW
    }

    IERC20 public immutable usdc;

    uint256 public cap;
    uint256 public totalShares;
    State public state;

    uint256 public withdrawWindowEnd;

    mapping(address => uint256) public shares;

    // ===== EVENTS =====

    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted);
    event PoolDeployed(uint256 totalAssets);
    event WithdrawWindowOpened(uint256 windowEnd);
    event Withdrawn(address indexed user, uint256 amount, uint256 sharesBurned);

    // ===== CONSTRUCTOR =====

    constructor(address _usdc, uint256 _cap) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        cap = _cap;
        state = State.COLLECTING;
    }

    // ===== DEPOSIT =====

    function deposit(uint256 amount) external {
        require(state == State.COLLECTING, "Not collecting");
        require(amount > 0, "Zero amount");

        uint256 assetsBefore = totalAssets();

        usdc.transferFrom(msg.sender, address(this), amount);

        uint256 mintedShares = totalShares == 0
            ? amount
            : (amount * totalShares) / assetsBefore;

        shares[msg.sender] += mintedShares;
        totalShares += mintedShares;

        require(totalAssets() <= cap, "Cap exceeded");

        emit Deposited(msg.sender, amount, mintedShares);
    }

    // ===== DEPLOY (NO STRATEGY YET) =====

    function deploy() external onlyOwner {
        require(state == State.COLLECTING, "Already deployed");
        require(totalAssets() == cap, "Cap not reached");

        state = State.DEPLOYED;
        emit PoolDeployed(cap);
    }

    // ===== WITHDRAW WINDOW =====

    function openWithdrawWindow(uint256 duration) external onlyOwner {
        require(state == State.DEPLOYED, "Not deployed");
        require(duration > 0, "Invalid duration");

        withdrawWindowEnd = block.timestamp + duration;
        state = State.WITHDRAW_WINDOW;

        emit WithdrawWindowOpened(withdrawWindowEnd);
    }

    function withdraw(uint256 shareAmount) external {
        require(state == State.WITHDRAW_WINDOW, "Withdraw closed");
        require(block.timestamp <= withdrawWindowEnd, "Window expired");
        require(shareAmount > 0, "Zero shares");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");

        uint256 assets = (shareAmount * totalAssets()) / totalShares;

        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        usdc.transfer(msg.sender, assets);

        emit Withdrawn(msg.sender, assets, shareAmount);
    }

    // ===== VIEWS =====

    function totalAssets() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function previewWithdraw(address user) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[user] * totalAssets()) / totalShares;
    }
}
