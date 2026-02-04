// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PoolVaultMediumRisk - HI.FI Investment Pool with Simulated Medium Risk Strategy
 * @notice Vault with internal simulated medium-risk adapter (no external protocol)
 * @dev Deploy on Base Sepolia with:
 *      _arcUsdc: Your ArcUSDC address
 *      _underlyingUsdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia USDC)
 *      _cap: 10000000 (10 USDC with 6 decimals for testing)
 * 
 * Strategy: Simulated medium-risk with bounded returns
 * - Annualized yield range: -2% to +6%
 * - Time-based PnL calculation
 * - Higher average yield than Aave but with downside risk
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

// Interface for ArcUSDC wrap/unwrap
interface IArcUSDC {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
}

contract PoolVaultMediumRisk {
    enum State {
        COLLECTING,
        DEPLOYED,
        WITHDRAW_WINDOW
    }

    IERC20 public immutable arcUsdc;
    IERC20 public immutable underlyingUsdc;
    
    address public owner;
    uint256 public cap;
    uint256 public totalShares;
    State public state;
    
    // Withdraw window timing
    uint256 public deployedAt;
    uint256 public constant WITHDRAW_DELAY = 60; // 1 minute after deployment (for testing)
    uint256 public constant WITHDRAW_WINDOW_DURATION = 3600; // 1 hour window
    
    // === INTERNAL MEDIUM-RISK ADAPTER STATE ===
    uint256 public deployedAssets;      // Principal deployed
    uint256 public lastUpdate;          // Last time PnL was calculated
    int256 public accumulatedPnL;       // Accumulated profit/loss (can be negative)
    
    // Strategy parameters (basis points)
    // Range: -2% to +6% annualized
    int256 public constant MIN_ANNUAL_RATE_BPS = -200;   // -2%
    int256 public constant MAX_ANNUAL_RATE_BPS = 600;    // +6%
    int256 public constant BASE_ANNUAL_RATE_BPS = 400;   // +4% base rate
    
    // Volatility seed (changes based on block data for simulation)
    uint256 public volatilitySeed;

    mapping(address => uint256) public shares;

    // ===== EVENTS =====
    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted);
    event DeployedToStrategy(uint256 totalAssets, uint256 timestamp);
    event WithdrawWindowOpened(uint256 windowStart, uint256 windowEnd);
    event Withdrawn(address indexed user, uint256 amount, uint256 sharesBurned);
    event PnLUpdated(int256 pnlChange, int256 newAccumulatedPnL, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PoolReset(uint256 timestamp); // New event for pool reset

    // ===== CONSTRUCTOR =====
    constructor(
        address _arcUsdc,
        address _underlyingUsdc,
        uint256 _cap
    ) {
        arcUsdc = IERC20(_arcUsdc);
        underlyingUsdc = IERC20(_underlyingUsdc);
        cap = _cap;
        state = State.COLLECTING;
        owner = msg.sender;
        volatilitySeed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender)));
    }

    // ===== DEPOSIT (while COLLECTING) =====
    // Auto-deploys to strategy when cap is reached
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
        
        // Step 1: Withdraw USDC from arcUSDC (unwrap)
        IArcUSDC(address(arcUsdc)).withdraw(arcUsdcBalance);
        
        uint256 usdcBalance = underlyingUsdc.balanceOf(address(this));
        
        // Step 2: "Deploy" to internal strategy (just track the amount)
        deployedAssets = usdcBalance;
        lastUpdate = block.timestamp;
        accumulatedPnL = 0;
        deployedAt = block.timestamp;
        
        // Update volatility seed for this deployment cycle
        volatilitySeed = uint256(keccak256(abi.encodePacked(
            volatilitySeed, 
            block.timestamp, 
            block.prevrandao, 
            usdcBalance
        )));

        state = State.DEPLOYED;
        emit DeployedToStrategy(usdcBalance, block.timestamp);
    }

    // ===== PERMISSIONLESS DEPLOY TO STRATEGY =====
    // Anyone can call this once cap is reached (backup if auto-deploy fails)
    function deployToStrategy() external {
        require(state == State.COLLECTING, "Already deployed");
        require(totalAssetsCollecting() >= cap, "Cap not reached");
        _deployToStrategy();
    }
    
    // ===== INTERNAL MEDIUM-RISK ADAPTER LOGIC =====
    
    /**
     * @notice Calculate simulated PnL based on time elapsed
     * @dev Uses pseudo-random volatility to simulate market conditions
     * - Base rate: +4% annualized
     * - Random volatility: -6% to +2% deviation
     * - Final range: -2% to +6% annualized
     */
    function _calculatePendingPnL() internal view returns (int256) {
        if (state == State.COLLECTING || deployedAssets == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - lastUpdate;
        if (timeElapsed == 0) {
            return 0;
        }
        
        // Calculate volatility factor for this period
        // Range: -600 to +200 bps deviation from base rate
        uint256 seed = uint256(keccak256(abi.encodePacked(
            volatilitySeed,
            block.timestamp,
            block.number
        )));
        
        // volatilityBps ranges from -600 to +200
        int256 volatilityBps = int256((seed % 801)) - 600; // -600 to +200
        
        // Effective rate = base rate + volatility
        // Range: 400 + (-600 to +200) = -200 to +600 bps = -2% to +6%
        int256 effectiveAnnualRateBps = BASE_ANNUAL_RATE_BPS + volatilityBps;
        
        // Clamp to bounds (safety check)
        if (effectiveAnnualRateBps < MIN_ANNUAL_RATE_BPS) {
            effectiveAnnualRateBps = MIN_ANNUAL_RATE_BPS;
        }
        if (effectiveAnnualRateBps > MAX_ANNUAL_RATE_BPS) {
            effectiveAnnualRateBps = MAX_ANNUAL_RATE_BPS;
        }
        
        // Calculate PnL: principal * rate * time / (10000 * seconds_per_year)
        // Using 365 days = 31536000 seconds
        int256 pnl = (int256(deployedAssets) * effectiveAnnualRateBps * int256(timeElapsed)) 
                     / (10000 * 31536000);
        
        return pnl;
    }
    
    /**
     * @notice Update accumulated PnL (called internally)
     */
    function _updatePnL() internal {
        int256 pendingPnL = _calculatePendingPnL();
        if (pendingPnL != 0) {
            accumulatedPnL += pendingPnL;
            
            // Update volatility seed for next period
            volatilitySeed = uint256(keccak256(abi.encodePacked(
                volatilitySeed,
                block.timestamp,
                pendingPnL
            )));
            
            emit PnLUpdated(pendingPnL, accumulatedPnL, block.timestamp);
        }
        lastUpdate = block.timestamp;
    }

    // ===== VIEW: Is withdraw window open? =====
    function isWithdrawOpen() public view returns (bool) {
        if (state != State.DEPLOYED) return false;
        uint256 windowStart = deployedAt + WITHDRAW_DELAY;
        uint256 windowEnd = windowStart + WITHDRAW_WINDOW_DURATION;
        return block.timestamp >= windowStart && block.timestamp <= windowEnd;
    }
    
    // ===== VIEW: Time until withdraw opens =====
    function timeUntilWithdraw() public view returns (uint256) {
        if (state != State.DEPLOYED) return 0;
        uint256 windowStart = deployedAt + WITHDRAW_DELAY;
        if (block.timestamp >= windowStart) return 0;
        return windowStart - block.timestamp;
    }

    // ===== WITHDRAW =====
    function withdraw(uint256 shareAmount) external {
        require(state == State.DEPLOYED, "Not deployed");
        require(isWithdrawOpen(), "Withdraw window not open");
        require(shareAmount > 0, "Zero shares");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");
        
        // Update PnL before withdrawal
        _updatePnL();

        // Calculate user's share of total assets (principal + accumulated PnL)
        uint256 currentTotal = totalAssetsDeployed();
        uint256 userAssets = (shareAmount * currentTotal) / totalShares;

        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        
        // Update deployed assets proportionally
        if (totalShares > 0) {
            deployedAssets = currentTotal - userAssets;
            // Reset PnL tracking for remaining assets
            accumulatedPnL = 0;
        } else {
            deployedAssets = 0;
            accumulatedPnL = 0;
        }
        
        // Ensure we have enough USDC
        uint256 usdcBalance = underlyingUsdc.balanceOf(address(this));
        
        // If simulated assets > actual balance, cap at actual balance
        // This handles the case where PnL was positive but we only have principal
        if (userAssets > usdcBalance) {
            userAssets = usdcBalance;
        }
        
        // Wrap back to arcUSDC
        underlyingUsdc.approve(address(arcUsdc), userAssets);
        IArcUSDC(address(arcUsdc)).deposit(userAssets);
        
        // Transfer arcUSDC to user
        uint256 arcUsdcBalance = arcUsdc.balanceOf(address(this));
        bool success = arcUsdc.transfer(msg.sender, arcUsdcBalance);
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, arcUsdcBalance, shareAmount);
        
        // Auto-reset pool when all shares are withdrawn
        if (totalShares == 0) {
            _resetPool();
        }
    }
    
    // ===== INTERNAL RESET LOGIC =====
    function _resetPool() internal {
        state = State.COLLECTING;
        deployedAssets = 0;
        accumulatedPnL = 0;
        lastUpdate = 0;
        deployedAt = 0;
        // Update volatility seed for next cycle
        volatilitySeed = uint256(keccak256(abi.encodePacked(
            volatilitySeed,
            block.timestamp,
            block.prevrandao
        )));
        emit PoolReset(block.timestamp);
    }
    
    // ===== MANUAL RESET (owner only, emergency) =====
    function resetPool() external {
        require(msg.sender == owner, "Not owner");
        require(totalShares == 0, "Pool has active shares");
        _resetPool();
    }

    // ===== WITHDRAW ALL (convenience function) =====
    function withdrawAll() external {
        uint256 userShares = shares[msg.sender];
        require(userShares > 0, "No shares");
        
        // Call withdraw with all user shares
        this.withdraw(userShares);
    }

    // ===== VIEW FUNCTIONS =====
    
    // TVL while collecting (arcUSDC balance)
    function totalAssetsCollecting() public view returns (uint256) {
        return arcUsdc.balanceOf(address(this));
    }
    
    // TVL while deployed (principal + simulated PnL)
    function totalAssetsDeployed() public view returns (uint256) {
        if (deployedAssets == 0) return 0;
        
        // Calculate current PnL (including pending)
        int256 totalPnL = accumulatedPnL + _calculatePendingPnL();
        
        // Apply PnL to principal
        if (totalPnL >= 0) {
            return deployedAssets + uint256(totalPnL);
        } else {
            // Ensure we don't go below 0
            uint256 loss = uint256(-totalPnL);
            if (loss >= deployedAssets) {
                return 0;
            }
            return deployedAssets - loss;
        }
    }
    
    // Total assets (works in any state)
    function totalAssets() public view returns (uint256) {
        if (state == State.COLLECTING) {
            return totalAssetsCollecting();
        } else {
            return totalAssetsDeployed();
        }
    }
    
    // Yield earned (can be negative for medium risk)
    function yieldEarned() external view returns (uint256) {
        if (state == State.COLLECTING) return 0;
        
        int256 totalPnL = accumulatedPnL + _calculatePendingPnL();
        
        // Only return positive yield
        if (totalPnL > 0) {
            return uint256(totalPnL);
        }
        return 0;
    }
    
    // Get current simulated PnL (can be negative)
    function currentPnL() external view returns (int256) {
        if (state == State.COLLECTING) return 0;
        return accumulatedPnL + _calculatePendingPnL();
    }
    
    // Preview user's withdrawable amount
    function previewWithdraw(address user) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[user] * totalAssets()) / totalShares;
    }
    
    // Check if cap is reached (for UI)
    function isCapReached() external view returns (bool) {
        return totalAssetsCollecting() >= cap;
    }
    
    // Check if user can withdraw
    function canWithdraw(address user) external view returns (bool) {
        return state == State.DEPLOYED 
            && isWithdrawOpen()
            && shares[user] > 0;
    }
    
    // Get current effective annual rate (for UI display)
    function getCurrentAnnualRate() external view returns (int256) {
        if (state == State.COLLECTING || deployedAssets == 0) {
            return BASE_ANNUAL_RATE_BPS; // Return base rate when not deployed
        }
        
        uint256 seed = uint256(keccak256(abi.encodePacked(
            volatilitySeed,
            block.timestamp,
            block.number
        )));
        
        int256 volatilityBps = int256((seed % 801)) - 600;
        int256 effectiveRate = BASE_ANNUAL_RATE_BPS + volatilityBps;
        
        // Clamp to bounds
        if (effectiveRate < MIN_ANNUAL_RATE_BPS) {
            effectiveRate = MIN_ANNUAL_RATE_BPS;
        }
        if (effectiveRate > MAX_ANNUAL_RATE_BPS) {
            effectiveRate = MAX_ANNUAL_RATE_BPS;
        }
        
        return effectiveRate;
    }

    // ===== OWNER FUNCTIONS =====
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "Not owner");
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    // Emergency function to recover stuck funds (owner only)
    function emergencyWithdraw(address token, uint256 amount, address to) external {
        require(msg.sender == owner, "Not owner");
        IERC20(token).transfer(to, amount);
    }
}
