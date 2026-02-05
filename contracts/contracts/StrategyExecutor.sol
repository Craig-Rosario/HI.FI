// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./RiskPolicyRegistry.sol";

/**
 * @title StrategyExecutor - THE ONCHAIN AGENT
 * @notice Deterministic strategy executor that acts on behalf of pool vaults
 * @dev This is the "agent" in the Uniswap v4 Agentic Finance track:
 *      - Makes autonomous decisions based on risk policy
 *      - Executes complex multi-step actions (LP add/remove)
 *      - No relayer, no backend, fully onchain
 * 
 * THE AGENT FLOW:
 * 1. User sets risk policy ONCE via RiskPolicyRegistry
 * 2. Pool vault calls execute() when cap is reached
 * 3. StrategyExecutor reads policy, decides allocation
 * 4. Deploys funds to Uniswap v4 within policy bounds
 * 5. Pool vault calls unwind() before withdraw window
 * 6. StrategyExecutor returns all funds to vault
 */
contract StrategyExecutor is Ownable {
    // ===== STATE =====
    
    RiskPolicyRegistry public immutable registry;
    address public v4Adapter;  // V4LiquidityAdapter address
    
    // Track deployed amounts per vault
    mapping(address => uint256) public vaultDeployments;
    
    // Authorized vaults that can call execute/unwind
    mapping(address => bool) public authorizedVaults;

    // ===== EVENTS =====
    
    event StrategyExecuted(
        address indexed vault,
        uint256 totalAssets,
        uint256 deployedToV4,
        uint256 keptInVault,
        RiskPolicyRegistry.RiskLevel riskLevel
    );
    
    event PositionUnwound(
        address indexed vault,
        uint256 returnedAssets
    );
    
    event VaultAuthorized(address indexed vault, bool authorized);
    event V4AdapterSet(address indexed adapter);

    // ===== ERRORS =====
    
    error UnauthorizedVault();
    error InvalidAdapter();
    error PolicyNotSet();
    error TransferFailed();

    // ===== MODIFIERS =====
    
    modifier onlyAuthorizedVault() {
        if (!authorizedVaults[msg.sender]) revert UnauthorizedVault();
        _;
    }

    // ===== CONSTRUCTOR =====
    
    constructor(address _registry) Ownable(msg.sender) {
        registry = RiskPolicyRegistry(_registry);
    }

    // ===== ADMIN FUNCTIONS =====

    /**
     * @notice Set the V4LiquidityAdapter address
     * @param _adapter The adapter contract address
     */
    function setV4Adapter(address _adapter) external onlyOwner {
        if (_adapter == address(0)) revert InvalidAdapter();
        v4Adapter = _adapter;
        emit V4AdapterSet(_adapter);
    }

    /**
     * @notice Authorize a vault to use this executor
     * @param vault The vault address
     * @param authorized Whether to authorize or revoke
     */
    function setVaultAuthorization(address vault, bool authorized) external onlyOwner {
        authorizedVaults[vault] = authorized;
        emit VaultAuthorized(vault, authorized);
    }

    // ===== CORE AGENT FUNCTIONS =====

    /**
     * @notice Execute strategy for a vault - THE AUTONOMOUS DECISION
     * @dev Called by PoolVault after cap is reached
     *      This is where the "agent" makes its decision:
     *      - Reads risk policy
     *      - Calculates optimal allocation
     *      - Deploys to v4 within bounds
     * 
     * @param token The asset token (USDC)
     * @param totalAssets Total assets to manage
     * @return deployedToV4 Amount deployed to Uniswap v4
     */
    function execute(
        address token,
        uint256 totalAssets
    ) external onlyAuthorizedVault returns (uint256 deployedToV4) {
        address vault = msg.sender;
        
        // Read policy from registry
        RiskPolicyRegistry.RiskPolicy memory policy = registry.getPoolRiskPolicy(vault);
        
        // Policy must be set
        if (policy.setAt == 0) revert PolicyNotSet();
        
        // AGENT DECISION: Calculate v4 allocation based on risk level
        if (policy.maxV4AllocationBps == 0) {
            // LOW risk: no Uniswap v4 exposure
            // All funds stay in vault
            emit StrategyExecuted(vault, totalAssets, 0, totalAssets, policy.level);
            return 0;
        }
        
        // Calculate maximum amount for v4
        uint256 maxV4Amount = (totalAssets * policy.maxV4AllocationBps) / 10000;
        
        // For now, deploy the maximum allowed
        // Future: could add more sophisticated allocation logic
        deployedToV4 = maxV4Amount;
        
        // Transfer tokens from vault to this contract
        bool success = IERC20(token).transferFrom(vault, address(this), deployedToV4);
        if (!success) revert TransferFailed();
        
        // Deploy to v4 via adapter
        if (v4Adapter != address(0)) {
            // Approve adapter
            IERC20(token).approve(v4Adapter, deployedToV4);
            
            // Call adapter to add liquidity
            // IV4LiquidityAdapter(v4Adapter).addLiquidity(vault, token, deployedToV4);
            // Note: Actual v4 integration in V4LiquidityAdapter
        }
        
        // Track deployment
        vaultDeployments[vault] = deployedToV4;
        
        uint256 keptInVault = totalAssets - deployedToV4;
        emit StrategyExecuted(vault, totalAssets, deployedToV4, keptInVault, policy.level);
        
        return deployedToV4;
    }

    /**
     * @notice Unwind v4 positions and return funds to vault
     * @dev Called by PoolVault before opening withdraw window
     * 
     * @param token The asset token
     * @return returnedAssets Amount returned to vault
     */
    function unwind(address token) external onlyAuthorizedVault returns (uint256 returnedAssets) {
        address vault = msg.sender;
        
        uint256 deployed = vaultDeployments[vault];
        
        if (deployed == 0) {
            // Nothing to unwind
            return 0;
        }
        
        // Remove liquidity from v4 via adapter
        if (v4Adapter != address(0)) {
            // returnedAssets = IV4LiquidityAdapter(v4Adapter).removeLiquidity(vault, token);
            // Note: Actual v4 integration in V4LiquidityAdapter
        }
        
        // For now, return what we have
        returnedAssets = IERC20(token).balanceOf(address(this));
        
        // Transfer back to vault
        if (returnedAssets > 0) {
            bool success = IERC20(token).transfer(vault, returnedAssets);
            if (!success) revert TransferFailed();
        }
        
        // Clear tracking
        vaultDeployments[vault] = 0;
        
        emit PositionUnwound(vault, returnedAssets);
        return returnedAssets;
    }

    // ===== VIEW FUNCTIONS =====

    /**
     * @notice Get current v4 deployment for a vault
     * @param vault The vault address
     * @return amount Amount currently deployed to v4
     */
    function getVaultDeployment(address vault) external view returns (uint256 amount) {
        return vaultDeployments[vault];
    }

    /**
     * @notice Preview what the execute function would deploy
     * @param vault The vault address  
     * @param totalAssets Total assets to consider
     * @return v4Amount Amount that would go to v4
     * @return vaultAmount Amount that would stay in vault
     */
    function previewExecution(
        address vault,
        uint256 totalAssets
    ) external view returns (uint256 v4Amount, uint256 vaultAmount) {
        RiskPolicyRegistry.RiskPolicy memory policy = registry.getPoolRiskPolicy(vault);
        
        if (policy.setAt == 0 || policy.maxV4AllocationBps == 0) {
            return (0, totalAssets);
        }
        
        v4Amount = (totalAssets * policy.maxV4AllocationBps) / 10000;
        vaultAmount = totalAssets - v4Amount;
    }

    /**
     * @notice Check if vault has an active v4 position
     * @param vault The vault address
     * @return hasPosition Whether vault has v4 exposure
     */
    function hasActivePosition(address vault) external view returns (bool hasPosition) {
        return vaultDeployments[vault] > 0;
    }
}
