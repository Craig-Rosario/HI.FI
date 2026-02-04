// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PoolVaultAave - HI.FI Investment Pool with Aave V3 Integration
 * @notice Accepts arcUSDC deposits, deploys to Aave V3 for yield, auto-opens withdraw after 1 min
 * 
 * DEPLOY ON BASE SEPOLIA with these constructor args:
 *   _arcUsdc: 0x15C7881801F78ECFad935c137eD38B7F8316B5e8 (Your ArcUSDC)
 *   _usdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia USDC)
 *   _aavePool: 0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b (Aave V3 Pool)
 *   _cap: 10000000 (10 USDC with 6 decimals)
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IArcUSDC {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

contract PoolVaultAave {
    // ===== STATE =====
    
    enum State {
        COLLECTING,   // 0: Accepting deposits
        DEPLOYED      // 1: Funds in Aave, earning yield
    }

    IArcUSDC public immutable arcUsdc;
    IERC20 public immutable usdc;
    IAavePool public immutable aavePool;
    address public owner;

    uint256 public cap;
    uint256 public totalShares;
    State public state;
    
    // Aave tracking
    uint256 public principalDeposited;  // Total arcUSDC deposited to Aave
    uint256 public deployedAt;          // Timestamp when deployed to Aave
    
    // Withdraw opens 1 minute after deployment
    uint256 public constant WITHDRAW_DELAY = 60; // 1 minute for testing

    mapping(address => uint256) public shares;

    // ===== EVENTS =====

    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted);
    event DeployedToAave(uint256 principal, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 arcUsdcAmount, uint256 sharesBurned);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ===== MODIFIERS =====

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ===== CONSTRUCTOR =====

    constructor(
        address _arcUsdc,
        address _usdc,
        address _aavePool,
        uint256 _cap
    ) {
        arcUsdc = IArcUSDC(_arcUsdc);
        usdc = IERC20(_usdc);
        aavePool = IAavePool(_aavePool);
        cap = _cap;
        state = State.COLLECTING;
        owner = msg.sender;
    }

    // ===== DEPOSIT (arcUSDC) =====

    /**
     * @notice Deposit arcUSDC to the pool
     * @param amount Amount of arcUSDC to deposit (6 decimals)
     */
    function deposit(uint256 amount) external {
        require(state == State.COLLECTING, "Not collecting");
        require(amount > 0, "Zero amount");

        uint256 assetsBefore = totalAssetsCollecting();

        // Transfer arcUSDC from user to vault
        bool success = arcUsdc.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        // Calculate shares (1:1 for first deposit, proportional after)
        uint256 mintedShares = totalShares == 0
            ? amount
            : (amount * totalShares) / assetsBefore;

        shares[msg.sender] += mintedShares;
        totalShares += mintedShares;

        emit Deposited(msg.sender, amount, mintedShares);
        
        // AUTO-DEPLOY: If cap reached, automatically deploy to Aave
        if (totalAssetsCollecting() >= cap) {
            _deployToAave();
        }
    }

    // ===== DEPLOY TO AAVE =====

    /**
     * @notice Internal function to deploy all arcUSDC to Aave V3
     */
    function _deployToAave() internal {
        uint256 arcBalance = arcUsdc.balanceOf(address(this));

        // 1. Unwrap arcUSDC to USDC
        arcUsdc.withdraw(arcBalance);
        
        // 2. Approve Aave Pool to spend USDC
        uint256 usdcBalance = usdc.balanceOf(address(this));
        usdc.approve(address(aavePool), usdcBalance);
        
        // 3. Supply USDC to Aave (we receive aUSDC automatically)
        aavePool.supply(address(usdc), usdcBalance, address(this), 0);
        
        // 4. Track state
        principalDeposited = usdcBalance;
        deployedAt = block.timestamp;
        state = State.DEPLOYED;

        emit DeployedToAave(principalDeposited, deployedAt);
    }

    /**
     * @notice Manual deploy to Aave (owner only, backup)
     */
    function deployToAave() external onlyOwner {
        require(state == State.COLLECTING, "Already deployed");
        require(arcUsdc.balanceOf(address(this)) >= cap, "Cap not reached");
        _deployToAave();
    }

    // ===== WITHDRAW =====

    /**
     * @notice Check if withdrawals are open (1 min after deployment)
     */
    function isWithdrawOpen() public view returns (bool) {
        if (state != State.DEPLOYED) return false;
        return block.timestamp >= deployedAt + WITHDRAW_DELAY;
    }

    /**
     * @notice Time remaining until withdraw opens (0 if already open)
     */
    function timeUntilWithdraw() external view returns (uint256) {
        if (state != State.DEPLOYED) return type(uint256).max;
        if (block.timestamp >= deployedAt + WITHDRAW_DELAY) return 0;
        return (deployedAt + WITHDRAW_DELAY) - block.timestamp;
    }

    /**
     * @notice Withdraw shares - available 1 minute after deployment
     * @param shareAmount Number of shares to withdraw
     */
    function withdraw(uint256 shareAmount) external {
        require(state == State.DEPLOYED, "Not deployed");
        require(isWithdrawOpen(), "Withdraw not open yet");
        require(shareAmount > 0, "Zero shares");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");

        // Calculate user's portion of total assets (including yield)
        uint256 totalAaveAssets = totalAssetsDeployed();
        uint256 userAssets = (shareAmount * totalAaveAssets) / totalShares;

        // Update shares
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        // 1. Withdraw USDC from Aave
        aavePool.withdraw(address(usdc), userAssets, address(this));
        
        // 2. Wrap USDC back to arcUSDC
        uint256 usdcBalance = usdc.balanceOf(address(this));
        usdc.approve(address(arcUsdc), usdcBalance);
        arcUsdc.deposit(usdcBalance);
        
        // 3. Transfer arcUSDC to user
        uint256 arcBalance = arcUsdc.balanceOf(address(this));
        bool success = arcUsdc.transfer(msg.sender, arcBalance);
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, arcBalance, shareAmount);
    }

    /**
     * @notice Withdraw all shares for caller
     */
    function withdrawAll() external {
        uint256 userShares = shares[msg.sender];
        require(userShares > 0, "No shares");
        
        // Call withdraw with all shares
        this.withdraw(userShares);
    }

    // ===== VIEW FUNCTIONS =====

    /**
     * @notice Total arcUSDC in vault (while collecting)
     */
    function totalAssetsCollecting() public view returns (uint256) {
        return arcUsdc.balanceOf(address(this));
    }

    /**
     * @notice Total USDC value in Aave (principal + yield)
     * @dev aUSDC balance grows over time as yield accrues
     */
    function totalAssetsDeployed() public view returns (uint256) {
        if (state != State.DEPLOYED) return 0;
        // aUSDC is 1:1 with USDC, balance grows with yield
        // We need to check aUSDC balance - it's at a deterministic address
        // For Aave V3, aTokens are rebasing, so we check our USDC position
        // The aToken address for USDC on Base Sepolia: 0xf53B60F4006cab2b3C4688ce41fD5362427A2A66
        IERC20 aUsdc = IERC20(0xf53B60F4006cab2b3C4688ce41fD5362427A2A66);
        return aUsdc.balanceOf(address(this));
    }

    /**
     * @notice Total assets (collecting or deployed)
     */
    function totalAssets() public view returns (uint256) {
        if (state == State.COLLECTING) {
            return totalAssetsCollecting();
        }
        return totalAssetsDeployed();
    }

    /**
     * @notice Yield earned so far (deployed assets - principal)
     */
    function yieldEarned() external view returns (uint256) {
        if (state != State.DEPLOYED) return 0;
        uint256 current = totalAssetsDeployed();
        if (current <= principalDeposited) return 0;
        return current - principalDeposited;
    }

    /**
     * @notice Preview how much arcUSDC user would receive on withdrawal
     */
    function previewWithdraw(address user) external view returns (uint256) {
        if (totalShares == 0) return 0;
        uint256 userShares = shares[user];
        if (state == State.COLLECTING) {
            return (userShares * totalAssetsCollecting()) / totalShares;
        }
        return (userShares * totalAssetsDeployed()) / totalShares;
    }

    // ===== OWNER FUNCTIONS =====

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setCap(uint256 newCap) external onlyOwner {
        require(state == State.COLLECTING, "Already deployed");
        cap = newCap;
    }

    // ===== EMERGENCY =====

    /**
     * @notice Emergency withdraw all from Aave (owner only)
     */
    function emergencyWithdrawFromAave() external onlyOwner {
        require(state == State.DEPLOYED, "Not deployed");
        uint256 aaveBalance = totalAssetsDeployed();
        aavePool.withdraw(address(usdc), aaveBalance, address(this));
    }
}
