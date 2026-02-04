// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PoolVaultWithAave - HI.FI Investment Pool with Aave Integration
 * @notice Vault that deploys funds to Aave when cap is reached
 * @dev Deploy on Base Sepolia with:
 *      _arcUsdc: Your ArcUSDC address
 *      _aavePool: 0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b (Aave V3 Pool on Base Sepolia)
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

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}

contract PoolVaultWithAave {
    enum State {
        COLLECTING,
        DEPLOYED,
        WITHDRAW_WINDOW
    }

    IERC20 public immutable arcUsdc;
    IAavePool public immutable aavePool;
    IERC20 public immutable underlyingUsdc; // The USDC that arcUSDC wraps
    IAToken public aToken; // aUSDC token (set after first deposit to Aave)
    
    address public owner;
    uint256 public cap;
    uint256 public totalShares;
    State public state;
    uint256 public withdrawWindowEnd;
    
    // Track principal deposited to Aave for yield calculation
    uint256 public principalDeposited;

    mapping(address => uint256) public shares;

    // ===== EVENTS =====
    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted);
    event DeployedToAave(uint256 totalAssets);
    event WithdrawWindowOpened(uint256 windowEnd);
    event Withdrawn(address indexed user, uint256 amount, uint256 sharesBurned);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ===== CONSTRUCTOR =====
    // Deploy with:
    // _arcUsdc: Your ArcUSDC contract
    // _underlyingUsdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia USDC)
    // _aavePool: 0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b (Aave V3 Pool Base Sepolia)
    // _aToken: 0x... (aUSDC on Base Sepolia - check Aave docs)
    // _cap: 10000000 (10 USDC for testing)
    
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

        require(totalAssetsCollecting() <= cap, "Cap exceeded");

        emit Deposited(msg.sender, amount, mintedShares);
    }

    // ===== PERMISSIONLESS DEPLOY TO AAVE =====
    // Anyone can call this once cap is reached
    function deployToAave() external {
        require(state == State.COLLECTING, "Already deployed");
        require(totalAssetsCollecting() >= cap, "Cap not reached");

        uint256 arcUsdcBalance = arcUsdc.balanceOf(address(this));
        
        // Step 1: Withdraw USDC from arcUSDC (unwrap)
        // Assuming arcUSDC has a withdraw function
        IArcUSDC(address(arcUsdc)).withdraw(arcUsdcBalance);
        
        uint256 usdcBalance = underlyingUsdc.balanceOf(address(this));
        principalDeposited = usdcBalance;
        
        // Step 2: Approve and supply to Aave
        underlyingUsdc.approve(address(aavePool), usdcBalance);
        aavePool.supply(address(underlyingUsdc), usdcBalance, address(this), 0);

        state = State.DEPLOYED;
        emit DeployedToAave(usdcBalance);
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

    // ===== WITHDRAW =====
    function withdraw(uint256 shareAmount) external {
        require(state == State.WITHDRAW_WINDOW, "Withdraw closed");
        require(block.timestamp <= withdrawWindowEnd, "Window expired");
        require(shareAmount > 0, "Zero shares");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");

        // Calculate user's share of aToken balance (includes yield)
        uint256 totalATokens = aToken.balanceOf(address(this));
        uint256 userAssets = (shareAmount * totalATokens) / totalShares;

        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        // Withdraw from Aave
        aavePool.withdraw(address(underlyingUsdc), userAssets, address(this));
        
        // Wrap back to arcUSDC
        uint256 usdcBalance = underlyingUsdc.balanceOf(address(this));
        underlyingUsdc.approve(address(arcUsdc), usdcBalance);
        IArcUSDC(address(arcUsdc)).deposit(usdcBalance);
        
        // Transfer arcUSDC to user
        uint256 arcUsdcBalance = arcUsdc.balanceOf(address(this));
        bool success = arcUsdc.transfer(msg.sender, arcUsdcBalance);
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, arcUsdcBalance, shareAmount);
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
    
    // TVL while deployed (aToken balance = principal + yield)
    function totalAssetsDeployed() public view returns (uint256) {
        return aToken.balanceOf(address(this));
    }
    
    // Total assets (works in any state)
    function totalAssets() public view returns (uint256) {
        if (state == State.COLLECTING) {
            return totalAssetsCollecting();
        } else {
            return totalAssetsDeployed();
        }
    }
    
    // Yield earned (only when deployed)
    function yieldEarned() external view returns (uint256) {
        if (state == State.COLLECTING) return 0;
        uint256 current = totalAssetsDeployed();
        if (current <= principalDeposited) return 0;
        return current - principalDeposited;
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
        return state == State.WITHDRAW_WINDOW 
            && block.timestamp <= withdrawWindowEnd 
            && shares[user] > 0;
    }

    // ===== OWNER FUNCTIONS =====
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "Not owner");
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

// Interface for ArcUSDC wrap/unwrap
interface IArcUSDC {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
}
