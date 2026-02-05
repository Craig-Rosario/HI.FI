// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PoolVaultHighRisk - HI.FI Investment Pool with High Risk/High Reward Strategy
 * @notice Vault with aggressive simulated strategy - HIGH VOLATILITY, CAN LOSE PRINCIPAL
 * @dev Deploy on Base Sepolia with:
 *      _arcUsdc: Your ArcUSDC address
 *      _underlyingUsdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia USDC)
 *      _cap: 10000000 (10 USDC with 6 decimals for testing)
 * 
 * ⚠️ HIGH RISK STRATEGY:
 * - Annualized yield range: -20% to +30%
 * - Can have sharp positive swings
 * - Can REDUCE principal significantly
 * - Suitable for risk-tolerant users only
 * - Volatility increases over time
 * - "Liquidation events" can occur
 * 
 * Demo Features:
 * - Time-based volatility amplification
 * - Simulated market crash scenarios
 * - Aggressive leverage simulation
 * - Principal protection: MIN -50% (never goes below 50% of initial)
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

contract PoolVaultHighRisk {
    enum State {
        COLLECTING,
        DEPLOYED,
        WITHDRAW_WINDOW,
        LIQUIDATED  // New state for extreme loss scenario
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
    
    // === HIGH-RISK STRATEGY STATE ===
    uint256 public deployedAssets;      // Principal deployed
    uint256 public lastUpdate;          // Last time PnL was calculated
    int256 public accumulatedPnL;       // Accumulated profit/loss (can be heavily negative)
    
    // Strategy parameters (basis points)
    // Range: -20% to +30% annualized
    int256 public constant MIN_ANNUAL_RATE_BPS = -2000;   // -20%
    int256 public constant MAX_ANNUAL_RATE_BPS = 3000;    // +30%
    int256 public constant BASE_ANNUAL_RATE_BPS = 1000;   // +10% base rate
    
    // Volatility parameters
    uint256 public volatilitySeed;
    uint256 public volatilityAmplifier = 100; // Starts at 1.0x, increases over time
    
    // Principal protection: never go below 50% of deployed amount
    int256 public constant MIN_PRINCIPAL_PROTECTION_BPS = -5000; // -50%
    
    // Simulated "leverage" - amplifies gains AND losses
    uint256 public constant LEVERAGE_FACTOR = 150; // 1.5x effective leverage
    
    // Market crash simulation
    uint256 public lastCrashCheck;
    uint256 public constant CRASH_CHECK_INTERVAL = 300; // Check every 5 minutes
    uint256 public constant CRASH_PROBABILITY = 5; // 5% chance per check when conditions met

    mapping(address => uint256) public shares;
    
    // Track user entry points for risk calculation
    mapping(address => uint256) public userEntryTime;

    // ===== EVENTS =====
    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted);
    event DeployedToStrategy(uint256 totalAssets, uint256 timestamp);
    event WithdrawWindowOpened(uint256 windowStart, uint256 windowEnd);
    event Withdrawn(address indexed user, uint256 amount, uint256 sharesBurned, int256 pnl);
    event PnLUpdated(int256 pnlChange, int256 newAccumulatedPnL, uint256 timestamp, bool isVolatileSwing);
    event MarketCrashEvent(int256 lossAmount, uint256 timestamp);
    event VolatilityIncreased(uint256 newAmplifier);
    event LiquidationTriggered(uint256 remainingAssets, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PoolReset(uint256 timestamp);

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
        lastCrashCheck = block.timestamp;
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
        userEntryTime[msg.sender] = block.timestamp;

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
        
        // Step 2: "Deploy" to high-risk strategy
        deployedAssets = usdcBalance;
        lastUpdate = block.timestamp;
        accumulatedPnL = 0;
        deployedAt = block.timestamp;
        lastCrashCheck = block.timestamp;
        volatilityAmplifier = 100; // Reset to 1.0x
        
        // Update volatility seed
        volatilitySeed = uint256(keccak256(abi.encodePacked(
            volatilitySeed, 
            block.timestamp, 
            block.prevrandao, 
            usdcBalance
        )));

        state = State.DEPLOYED;
        emit DeployedToStrategy(usdcBalance, block.timestamp);
    }

    // ===== PERMISSIONLESS DEPLOY =====
    function deployToStrategy() external {
        require(state == State.COLLECTING, "Already deployed");
        require(totalAssetsCollecting() >= cap, "Cap not reached");
        _deployToStrategy();
    }
    
    // ===== HIGH-RISK PNL CALCULATION =====
    
    /**
     * @notice Calculate high-volatility PnL with leverage and crash scenarios
     * @dev Implements:
     * - Time-based volatility amplification
     * - Leverage effects (1.5x)
     * - Random market swings
     * - Simulated crash events
     * - Principal protection floor (-50% max loss)
     */
    function _calculatePendingPnL() internal view returns (int256) {
        if (state == State.COLLECTING || state == State.LIQUIDATED || deployedAssets == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - lastUpdate;
        if (timeElapsed == 0) {
            return 0;
        }
        
        // Increase volatility over time (more time = more risk)
        uint256 timeBasedMultiplier = 100 + (timeElapsed / 60); // +1% per minute
        uint256 effectiveVolatility = (volatilityAmplifier * timeBasedMultiplier) / 100;
        
        // Generate pseudo-random volatility
        uint256 seed = uint256(keccak256(abi.encodePacked(
            volatilitySeed,
            block.timestamp,
            block.number,
            block.prevrandao
        )));
        
        // High volatility range: -2400 to +2000 bps deviation from base
        // This gives us -14% to +30% range around the +10% base
        int256 volatilityBps = int256((seed % 4401)) - 2400;
        
        // Apply volatility amplifier
        volatilityBps = (volatilityBps * int256(effectiveVolatility)) / 100;
        
        // Calculate effective rate with leverage
        int256 effectiveAnnualRateBps = BASE_ANNUAL_RATE_BPS + volatilityBps;
        effectiveAnnualRateBps = (effectiveAnnualRateBps * int256(LEVERAGE_FACTOR)) / 100;
        
        // Clamp to bounds
        if (effectiveAnnualRateBps < MIN_ANNUAL_RATE_BPS) {
            effectiveAnnualRateBps = MIN_ANNUAL_RATE_BPS;
        }
        if (effectiveAnnualRateBps > MAX_ANNUAL_RATE_BPS) {
            effectiveAnnualRateBps = MAX_ANNUAL_RATE_BPS;
        }
        
        // Calculate base PnL
        int256 pnl = (int256(deployedAssets) * effectiveAnnualRateBps * int256(timeElapsed)) 
                     / (10000 * 31536000);
        
        return pnl;
    }
    
    /**
     * @notice Check for simulated market crash event
     * @dev 5% chance of crash if enough time has passed
     */
    function _checkForMarketCrash() internal returns (bool) {
        if (block.timestamp < lastCrashCheck + CRASH_CHECK_INTERVAL) {
            return false;
        }
        
        lastCrashCheck = block.timestamp;
        
        // Generate random number for crash probability
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            volatilitySeed,
            "crash_check"
        ))) % 100;
        
        if (random < CRASH_PROBABILITY) {
            // Crash event: sudden 10-20% loss
            uint256 lossPercent = 10 + (random % 11); // 10-20%
            int256 crashLoss = -int256((deployedAssets * lossPercent) / 100);
            
            accumulatedPnL += crashLoss;
            
            emit MarketCrashEvent(crashLoss, block.timestamp);
            return true;
        }
        
        return false;
    }
    
    /**
     * @notice Update PnL and check for extreme events
     */
    function _updatePnL() internal {
        // Check for market crash
        bool crashed = _checkForMarketCrash();
        
        // Calculate regular PnL
        int256 pendingPnL = _calculatePendingPnL();
        bool isVolatileSwing = false;
        
        if (pendingPnL != 0) {
            accumulatedPnL += pendingPnL;
            
            // Check if this is a volatile swing (>5% in one update)
            int256 swingBps = (pendingPnL * 10000) / int256(deployedAssets);
            if (swingBps > 500 || swingBps < -500) {
                isVolatileSwing = true;
            }
            
            // Update volatility seed
            volatilitySeed = uint256(keccak256(abi.encodePacked(
                volatilitySeed,
                block.timestamp,
                pendingPnL
            )));
            
            emit PnLUpdated(pendingPnL, accumulatedPnL, block.timestamp, isVolatileSwing);
        }
        
        // Gradually increase volatility over time
        if (block.timestamp > lastUpdate + 60) { // Every minute
            volatilityAmplifier += 5; // Increase by 5% per minute
            if (volatilityAmplifier > 300) { // Cap at 3x
                volatilityAmplifier = 300;
            }
            emit VolatilityIncreased(volatilityAmplifier);
        }
        
        // Check for liquidation scenario
        int256 minAllowedPnL = (int256(deployedAssets) * MIN_PRINCIPAL_PROTECTION_BPS) / 10000;
        if (accumulatedPnL < minAllowedPnL) {
            // Liquidation triggered - lock at minimum
            accumulatedPnL = minAllowedPnL;
            state = State.LIQUIDATED;
            emit LiquidationTriggered(uint256(int256(deployedAssets) + accumulatedPnL), block.timestamp);
        }
        
        lastUpdate = block.timestamp;
    }

    // ===== VIEWS =====
    
    function isWithdrawOpen() public view returns (bool) {
        if (state != State.DEPLOYED && state != State.LIQUIDATED) return false;
        uint256 windowStart = deployedAt + WITHDRAW_DELAY;
        uint256 windowEnd = windowStart + WITHDRAW_WINDOW_DURATION;
        return block.timestamp >= windowStart && block.timestamp <= windowEnd;
    }
    
    function timeUntilWithdraw() public view returns (uint256) {
        if (state != State.DEPLOYED && state != State.LIQUIDATED) return 0;
        uint256 windowStart = deployedAt + WITHDRAW_DELAY;
        if (block.timestamp >= windowStart) return 0;
        return windowStart - block.timestamp;
    }
    
    function totalAssetsCollecting() public view returns (uint256) {
        if (state != State.COLLECTING) return 0;
        return arcUsdc.balanceOf(address(this));
    }
    
    function currentPnL() public view returns (int256) {
        if (state == State.COLLECTING) return 0;
        
        int256 pending = _calculatePendingPnL();
        return accumulatedPnL + pending;
    }
    
    function totalAssetsDeployed() public view returns (uint256) {
        if (state == State.COLLECTING) return 0;
        
        int256 totalValue = int256(deployedAssets) + currentPnL();
        
        // Never return negative
        if (totalValue < 0) return 0;
        
        return uint256(totalValue);
    }
    
    /**
     * @notice Get risk metrics for display
     */
    function getRiskMetrics() public view returns (
        uint256 currentVolatility,
        int256 currentPnLPercent,
        uint256 timeInMarket,
        bool isLiquidated
    ) {
        currentVolatility = volatilityAmplifier;
        
        if (deployedAssets > 0) {
            currentPnLPercent = (currentPnL() * 10000) / int256(deployedAssets);
        } else {
            currentPnLPercent = 0;
        }
        
        if (state == State.DEPLOYED || state == State.LIQUIDATED) {
            timeInMarket = block.timestamp - deployedAt;
        } else {
            timeInMarket = 0;
        }
        
        isLiquidated = (state == State.LIQUIDATED);
        
        return (currentVolatility, currentPnLPercent, timeInMarket, isLiquidated);
    }

    // ===== WITHDRAW =====
    function withdraw(uint256 shareAmount) external {
        require(state == State.DEPLOYED || state == State.LIQUIDATED, "Not deployed");
        require(isWithdrawOpen(), "Withdraw window not open");
        require(shareAmount > 0, "Zero shares");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");
        
        // Update PnL before withdrawal (unless already liquidated)
        if (state != State.LIQUIDATED) {
            _updatePnL();
        }

        // Calculate user's share of total value (can be less than principal!)
        int256 totalValue = int256(deployedAssets) + accumulatedPnL;
        
        // Safety: ensure totalValue doesn't go negative
        if (totalValue < 0) totalValue = 0;
        
        uint256 userAmount = (uint256(totalValue) * shareAmount) / totalShares;
        
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        
        // Calculate user's PnL
        uint256 userPrincipal = (deployedAssets * shareAmount) / (totalShares + shareAmount);
        int256 userPnL = int256(userAmount) - int256(userPrincipal);

        // Unwrap if needed and transfer
        uint256 usdcBalance = underlyingUsdc.balanceOf(address(this));
        if (usdcBalance < userAmount) {
            // Need to wrap remaining USDC to arcUSDC
            uint256 needed = userAmount - usdcBalance;
            IArcUSDC(address(arcUsdc)).deposit(needed);
        }
        
        bool success = underlyingUsdc.transfer(msg.sender, userAmount);
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, userAmount, shareAmount, userPnL);
        
        // Auto-reset if all shares withdrawn
        if (totalShares == 0) {
            _resetPool();
        }
    }

    // ===== RESET POOL =====
    function _resetPool() internal {
        // Wrap any remaining USDC back to arcUSDC
        uint256 remaining = underlyingUsdc.balanceOf(address(this));
        if (remaining > 0) {
            underlyingUsdc.approve(address(arcUsdc), remaining);
            IArcUSDC(address(arcUsdc)).deposit(remaining);
        }
        
        deployedAssets = 0;
        accumulatedPnL = 0;
        lastUpdate = 0;
        deployedAt = 0;
        volatilityAmplifier = 100;
        state = State.COLLECTING;
        
        emit PoolReset(block.timestamp);
    }

    // ===== OWNER FUNCTIONS =====
    
    function setCap(uint256 newCap) external {
        require(msg.sender == owner, "Not owner");
        cap = newCap;
    }
    
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "Not owner");
        require(newOwner != address(0), "Invalid address");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
    
    /**
     * @notice Force update PnL (useful for demo/testing)
     */
    function forceUpdatePnL() external {
        require(state == State.DEPLOYED, "Not deployed");
        _updatePnL();
    }
}
