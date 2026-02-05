// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
<<<<<<< Updated upstream
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StrategyExecutor.sol";

/**
 * @title PoolVaultV3 - Enhanced HI.FI Pool with Agentic Execution
 * @notice Pool vault integrated with StrategyExecutor for Uniswap v4 exposure
 * @dev Extends the existing HI.FI vault pattern with:
 *      - Automatic strategy execution when cap is reached
 *      - Integration with RiskPolicyRegistry
 *      - v4 position unwinding before withdrawals
 * 
 * FLOW:
 * 1. Users deposit arcUSDC → shares minted
 * 2. Cap reached → owner/anyone calls deployToStrategy()
 * 3. StrategyExecutor reads policy → deploys to v4 within bounds
 * 4. Owner calls prepareWithdraw() → unwinds v4 positions
 * 5. Owner calls openWithdrawWindow() → users can withdraw
 */
contract PoolVaultV3 is Ownable {
    // ===== ENUMS =====
    enum State {
        COLLECTING,      // Accepting deposits
        DEPLOYED,        // Funds deployed to strategy
        WITHDRAW_WINDOW  // Users can withdraw
    }

    // ===== STATE =====
    
    IERC20 public immutable usdc;        // arcUSDC token
    StrategyExecutor public executor;     // The agent
    
    uint256 public cap;                   // Target pool size
    uint256 public totalShares;          // Total shares minted
    State public state;                  // Current pool state
    
    uint256 public deployedToV4;         // Amount currently in v4
    uint256 public deployedAt;           // Deployment timestamp
    
    uint256 public withdrawWindowEnd;     // Withdraw window deadline
    uint256 public constant WITHDRAW_DELAY = 60;        // 1 min after deployment
    uint256 public constant WITHDRAW_DURATION = 3600;   // 1 hour window

    mapping(address => uint256) public shares;

    // ===== EVENTS =====
    
    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted);
    event PoolDeployed(uint256 totalAssets, uint256 deployedToV4, uint256 keptInVault);
    event PositionsUnwound(uint256 returnedFromV4);
    event WithdrawWindowOpened(uint256 windowEnd);
    event Withdrawn(address indexed user, uint256 amount, uint256 sharesBurned);
    event ExecutorSet(address indexed executor);

    // ===== ERRORS =====
    
    error InvalidState();
    error ZeroAmount();
    error CapNotReached();
    error CapExceeded();
    error InsufficientShares();
    error WindowClosed();
    error TooEarlyForWithdraw();
    error TransferFailed();

    // ===== CONSTRUCTOR =====
    
    constructor(
        address _usdc,
        uint256 _cap,
        address _executor
    ) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        cap = _cap;
        state = State.COLLECTING;
        
        if (_executor != address(0)) {
            executor = StrategyExecutor(_executor);
            emit ExecutorSet(_executor);
        }
    }

    // ===== ADMIN =====

    /**
     * @notice Set the StrategyExecutor address
     * @param _executor The executor contract
     */
    function setExecutor(address _executor) external onlyOwner {
        executor = StrategyExecutor(_executor);
        emit ExecutorSet(_executor);
    }

    // ===== DEPOSIT =====

    /**
     * @notice Deposit arcUSDC and receive shares
     * @param amount Amount of arcUSDC to deposit
     */
    function deposit(uint256 amount) external {
        if (state != State.COLLECTING) revert InvalidState();
        if (amount == 0) revert ZeroAmount();

        uint256 assetsBefore = _vaultAssets();

        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        uint256 mintedShares = totalShares == 0
            ? amount
            : (amount * totalShares) / assetsBefore;

        shares[msg.sender] += mintedShares;
        totalShares += mintedShares;

        if (_vaultAssets() > cap) revert CapExceeded();

        emit Deposited(msg.sender, amount, mintedShares);
        
        // Auto-deploy when cap is exactly reached
        if (_vaultAssets() == cap && address(executor) != address(0)) {
            _deployToStrategy();
        }
    }

    // ===== STRATEGY DEPLOYMENT =====

    /**
     * @notice Deploy funds to strategy (anyone can call when cap reached)
     * @dev This triggers the AGENT (StrategyExecutor) to act
     */
    function deployToStrategy() external {
        if (state != State.COLLECTING) revert InvalidState();
        if (_vaultAssets() < cap) revert CapNotReached();
        
        _deployToStrategy();
    }

    function _deployToStrategy() internal {
        uint256 vaultBalance = _vaultAssets();
        
        // If executor is set, let the AGENT decide allocation
        if (address(executor) != address(0)) {
            // Approve executor to pull funds
            usdc.approve(address(executor), vaultBalance);
            
            // AGENT DECISION: executor reads policy and deploys accordingly
            deployedToV4 = executor.execute(address(usdc), vaultBalance);
        }
        
        deployedAt = block.timestamp;
        state = State.DEPLOYED;
        
        uint256 keptInVault = _vaultAssets();
        emit PoolDeployed(vaultBalance, deployedToV4, keptInVault);
    }

    // ===== WITHDRAW PREPARATION =====

    /**
     * @notice Unwind v4 positions before opening withdraw window
     * @dev This instructs the AGENT to return all funds to vault
     */
    function prepareWithdraw() external onlyOwner {
        if (state != State.DEPLOYED) revert InvalidState();
        
        // Unwind v4 positions via executor
        if (deployedToV4 > 0 && address(executor) != address(0)) {
            uint256 returned = executor.unwind(address(usdc));
            emit PositionsUnwound(returned);
        }
        
        deployedToV4 = 0;
    }

    /**
     * @notice Open the withdraw window (after WITHDRAW_DELAY)
     * @param duration Window duration in seconds
     */
    function openWithdrawWindow(uint256 duration) external onlyOwner {
        if (state != State.DEPLOYED) revert InvalidState();
        if (block.timestamp < deployedAt + WITHDRAW_DELAY) revert TooEarlyForWithdraw();
        if (deployedToV4 > 0) revert InvalidState(); // Must unwind first
        
        uint256 windowDuration = duration > 0 ? duration : WITHDRAW_DURATION;
        withdrawWindowEnd = block.timestamp + windowDuration;
        state = State.WITHDRAW_WINDOW;

        emit WithdrawWindowOpened(withdrawWindowEnd);
    }

    /**
     * @notice Check if withdraw window is currently open
     */
    function isWithdrawOpen() public view returns (bool) {
        return state == State.WITHDRAW_WINDOW && block.timestamp <= withdrawWindowEnd;
    }

    // ===== WITHDRAW =====

    /**
     * @notice Withdraw assets by burning shares
     * @param shareAmount Number of shares to burn
     */
    function withdraw(uint256 shareAmount) external {
        if (!isWithdrawOpen()) revert WindowClosed();
        if (shareAmount == 0) revert ZeroAmount();
        if (shares[msg.sender] < shareAmount) revert InsufficientShares();

        uint256 assets = (shareAmount * totalAssets()) / totalShares;

        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        bool success = usdc.transfer(msg.sender, assets);
        if (!success) revert TransferFailed();

        emit Withdrawn(msg.sender, assets, shareAmount);
        
        // Reset pool when all shares withdrawn
        if (totalShares == 0) {
            state = State.COLLECTING;
            deployedAt = 0;
        }
    }

    /**
     * @notice Withdraw all shares
     */
    function withdrawAll() external {
        uint256 userShares = shares[msg.sender];
        if (userShares == 0) revert InsufficientShares();
        
        // Inline to avoid external call
        if (!isWithdrawOpen()) revert WindowClosed();

        uint256 assets = (userShares * totalAssets()) / totalShares;

        shares[msg.sender] = 0;
        totalShares -= userShares;

        bool success = usdc.transfer(msg.sender, assets);
        if (!success) revert TransferFailed();

        emit Withdrawn(msg.sender, assets, userShares);
        
        if (totalShares == 0) {
            state = State.COLLECTING;
            deployedAt = 0;
        }
    }

    // ===== VIEW FUNCTIONS =====

    /**
     * @notice Vault's arcUSDC balance (excludes v4 positions)
     */
    function _vaultAssets() internal view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Total assets including v4 positions
     */
    function totalAssets() public view returns (uint256) {
        // In COLLECTING state, just vault balance
        if (state == State.COLLECTING) {
            return _vaultAssets();
        }
        
        // In DEPLOYED state, include v4 position value
        // Note: deployedToV4 is updated when unwound
        return _vaultAssets() + deployedToV4;
    }

    /**
     * @notice Preview user's withdrawable amount
     */
    function previewWithdraw(address user) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[user] * totalAssets()) / totalShares;
    }

    /**
     * @notice Time until withdraw window opens
     */
    function timeUntilWithdraw() external view returns (uint256) {
        if (state != State.DEPLOYED) return 0;
        uint256 windowStart = deployedAt + WITHDRAW_DELAY;
        if (block.timestamp >= windowStart) return 0;
        return windowStart - block.timestamp;
    }

    /**
     * @notice Check if cap is reached
     */
    function isCapReached() external view returns (bool) {
        return _vaultAssets() >= cap;
=======
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./StrategyExecutor.sol";

/**
 * @title PoolVaultV3
 * @notice Vault with integrated StrategyExecutor for agentic yield management
 */
contract PoolVaultV3 {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable asset;
    StrategyExecutor public immutable executor;
    
    uint256 public cap;
    uint256 public totalDeposits;
    uint256 public totalShares;
    
    mapping(address => uint256) public shares;
    
    enum State { COLLECTING, DEPLOYED, WITHDRAW_OPEN }
    State public state;
    
    uint256 public deployedAt;
    uint256 public constant WITHDRAW_DELAY = 60; // 1 min for demo
    
    address public owner;
    
    event Deposit(address indexed user, uint256 amount, uint256 sharesMinted);
    event Withdraw(address indexed user, uint256 amount, uint256 sharesBurned);
    event StrategyExecuted(uint256 v4Allocation);
    event WithdrawWindowOpened();
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(address _asset, uint256 _cap, address _executor) {
        asset = IERC20(_asset);
        cap = _cap;
        executor = StrategyExecutor(_executor);
        owner = msg.sender;
        state = State.COLLECTING;
    }
    
    function deposit(uint256 amount) external {
        require(state == State.COLLECTING, "Not collecting");
        require(totalDeposits + amount <= cap, "Cap exceeded");
        
        asset.safeTransferFrom(msg.sender, address(this), amount);
        
        uint256 sharesToMint = amount; // 1:1 for simplicity
        shares[msg.sender] += sharesToMint;
        totalShares += sharesToMint;
        totalDeposits += amount;
        
        emit Deposit(msg.sender, amount, sharesToMint);
        
        // Auto-deploy when cap reached
        if (totalDeposits >= cap) {
            _deploy();
        }
    }
    
    function _deploy() internal {
        state = State.DEPLOYED;
        deployedAt = block.timestamp;
        
        // Execute strategy via agent
        uint256 balance = asset.balanceOf(address(this));
        
        // Approve executor if needed (in real impl, would transfer to v4)
        // For demo, we just track the allocation
        uint256 v4Allocation = executor.execute(balance);
        
        emit StrategyExecuted(v4Allocation);
    }
    
    function openWithdrawWindow() external {
        require(state == State.DEPLOYED, "Not deployed");
        require(block.timestamp >= deployedAt + WITHDRAW_DELAY, "Too early");
        
        // Unwind v4 positions
        executor.unwind();
        
        state = State.WITHDRAW_OPEN;
        emit WithdrawWindowOpened();
    }
    
    function withdraw() external {
        require(state == State.WITHDRAW_OPEN, "Withdrawals not open");
        
        uint256 userShares = shares[msg.sender];
        require(userShares > 0, "No shares");
        
        uint256 balance = asset.balanceOf(address(this));
        uint256 amount = (userShares * balance) / totalShares;
        
        shares[msg.sender] = 0;
        totalShares -= userShares;
        
        asset.safeTransfer(msg.sender, amount);
        
        emit Withdraw(msg.sender, amount, userShares);
    }
    
    // View functions
    function getState() external view returns (State) {
        return state;
    }
    
    function getUserShares(address user) external view returns (uint256) {
        return shares[user];
    }
    
    function withdrawOpen() external view returns (bool) {
        return state == State.WITHDRAW_OPEN;
    }
    
    function withdrawTimeLeft() external view returns (uint256) {
        if (state != State.DEPLOYED) return 0;
        uint256 openTime = deployedAt + WITHDRAW_DELAY;
        if (block.timestamp >= openTime) return 0;
        return openTime - block.timestamp;
>>>>>>> Stashed changes
    }
}
