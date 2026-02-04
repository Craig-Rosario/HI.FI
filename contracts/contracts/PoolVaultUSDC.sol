// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PoolVaultUSDC - HI.FI Investment Pool (Native USDC)
 * @notice Deploy this contract with native USDC address on Base Sepolia
 * @dev Constructor params:
 *      _usdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (USDC on Base Sepolia)
 *      _cap: 1000000000000 (1M USDC with 6 decimals)
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract PoolVaultUSDC {
    enum State {
        COLLECTING,
        DEPLOYED,
        WITHDRAW_WINDOW
    }

    IERC20 public immutable usdc;
    address public owner;

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
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ===== MODIFIERS =====

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ===== CONSTRUCTOR =====
    // Deploy with:
    // _usdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia USDC)
    // _cap: 1000000000000 (1M USDC)

    constructor(address _usdc, uint256 _cap) {
        usdc = IERC20(_usdc);
        cap = _cap;
        state = State.COLLECTING;
        owner = msg.sender;
    }

    // ===== DEPOSIT =====

    function deposit(uint256 amount) external {
        require(state == State.COLLECTING, "Not collecting");
        require(amount > 0, "Zero amount");

        uint256 assetsBefore = totalAssets();

        // Transfer USDC from user to this vault
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

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

        bool success = usdc.transfer(msg.sender, assets);
        require(success, "Transfer failed");

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

    // ===== OWNER =====

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
