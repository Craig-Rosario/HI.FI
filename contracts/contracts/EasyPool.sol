// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title EasyPool - HI.FI Investment Pool with Aave + Treasury-Subsidized Demo Yield
 * @notice Vault that deploys funds to Aave when cap is reached, with treasury-funded demo yield top-up
 * @dev Deploy on Base Sepolia with:
 *      _arcUsdc: Your ArcUSDC address
 *      _underlyingUsdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia USDC)
 *      _aavePool: 0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b (Aave V3 Pool on Base Sepolia)
 *      _aToken: aUSDC address on Base Sepolia
 *      _cap: 10000000 (10 USDC with 6 decimals for testing)
 * 
 * DEMO YIELD MECHANISM:
 * - Treasury address: 0x6D41680267986408E5e7c175Ee0622cA931859A4
 * - Fixed yield: 0.03 USDC per minute after deployment
 * - Example: 10 USDC deposited → after 1 min → 10.03 USDC returned
 * - On withdraw: Treasury subsidizes the 0.03 USDC per minute yield
 * - This is SUBSIDIZED DEMO YIELD, not real Aave yield
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}

interface IArcUSDC {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
}

contract EasyPool {
    enum State {
        COLLECTING,
        DEPLOYED,
        WITHDRAW_WINDOW
    }

    IERC20 public immutable arcUsdc;
    IAavePool public immutable aavePool;
    IERC20 public immutable underlyingUsdc;
    IAToken public aToken;
    
    address public owner;
    uint256 public cap;
    uint256 public totalShares;
    State public state;
    uint256 public withdrawWindowEnd;
    
    // Track principal deposited to Aave for yield calculation
    uint256 public principalDeposited;
    
    // Track when funds were deployed to Aave for time-based yield calculation
    uint256 public deployedTimestamp;

    mapping(address => uint256) public shares;
    
    // Track each user's deposit time for pro-rata yield calculation
    mapping(address => uint256) public userDepositTimestamp;
    mapping(address => uint256) public userPrincipal;

    // ===== DEMO YIELD CONFIGURATION =====
    // Treasury address that funds the subsidy
    address public constant TREASURY = 0x6D41680267986408E5e7c175Ee0622cA931859A4;
    
    // Fixed yield per minute: 0.03 USDC = 30000 (6 decimals)
    // Every minute after deployment, user earns 0.03 USDC
    uint256 public constant YIELD_PER_MINUTE = 30000; // 0.03 USDC in 6 decimals
    
    // Optional hard cap per withdrawal to limit subsidy (in USDC 6 decimals)
    // Set to 0 to disable cap, or e.g., 1000000 for max 1 USDC subsidy per withdrawal
    uint256 public maxSubsidyPerWithdraw = 0; // Disabled by default

    // ===== EVENTS =====
    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted);
    event DeployedToAave(uint256 totalAssets, uint256 timestamp);
    event WithdrawWindowOpened(uint256 windowEnd);
    event Withdrawn(address indexed user, uint256 amount, uint256 sharesBurned, uint256 subsidyPaid);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SubsidyCapUpdated(uint256 newCap);

    // ===== CONSTRUCTOR =====
    constructor(
        address _arcUsdc,
        address _underlyingUsdc,
        address _aavePool,
        address _aToken,
        uint256 _cap
    ) {
        arcUsdc = IERC20(_arcUsdc);
        underlyingUsdc = IERC20(_underlyingUsdc);
        aavePool = IAavePool(_aavePool);
        aToken = IAToken(_aToken);
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
        
        // Track user's principal and deposit time for yield calculation
        userPrincipal[msg.sender] += amount;
        if (userDepositTimestamp[msg.sender] == 0) {
            userDepositTimestamp[msg.sender] = block.timestamp;
        }

        require(totalAssetsCollecting() <= cap, "Cap exceeded");

        emit Deposited(msg.sender, amount, mintedShares);
    }

    // ===== PERMISSIONLESS DEPLOY TO AAVE =====
    function deployToAave() external {
        require(state == State.COLLECTING, "Already deployed");
        require(totalAssetsCollecting() >= cap, "Cap not reached");

        uint256 arcUsdcBalance = arcUsdc.balanceOf(address(this));
        
        // Step 1: Withdraw USDC from arcUSDC (unwrap)
        IArcUSDC(address(arcUsdc)).withdraw(arcUsdcBalance);
        
        uint256 usdcBalance = underlyingUsdc.balanceOf(address(this));
        principalDeposited = usdcBalance;
        
        // Step 2: Approve and supply to Aave
        underlyingUsdc.approve(address(aavePool), usdcBalance);
        aavePool.supply(address(underlyingUsdc), usdcBalance, address(this), 0);

        // Record deployment timestamp for yield calculation
        deployedTimestamp = block.timestamp;
        
        state = State.DEPLOYED;
        emit DeployedToAave(usdcBalance, deployedTimestamp);
    }

    // ===== OPEN WITHDRAW WINDOW =====
    function openWithdrawWindow(uint256 duration) external {
        require(msg.sender == owner, "Not owner");
        require(state == State.DEPLOYED, "Not deployed");
        require(duration > 0, "Invalid duration");

        withdrawWindowEnd = block.timestamp + duration;
        state = State.WITHDRAW_WINDOW;

        emit WithdrawWindowOpened(withdrawWindowEnd);
    }

    // ===== WITHDRAW WITH TREASURY-SUBSIDIZED DEMO YIELD =====
    function withdraw(uint256 shareAmount) external {
        require(state == State.WITHDRAW_WINDOW, "Withdraw closed");
        require(block.timestamp <= withdrawWindowEnd, "Window expired");
        require(shareAmount > 0, "Zero shares");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");

        // Calculate user's share of aToken balance (actual Aave yield, ~0 on testnet)
        uint256 totalATokens = aToken.balanceOf(address(this));
        uint256 userATokenShare = (shareAmount * totalATokens) / totalShares;
        
        // Calculate user's principal being withdrawn
        uint256 userShareRatio = (shareAmount * 1e18) / shares[msg.sender];
        uint256 userPrincipalWithdrawn = (userPrincipal[msg.sender] * userShareRatio) / 1e18;
        
        // Calculate expected demo yield using accelerated time
        uint256 expectedDemoYield = calculateDemoYield(userPrincipalWithdrawn);
        
        // Calculate actual yield from Aave (usually ~0 on testnet)
        uint256 actualYield = userATokenShare > userPrincipalWithdrawn 
            ? userATokenShare - userPrincipalWithdrawn 
            : 0;
        
        // Calculate subsidy needed (expected - actual, never negative)
        uint256 subsidyNeeded = expectedDemoYield > actualYield 
            ? expectedDemoYield - actualYield 
            : 0;
        
        // Apply optional subsidy cap
        if (maxSubsidyPerWithdraw > 0 && subsidyNeeded > maxSubsidyPerWithdraw) {
            subsidyNeeded = maxSubsidyPerWithdraw;
        }
        
        // Update state before external calls
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        userPrincipal[msg.sender] -= userPrincipalWithdrawn;

        // Withdraw from Aave
        aavePool.withdraw(address(underlyingUsdc), userATokenShare, address(this));
        
        // Transfer subsidy from treasury if needed
        if (subsidyNeeded > 0) {
            // Treasury must have approved this contract to spend USDC
            bool subsidySuccess = underlyingUsdc.transferFrom(TREASURY, address(this), subsidyNeeded);
            require(subsidySuccess, "Treasury subsidy failed - ensure treasury has approved this contract");
        }
        
        // Total payout = actual Aave withdrawal + subsidy
        uint256 totalPayout = userATokenShare + subsidyNeeded;
        
        // Wrap back to arcUSDC
        underlyingUsdc.approve(address(arcUsdc), totalPayout);
        IArcUSDC(address(arcUsdc)).deposit(totalPayout);
        
        // Transfer arcUSDC to user
        uint256 arcUsdcBalance = arcUsdc.balanceOf(address(this));
        bool success = arcUsdc.transfer(msg.sender, arcUsdcBalance);
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, arcUsdcBalance, shareAmount, subsidyNeeded);
    }

    // ===== WITHDRAW ALL (convenience function) =====
    function withdrawAll() external {
        uint256 userShares = shares[msg.sender];
        require(userShares > 0, "No shares");
        
        // Call withdraw with all user shares
        this.withdraw(userShares);
    }

    // ===== DEMO YIELD CALCULATION =====
    /**
     * @notice Calculate expected demo yield based on time elapsed
     * @dev Fixed 0.03 USDC per minute after deployment
     * @param principal The principal amount (not used in flat yield, kept for interface compatibility)
     * @return yield The expected demo yield in USDC (6 decimals)
     */
    function calculateDemoYield(uint256 principal) public view returns (uint256) {
        if (deployedTimestamp == 0) return 0;
        
        // Time elapsed since deployment (in seconds)
        uint256 timeElapsed = block.timestamp - deployedTimestamp;
        
        // Calculate minutes elapsed (integer division)
        uint256 minutesElapsed = timeElapsed / 60;
        
        // Yield = 0.03 USDC per minute
        // 0.03 USDC = 30000 (6 decimals)
        uint256 yield = minutesElapsed * YIELD_PER_MINUTE;
        
        // Suppress unused variable warning
        principal;
        
        return yield;
    }
    
    /**
     * @notice Get minutes elapsed since deployment
     * @return Minutes elapsed (for UI display)
     */
    function getMinutesElapsed() public view returns (uint256) {
        if (deployedTimestamp == 0) return 0;
        return (block.timestamp - deployedTimestamp) / 60;
    }
    
    /**
     * @notice Preview the demo yield for a user (before withdraw)
     * @param user The user address
     * @return expectedYield The expected demo yield
     * @return actualYield The actual Aave yield (usually ~0 on testnet)
     * @return subsidy The subsidy that would be paid from treasury
     */
    function previewDemoYield(address user) external view returns (
        uint256 expectedYield,
        uint256 actualYield,
        uint256 subsidy
    ) {
        if (shares[user] == 0 || totalShares == 0) return (0, 0, 0);
        
        uint256 totalATokens = aToken.balanceOf(address(this));
        uint256 userATokenShare = (shares[user] * totalATokens) / totalShares;
        uint256 userPrincipalAmount = userPrincipal[user];
        
        expectedYield = calculateDemoYield(userPrincipalAmount);
        actualYield = userATokenShare > userPrincipalAmount 
            ? userATokenShare - userPrincipalAmount 
            : 0;
        subsidy = expectedYield > actualYield 
            ? expectedYield - actualYield 
            : 0;
            
        // Apply cap if set
        if (maxSubsidyPerWithdraw > 0 && subsidy > maxSubsidyPerWithdraw) {
            subsidy = maxSubsidyPerWithdraw;
        }
    }

    // ===== VIEW FUNCTIONS =====
    
    function totalAssetsCollecting() public view returns (uint256) {
        return arcUsdc.balanceOf(address(this));
    }
    
    function totalAssetsDeployed() public view returns (uint256) {
        return aToken.balanceOf(address(this));
    }
    
    function totalAssets() public view returns (uint256) {
        if (state == State.COLLECTING) {
            return totalAssetsCollecting();
        } else {
            return totalAssetsDeployed();
        }
    }
    
    function yieldEarned() external view returns (uint256) {
        if (state == State.COLLECTING) return 0;
        uint256 current = totalAssetsDeployed();
        if (current <= principalDeposited) return 0;
        return current - principalDeposited;
    }
    
    /**
     * @notice Preview user's withdrawable amount including demo yield subsidy
     * @param user The user address
     * @return Total amount user would receive (principal + demo yield)
     */
    function previewWithdraw(address user) external view returns (uint256) {
        if (totalShares == 0) return 0;
        
        uint256 totalATokens = aToken.balanceOf(address(this));
        uint256 userATokenShare = (shares[user] * totalATokens) / totalShares;
        uint256 userPrincipalAmount = userPrincipal[user];
        
        uint256 expectedYield = calculateDemoYield(userPrincipalAmount);
        uint256 actualYield = userATokenShare > userPrincipalAmount 
            ? userATokenShare - userPrincipalAmount 
            : 0;
        uint256 subsidy = expectedYield > actualYield 
            ? expectedYield - actualYield 
            : 0;
            
        // Apply cap if set
        if (maxSubsidyPerWithdraw > 0 && subsidy > maxSubsidyPerWithdraw) {
            subsidy = maxSubsidyPerWithdraw;
        }
        
        return userATokenShare + subsidy;
    }
    
    function isCapReached() external view returns (bool) {
        return totalAssetsCollecting() >= cap;
    }
    
    function canWithdraw(address user) external view returns (bool) {
        return state == State.WITHDRAW_WINDOW 
            && block.timestamp <= withdrawWindowEnd 
            && shares[user] > 0;
    }
    
    /**
     * @notice Get seconds elapsed since deployment
     * @return Seconds elapsed since deployment
     */
    function getSecondsElapsed() external view returns (uint256) {
        if (deployedTimestamp == 0) return 0;
        return block.timestamp - deployedTimestamp;
    }
    
    /**
     * @notice Get the yield per minute in USDC (6 decimals)
     * @return 30000 (0.03 USDC)
     */
    function getYieldPerMinute() external pure returns (uint256) {
        return YIELD_PER_MINUTE;
    }

    // ===== OWNER FUNCTIONS =====
    
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "Not owner");
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    /**
     * @notice Set maximum subsidy per withdrawal (optional cap)
     * @param _maxSubsidy Max subsidy in USDC (6 decimals), 0 to disable
     */
    function setMaxSubsidyPerWithdraw(uint256 _maxSubsidy) external {
        require(msg.sender == owner, "Not owner");
        maxSubsidyPerWithdraw = _maxSubsidy;
        emit SubsidyCapUpdated(_maxSubsidy);
    }
}
