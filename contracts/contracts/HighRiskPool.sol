// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title HighRiskPool - HI.FI High Risk Pool with High Volatility Yield
 * @notice Vault with high volatility yield: higher potential gains but significant risk of loss
 * @dev Deploy on Base Sepolia with:
 *      _arcUsdc: Your ArcUSDC address
 *      _underlyingUsdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia USDC)
 *      _treasury: Treasury wallet address
 *      _cap: Pool capacity in USDC (6 decimals)
 * 
 * YIELD MECHANISM:
 * - High volatility yield: -0.5% to +1.0% per minute
 * - Higher probability of extreme outcomes (both positive and negative)
 * - Uses pseudo-random volatility with momentum simulation
 * - Treasury funds positive yields, absorbs losses
 * - Remainder after all withdrawals goes to treasury
 * 
 * RISK WARNING:
 * - Users can lose a significant portion of their principal
 * - High reward comes with high risk
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

contract HighRiskPool {
    enum State {
        COLLECTING,
        DEPLOYED,
        WITHDRAW_WINDOW
    }
    
    // Market sentiment for momentum simulation
    enum Sentiment {
        BEARISH,    // Biased towards losses
        NEUTRAL,    // Balanced
        BULLISH     // Biased towards gains
    }

    IERC20 public immutable arcUsdc;
    IERC20 public immutable underlyingUsdc;
    
    address public owner;
    address public treasury;
    uint256 public cap;
    uint256 public totalShares;
    State public state;
    
    // Withdraw window timing
    uint256 public deployedAt;
    uint256 public constant WITHDRAW_DELAY = 60; // 1 minute after deployment
    uint256 public constant WITHDRAW_WINDOW_DURATION = 3600; // 1 hour window
    
    // Simulated yield tracking
    uint256 public deployedAssets;      // Principal deployed
    uint256 public lastUpdate;          // Last time PnL was calculated
    int256 public accumulatedPnL;       // Accumulated profit/loss (CAN BE VERY NEGATIVE)
    
    // High risk yield parameters (basis points per minute)
    // Range: -50 to +100 bps (-0.5% to +1.0%) per minute
    int256 public constant MIN_RATE_BPS_PER_MIN = -50;   // -0.5% per minute (significant loss)
    int256 public constant MAX_RATE_BPS_PER_MIN = 100;   // +1.0% per minute (high gain)
    int256 public constant BASE_RATE_BPS_PER_MIN = 25;   // +0.25% per minute (base)
    
    // Market momentum (simulates market cycles)
    Sentiment public currentSentiment;
    uint256 public sentimentChangeTime;
    uint256 public constant SENTIMENT_DURATION = 30; // Sentiment changes every 30 seconds
    
    // Volatility seed for pseudo-random simulation
    uint256 public volatilitySeed;
    
    // Maximum loss cap (to prevent complete wipeout) - 50% of principal
    uint256 public constant MAX_LOSS_PERCENT = 50;

    mapping(address => uint256) public shares;
    mapping(address => uint256) public userPrincipal;

    // ===== EVENTS =====
    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted);
    event DeployedToStrategy(uint256 totalAssets, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount, uint256 sharesBurned, int256 pnlRealized);
    event PnLUpdated(int256 pnlChange, int256 newAccumulatedPnL, Sentiment sentiment, uint256 timestamp);
    event SentimentChanged(Sentiment oldSentiment, Sentiment newSentiment, uint256 timestamp);
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
        currentSentiment = Sentiment.NEUTRAL;
        volatilitySeed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender)));
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
        
        // Step 2: Track deployed assets
        deployedAssets = usdcBalance;
        lastUpdate = block.timestamp;
        accumulatedPnL = 0;
        deployedAt = block.timestamp;
        sentimentChangeTime = block.timestamp;
        
        // Initialize with random sentiment
        _updateSentiment();
        
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
    
    // ===== SENTIMENT SIMULATION (MARKET MOMENTUM) =====
    function _updateSentiment() internal {
        if (block.timestamp < sentimentChangeTime + SENTIMENT_DURATION) {
            return; // Sentiment hasn't changed yet
        }
        
        Sentiment oldSentiment = currentSentiment;
        
        // Random sentiment change
        uint256 seed = uint256(keccak256(abi.encodePacked(
            volatilitySeed,
            block.timestamp,
            block.number,
            "sentiment"
        )));
        
        uint256 roll = seed % 100;
        
        // Sentiment transition probabilities
        if (currentSentiment == Sentiment.NEUTRAL) {
            if (roll < 30) currentSentiment = Sentiment.BEARISH;
            else if (roll < 60) currentSentiment = Sentiment.BULLISH;
            // else stay NEUTRAL (40%)
        } else if (currentSentiment == Sentiment.BULLISH) {
            if (roll < 20) currentSentiment = Sentiment.BEARISH;
            else if (roll < 50) currentSentiment = Sentiment.NEUTRAL;
            // else stay BULLISH (50%)
        } else { // BEARISH
            if (roll < 20) currentSentiment = Sentiment.BULLISH;
            else if (roll < 50) currentSentiment = Sentiment.NEUTRAL;
            // else stay BEARISH (50%)
        }
        
        sentimentChangeTime = block.timestamp;
        
        if (oldSentiment != currentSentiment) {
            emit SentimentChanged(oldSentiment, currentSentiment, block.timestamp);
        }
    }
    
    // ===== PNL CALCULATION WITH HIGH VOLATILITY =====
    
    /**
     * @notice Calculate pending PnL based on time elapsed with high volatility
     * @dev Uses sentiment-biased pseudo-random to simulate volatile market
     * Range: -0.5% to +1.0% per minute
     */
    function _calculatePendingPnL() internal view returns (int256) {
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
        
        // Generate volatility factor with sentiment bias
        uint256 seed = uint256(keccak256(abi.encodePacked(
            volatilitySeed,
            block.timestamp,
            block.number
        )));
        
        // Base volatility range: -75 to +75 bps deviation
        int256 volatilityBps = int256((seed % 151)) - 75;
        
        // Apply sentiment bias
        int256 sentimentBias = 0;
        if (currentSentiment == Sentiment.BULLISH) {
            sentimentBias = 25; // +0.25% bias towards gains
        } else if (currentSentiment == Sentiment.BEARISH) {
            sentimentBias = -25; // -0.25% bias towards losses
        }
        
        // Effective rate = base + volatility + sentiment
        int256 effectiveRateBps = BASE_RATE_BPS_PER_MIN + volatilityBps + sentimentBias;
        
        // Clamp to bounds
        if (effectiveRateBps < MIN_RATE_BPS_PER_MIN) {
            effectiveRateBps = MIN_RATE_BPS_PER_MIN;
        }
        if (effectiveRateBps > MAX_RATE_BPS_PER_MIN) {
            effectiveRateBps = MAX_RATE_BPS_PER_MIN;
        }
        
        // Calculate PnL: principal * rate * minutes / 10000
        int256 pnl = (int256(deployedAssets) * effectiveRateBps * int256(minutesElapsed)) / 10000;
        
        return pnl;
    }
    
    /**
     * @notice Update accumulated PnL with loss cap
     */
    function _updatePnL() internal {
        _updateSentiment();
        
        int256 pendingPnL = _calculatePendingPnL();
        if (pendingPnL != 0) {
            int256 newPnL = accumulatedPnL + pendingPnL;
            
            // Apply maximum loss cap (50% of deployed assets)
            int256 maxLoss = -int256((deployedAssets * MAX_LOSS_PERCENT) / 100);
            if (newPnL < maxLoss) {
                newPnL = maxLoss;
            }
            
            accumulatedPnL = newPnL;
            
            // Update volatility seed
            volatilitySeed = uint256(keccak256(abi.encodePacked(
                volatilitySeed,
                block.timestamp,
                pendingPnL
            )));
            
            emit PnLUpdated(pendingPnL, accumulatedPnL, currentSentiment, block.timestamp);
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

    // ===== WITHDRAW WITH HIGH VOLATILITY YIELD/LOSS =====
    function withdraw(uint256 shareAmount) external {
        require(state == State.DEPLOYED, "Not deployed");
        require(isWithdrawOpen(), "Withdraw window not open");
        require(shareAmount > 0, "Zero shares");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");
        
        // Update PnL before withdrawal
        _updatePnL();

        // Calculate user's share of total assets
        uint256 currentTotal = totalAssetsDeployed();
        uint256 userAssets = (shareAmount * currentTotal) / totalShares;
        
        // Calculate user's principal and PnL
        uint256 userShareRatio = (shareAmount * 1e18) / shares[msg.sender];
        uint256 userPrincipalWithdrawn = (userPrincipal[msg.sender] * userShareRatio) / 1e18;
        int256 userPnL = int256(userAssets) - int256(userPrincipalWithdrawn);

        // Update state
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        userPrincipal[msg.sender] -= userPrincipalWithdrawn;
        
        // Update deployed assets and PnL proportionally
        if (totalShares > 0) {
            uint256 assetsToRemove = (deployedAssets * shareAmount) / (totalShares + shareAmount);
            deployedAssets = deployedAssets > assetsToRemove ? deployedAssets - assetsToRemove : 0;
            
            int256 pnlToRemove = (accumulatedPnL * int256(shareAmount)) / int256(totalShares + shareAmount);
            accumulatedPnL -= pnlToRemove;
        } else {
            deployedAssets = 0;
            accumulatedPnL = 0;
        }
        
        // Get current USDC balance
        uint256 usdcBalance = underlyingUsdc.balanceOf(address(this));
        
        // Handle positive yield case (need treasury subsidy)
        if (userAssets > usdcBalance) {
            uint256 subsidyNeeded = userAssets - usdcBalance;
            bool subsidySuccess = underlyingUsdc.transferFrom(treasury, address(this), subsidyNeeded);
            require(subsidySuccess, "Treasury subsidy failed");
        }
        
        // Cap at actual balance
        if (userAssets > underlyingUsdc.balanceOf(address(this))) {
            userAssets = underlyingUsdc.balanceOf(address(this));
        }
        
        // Wrap back to arcUSDC
        underlyingUsdc.approve(address(arcUsdc), userAssets);
        IArcUSDC(address(arcUsdc)).deposit(userAssets);
        
        // Transfer arcUSDC to user
        uint256 arcUsdcToSend = arcUsdc.balanceOf(address(this));
        bool success = arcUsdc.transfer(msg.sender, arcUsdcToSend);
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, arcUsdcToSend, shareAmount, userPnL);
        
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
        accumulatedPnL = 0;
        lastUpdate = 0;
        deployedAt = 0;
        currentSentiment = Sentiment.NEUTRAL;
        volatilitySeed = uint256(keccak256(abi.encodePacked(
            volatilitySeed,
            block.timestamp,
            block.prevrandao
        )));
        emit PoolReset(block.timestamp);
    }
    
    // ===== MANUAL RESET =====
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
        
        int256 totalPnL = accumulatedPnL + _calculatePendingPnL();
        
        // Apply max loss cap in view
        int256 maxLoss = -int256((deployedAssets * MAX_LOSS_PERCENT) / 100);
        if (totalPnL < maxLoss) {
            totalPnL = maxLoss;
        }
        
        if (totalPnL >= 0) {
            return deployedAssets + uint256(totalPnL);
        } else {
            uint256 loss = uint256(-totalPnL);
            return deployedAssets - loss;
        }
    }
    
    function totalAssets() public view returns (uint256) {
        if (state == State.COLLECTING) {
            return totalAssetsCollecting();
        }
        return totalAssetsDeployed();
    }
    
    function currentPnL() external view returns (int256) {
        int256 totalPnL = accumulatedPnL + _calculatePendingPnL();
        int256 maxLoss = -int256((deployedAssets * MAX_LOSS_PERCENT) / 100);
        if (totalPnL < maxLoss) {
            return maxLoss;
        }
        return totalPnL;
    }
    
    function getSentiment() external view returns (string memory) {
        if (currentSentiment == Sentiment.BULLISH) return "BULLISH";
        if (currentSentiment == Sentiment.BEARISH) return "BEARISH";
        return "NEUTRAL";
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
    
    function currentAPY() external pure returns (string memory) {
        return "-0.5% to +1.0% per minute (high volatility, high risk)";
    }
    
    function getMaxLossPercent() external pure returns (uint256) {
        return MAX_LOSS_PERCENT;
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
