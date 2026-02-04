// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PoolVaultV2 - HI.FI Investment Pool (No Owner Restrictions)
 * @notice Anyone can withdraw after pool is deployed for 1 minute
 * @dev Deploy with:
 *      _arcUsdc: 0x15C7881801F78ECFad935c137eD38B7F8316B5e8 (ArcUSDC on Base Sepolia)
 *      _cap: 10000000 (10 USDC with 6 decimals for testing)
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract PoolVaultV2 {
    enum State {
        COLLECTING,
        DEPLOYED
    }

    IERC20 public immutable arcUsdc;
    address public owner;

    uint256 public cap;
    uint256 public totalShares;
    State public state;
    
    // Timestamp when pool was deployed (started earning yield)
    uint256 public deployedAt;
    
    // Withdraw delay after deployment (1 minute for testing)
    uint256 public constant WITHDRAW_DELAY = 60;

    mapping(address => uint256) public shares;

    // ===== EVENTS =====

    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted);
    event PoolDeployed(uint256 totalAssets, uint256 deployedAt);
    event Withdrawn(address indexed user, uint256 amount, uint256 sharesBurned);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ===== MODIFIERS =====

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ===== CONSTRUCTOR =====

    constructor(address _arcUsdc, uint256 _cap) {
        arcUsdc = IERC20(_arcUsdc);
        cap = _cap;
        state = State.COLLECTING;
        owner = msg.sender;
    }

    // ===== DEPOSIT =====

    function deposit(uint256 amount) external {
        require(state == State.COLLECTING, "Not collecting");
        require(amount > 0, "Zero amount");

        uint256 assetsBefore = totalAssets();

        bool success = arcUsdc.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        uint256 mintedShares = totalShares == 0
            ? amount
            : (amount * totalShares) / assetsBefore;

        shares[msg.sender] += mintedShares;
        totalShares += mintedShares;

        require(totalAssets() <= cap, "Cap exceeded");

        emit Deposited(msg.sender, amount, mintedShares);
    }

    // ===== DEPLOY =====

    function deploy() external onlyOwner {
        require(state == State.COLLECTING, "Already deployed");
        require(totalAssets() >= cap, "Cap not reached");

        state = State.DEPLOYED;
        deployedAt = block.timestamp;
        
        emit PoolDeployed(totalAssets(), deployedAt);
    }

    // ===== WITHDRAW (ANYONE after delay) =====

    /**
     * @notice Check if withdrawals are open
     * @return true if pool is deployed and delay has passed
     */
    function isWithdrawOpen() public view returns (bool) {
        return state == State.DEPLOYED && block.timestamp >= deployedAt + WITHDRAW_DELAY;
    }

    /**
     * @notice Withdraw shares - anyone can call after pool deployed for 1 minute
     * @param shareAmount Number of shares to withdraw
     */
    function withdraw(uint256 shareAmount) external {
        require(state == State.DEPLOYED, "Not deployed");
        require(block.timestamp >= deployedAt + WITHDRAW_DELAY, "Withdraw not open yet");
        require(shareAmount > 0, "Zero shares");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");

        uint256 assets = (shareAmount * totalAssets()) / totalShares;

        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        bool success = arcUsdc.transfer(msg.sender, assets);
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, assets, shareAmount);
    }

    // ===== VIEWS =====

    function totalAssets() public view returns (uint256) {
        return arcUsdc.balanceOf(address(this));
    }

    function previewWithdraw(address user) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[user] * totalAssets()) / totalShares;
    }
    
    /**
     * @notice Time remaining until withdrawals open (0 if already open)
     */
    function timeUntilWithdraw() external view returns (uint256) {
        if (state != State.DEPLOYED) return type(uint256).max;
        uint256 openTime = deployedAt + WITHDRAW_DELAY;
        if (block.timestamp >= openTime) return 0;
        return openTime - block.timestamp;
    }

    // ===== OWNER =====

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    function setCap(uint256 newCap) external onlyOwner {
        require(state == State.COLLECTING, "Already deployed");
        cap = newCap;
    }
}
