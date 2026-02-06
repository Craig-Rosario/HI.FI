// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title EasyPoolV2 - HI.FI Low Risk Pool with Treasury-Subsidized Guaranteed Yield
 * @notice Vault with guaranteed 0.3% per minute yield, funded by treasury
 * @dev Deploy on Base Sepolia with:
 *      _arcUsdc: Your ArcUSDC address
 *      _underlyingUsdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia USDC)
 *      _treasury: Treasury wallet address that funds the yield subsidy
 *      _cap: Pool capacity in USDC (6 decimals)
 * 
 * YIELD MECHANISM:
 * - Fixed yield: 0.3% of principal per minute after deployment
 * - Example: 10 USDC deposited → after 1 min → 10.03 USDC (0.3% of 10 = 0.03)
 * - Treasury subsidizes the yield difference
 * - NO RISK of loss - users always get principal + yield
 * - Remainder after all withdrawals goes to treasury
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
}

contract EasyPoolV2 {
    enum State {
        COLLECTING,
        DEPLOYED,
        WITHDRAW_WINDOW
    }

    IERC20 public immutable arcUsdc;
    IERC20 public immutable underlyingUsdc;
    
    address public owner;
    address public treasury; // Treasury wallet that funds yield subsidy
    uint256 public cap;
    uint256 public totalShares;
    State public state;
    
    // Withdraw window timing
    uint256 public deployedAt;
    uint256 public constant WITHDRAW_DELAY = 60; // 1 minute after deployment
    uint256 public constant WITHDRAW_WINDOW_DURATION = 3600; // 1 hour window
    
    // Simulated yield tracking
    uint256 public deployedAssets;      // Principal deployed
    uint256 public lastUpdate;          // Last time yield was calculated
    uint256 public accumulatedYield;    // Accumulated yield (always positive)
    
    // Yield parameters
    // 0.3% per minute = 30 basis points per minute
    uint256 public constant YIELD_RATE_BPS_PER_MINUTE = 30; // 0.3% = 30 bps
    
    mapping(address => uint256) public shares;
    mapping(address => uint256) public userPrincipal; // Track each user's principal

    // ===== EVENTS =====
    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted);
    event DeployedToStrategy(uint256 totalAssets, uint256 timestamp);
    event WithdrawWindowOpened(uint256 windowStart, uint256 windowEnd);
    event Withdrawn(address indexed user, uint256 amount, uint256 sharesBurned, uint256 yieldPaid);
    event YieldUpdated(uint256 yieldAdded, uint256 totalYield, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event PoolReset(uint256 timestamp);
    event RemainderToTreasury(uint256 amount, uint256 timestamp);

    // ===== CONSTRUCTOR =====
    constructor(
        address _arcUsdc,
        address _underlyingUsdc,
        address _treasury,
        uint256 _cap
    ) {
        arcUsdc = IERC20(_arcUsdc);
        underlyingUsdc = IERC20(_underlyingUsdc);
        treasury = _treasury;
        cap = _cap;
        state = State.COLLECTING;
        owner = msg.sender;
    }

    // ===== DEPOSIT (while COLLECTING) =====
    function deposit(uint256 amount) external {
        require(state == State.COLLECTING, "Not collecting");
        require(amount > 0, "Zero amount");

        uint256 assetsBefore = totalAssetsCollecting();

        bool success = arcUsdc.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        uint256 mintedShares = totalShares == 0
            ? amount
            : (amount * totalShares) / assetsBefore;

        shares[msg.sender] += mintedShares;
        totalShares += mintedShares;
        userPrincipal[msg.sender] += amount;

        emit Deposited(msg.sender, amount, mintedShares);
        
        // Auto-deploy when cap is reached
        uint256 currentAssets = totalAssetsCollecting();
        if (currentAssets >= cap) {
            _deployToStrategy();
        }
    }

    // ===== INTERNAL DEPLOY LOGIC =====
    function _deployToStrategy() internal {
        uint256 arcUsdcBalance = arcUsdc.balanceOf(address(this));
        
        // Step 1: Unwrap arcUSDC to USDC
        IArcUSDC(address(arcUsdc)).withdraw(arcUsdcBalance);
        
        uint256 usdcBalance = underlyingUsdc.balanceOf(address(this));
        
        // Step 2: Track deployed assets (held in contract)
        deployedAssets = usdcBalance;
        lastUpdate = block.timestamp;
        accumulatedYield = 0;
        deployedAt = block.timestamp;

        state = State.DEPLOYED;
        emit DeployedToStrategy(usdcBalance, block.timestamp);
    }

    // ===== PERMISSIONLESS DEPLOY =====
    function deployToStrategy() external {
        require(state == State.COLLECTING, "Already deployed");
        require(totalAssetsCollecting() >= cap, "Cap not reached");
        _deployToStrategy();
    }
    
    // ===== YIELD CALCULATION =====
    
    /**
     * @notice Calculate pending yield based on time elapsed
     * @dev 0.3% of principal per minute
     */
    function _calculatePendingYield() internal view returns (uint256) {
        if (state == State.COLLECTING || deployedAssets == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - lastUpdate;
        if (timeElapsed == 0) {
            return 0;
        }
        
        // Calculate minutes elapsed
        uint256 minutesElapsed = timeElapsed / 60;
        if (minutesElapsed == 0) {
            return 0;
        }
        
        // Yield = principal * 0.3% * minutes = principal * 30 / 10000 * minutes
        uint256 yield = (deployedAssets * YIELD_RATE_BPS_PER_MINUTE * minutesElapsed) / 10000;
        
        return yield;
    }
    
    /**
     * @notice Update accumulated yield
     */
    function _updateYield() internal {
        uint256 pendingYield = _calculatePendingYield();
        if (pendingYield > 0) {
            accumulatedYield += pendingYield;
            emit YieldUpdated(pendingYield, accumulatedYield, block.timestamp);
        }
        lastUpdate = block.timestamp;
    }

    // ===== VIEW: Is withdraw window open? =====
    function isWithdrawOpen() public view returns (bool) {
        if (state != State.DEPLOYED) return false;
        uint256 windowStart = deployedAt + WITHDRAW_DELAY;
        return block.timestamp >= windowStart;
    }
    
    // ===== VIEW: Time until withdraw opens =====
    function timeUntilWithdraw() public view returns (uint256) {
        if (state != State.DEPLOYED) return 0;
        uint256 windowStart = deployedAt + WITHDRAW_DELAY;
        if (block.timestamp >= windowStart) return 0;
        return windowStart - block.timestamp;
    }

    // ===== WITHDRAW WITH TREASURY-SUBSIDIZED YIELD =====
    function withdraw(uint256 shareAmount) external {
        require(state == State.DEPLOYED, "Not deployed");
        require(isWithdrawOpen(), "Withdraw window not open");
        require(shareAmount > 0, "Zero shares");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");
        
        // Update yield before withdrawal
        _updateYield();

        // Calculate user's share of total assets (principal + yield)
        uint256 currentTotal = totalAssetsDeployed();
        uint256 userAssets = (shareAmount * currentTotal) / totalShares;
        
        // Calculate user's principal portion being withdrawn
        uint256 userShareRatio = (shareAmount * 1e18) / shares[msg.sender];
        uint256 userPrincipalWithdrawn = (userPrincipal[msg.sender] * userShareRatio) / 1e18;
        
        // Calculate user's yield portion
        uint256 userYield = userAssets > userPrincipalWithdrawn ? userAssets - userPrincipalWithdrawn : 0;

        // Update state
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        userPrincipal[msg.sender] -= userPrincipalWithdrawn;
        
        // Update deployed assets and yield proportionally
        if (totalShares > 0) {
            deployedAssets = deployedAssets > userPrincipalWithdrawn ? deployedAssets - userPrincipalWithdrawn : 0;
            accumulatedYield = accumulatedYield > userYield ? accumulatedYield - userYield : 0;
        } else {
            deployedAssets = 0;
            accumulatedYield = 0;
        }
        
        // Get current USDC balance
        uint256 usdcBalance = underlyingUsdc.balanceOf(address(this));
        
        // If we need more than we have, pull from treasury
        if (userAssets > usdcBalance) {
            uint256 subsidyNeeded = userAssets - usdcBalance;
            bool subsidySuccess = underlyingUsdc.transferFrom(treasury, address(this), subsidyNeeded);
            require(subsidySuccess, "Treasury subsidy failed - ensure treasury has approved this contract");
        }
        
        // Wrap back to arcUSDC
        underlyingUsdc.approve(address(arcUsdc), userAssets);
        IArcUSDC(address(arcUsdc)).deposit(userAssets);
        
        // Transfer arcUSDC to user
        uint256 arcUsdcToSend = arcUsdc.balanceOf(address(this));
        bool success = arcUsdc.transfer(msg.sender, arcUsdcToSend);
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, arcUsdcToSend, shareAmount, userYield);
        
        // Auto-reset pool when all shares are withdrawn
        if (totalShares == 0) {
            _sendRemainderToTreasury();
            _resetPool();
        }
    }

    // ===== WITHDRAW ALL =====
    function withdrawAll() external {
        uint256 userShares = shares[msg.sender];
        require(userShares > 0, "No shares");
        this.withdraw(userShares);
    }
    
    // ===== SEND REMAINDER TO TREASURY =====
    function _sendRemainderToTreasury() internal {
        uint256 usdcRemainder = underlyingUsdc.balanceOf(address(this));
        if (usdcRemainder > 0) {
            bool success = underlyingUsdc.transfer(treasury, usdcRemainder);
            if (success) {
                emit RemainderToTreasury(usdcRemainder, block.timestamp);
            }
        }
        
        uint256 arcUsdcRemainder = arcUsdc.balanceOf(address(this));
        if (arcUsdcRemainder > 0) {
            bool success = arcUsdc.transfer(treasury, arcUsdcRemainder);
            if (success) {
                emit RemainderToTreasury(arcUsdcRemainder, block.timestamp);
            }
        }
    }
    
    // ===== INTERNAL RESET LOGIC =====
    function _resetPool() internal {
        state = State.COLLECTING;
        deployedAssets = 0;
        accumulatedYield = 0;
        lastUpdate = 0;
        deployedAt = 0;
        emit PoolReset(block.timestamp);
    }
    
    // ===== MANUAL RESET (owner only, emergency) =====
    function resetPool() external {
        require(msg.sender == owner, "Not owner");
        require(totalShares == 0, "Pool has active shares");
        _sendRemainderToTreasury();
        _resetPool();
    }

    // ===== VIEW FUNCTIONS =====
    
    function totalAssetsCollecting() public view returns (uint256) {
        return arcUsdc.balanceOf(address(this));
    }
    
    function totalAssetsDeployed() public view returns (uint256) {
        if (deployedAssets == 0) return 0;
        uint256 totalYield = accumulatedYield + _calculatePendingYield();
        return deployedAssets + totalYield;
    }
    
    function totalAssets() public view returns (uint256) {
        if (state == State.COLLECTING) {
            return totalAssetsCollecting();
        }
        return totalAssetsDeployed();
    }
    
    function yieldEarned() external view returns (uint256) {
        return accumulatedYield + _calculatePendingYield();
    }
    
    function previewWithdraw(address user) external view returns (uint256) {
        if (totalShares == 0 || shares[user] == 0) return 0;
        return (shares[user] * totalAssetsDeployed()) / totalShares;
    }
    
    function isCapReached() external view returns (bool) {
        return totalAssetsCollecting() >= cap;
    }
    
    function canWithdraw(address user) external view returns (bool) {
        return isWithdrawOpen() && shares[user] > 0;
    }
    
    function getMinutesElapsed() public view returns (uint256) {
        if (deployedAt == 0) return 0;
        return (block.timestamp - deployedAt) / 60;
    }
    
    function getYieldRateBps() external pure returns (uint256) {
        return YIELD_RATE_BPS_PER_MINUTE;
    }
    
    function currentAPY() external pure returns (string memory) {
        return "0.3% per minute (demo)";
    }

    // ===== OWNER FUNCTIONS =====
    
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "Not owner");
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    function setTreasury(address newTreasury) external {
        require(msg.sender == owner, "Not owner");
        require(newTreasury != address(0), "Invalid treasury");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }
    
    function setCap(uint256 newCap) external {
        require(msg.sender == owner, "Not owner");
        require(state == State.COLLECTING, "Cannot change cap after deployment");
        cap = newCap;
    }
}
