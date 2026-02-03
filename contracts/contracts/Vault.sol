// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IAgentRegistry.sol";
import "./interfaces/IStrategy.sol";

contract Vault is IVault, ERC4626, Ownable {
    using SafeERC20 for IERC20;

    IAgentRegistry public immutable registry;

    // Strategy Whitelist
    mapping(address => bool) public isStrategyWhitelisted;
    
    // Track assets allocated to strategies
    mapping(address => uint256) public strategyAssets;

    constructor(
        IERC20 _asset, 
        string memory _name, 
        string memory _symbol,
        address _registry
    ) ERC4626(_asset) ERC20(_name, _symbol) Ownable(msg.sender) {
        registry = IAgentRegistry(_registry);
    }

    /// @inheritdoc IVault
    function allocate(address strategy, uint256 amount) external override {
        if (!isStrategyWhitelisted[strategy]) revert InvalidStrategy();
        
         // Permission Check: allocate signature
        if (!registry.isAuthorized(msg.sender, address(this), this.allocate.selector)) {
            revert UnauthorizedAgent();
        }

        // Move funds to Strategy
        SafeERC20.safeTransfer(IERC20(asset()), strategy, amount);
        
        // Update accounting
        strategyAssets[strategy] += amount;
        _updateGlobalAllocation(int256(amount));
        
        // Notify strategy (if applicable pattern, usually strategies pull, but here we push then notify)
        IStrategy(strategy).deposit(amount);

        emit Allocated(strategy, amount);
    }

    /// @inheritdoc IVault
    function deallocate(address strategy, uint256 amount) external override {
        if (!isStrategyWhitelisted[strategy]) revert InvalidStrategy();

        // Permission Check: deallocate signature
        // Note: Owner can also call this? For now restricted to Agents/Owner via specific check or separate function.
        // Let's stick to AgentRegistry for consistency.
        if (!registry.isAuthorized(msg.sender, address(this), this.deallocate.selector)) {
             revert UnauthorizedAgent();
        }

        // Pull funds from Strategy
        IStrategy(strategy).withdraw(amount);
        
        // Update accounting
        strategyAssets[strategy] -= amount;
        _updateGlobalAllocation(-int256(amount));

        emit Deallocated(strategy, amount);
    }

    /// @inheritdoc IVault
    function callStrategy(address strategy, bytes calldata data) external override {
        if (!isStrategyWhitelisted[strategy]) revert InvalidStrategy();

        // Decode selector to check permission
        bytes4 selector = bytes4(data[:4]);

        // Permission Check: Agent must be authorized to call THIS selector on THAT strategy
        if (!registry.isAuthorized(msg.sender, strategy, selector)) {
            revert UnauthorizedAgent();
        }

        // Execute call
        (bool success, ) = strategy.call(data);
        if (!success) revert StrategyCallFailed();

        emit StrategyCalled(strategy, selector);
    }

    /// @inheritdoc IVault
    function getStrategyAssets(address strategy) external view override returns (uint256) {
        return strategyAssets[strategy];
    }

    /// @notice Override totalAssets to include strategy holdings
    function totalAssets() public view override(ERC4626, IERC4626) returns (uint256) {
        // Base implementation includes simple balance of this contract
        // We need to add tracked strategy assets
        // Note: This assumes 1:1 value mapping (stablecoin vault). 
        // Real implementations might need async valuation.
        
        uint256 held = super.totalAssets(); // Cash in vault
        // Iterate or sum? Since we don't have an iterable list, we rely on tracked total?
        // For simple MVP we track totalAllocated manually if needed, or just iterate off-chain.
        // Actually for ERC4626 correctness, we need the SUM of all strategies.
        // A simple "totalAllocated" var is cheaper than iteration.
        return held + _totalAllocated(); 
    }

    uint256 private _totalAllocatedAmount;

    function _totalAllocated() internal view returns (uint256) {
        return _totalAllocatedAmount;
    }

    // Update allocate/deallocate to track global total
    function _updateGlobalAllocation(int256 delta) internal {
        if (delta > 0) {
            _totalAllocatedAmount += uint256(delta);
        } else {
            _totalAllocatedAmount -= uint256(-delta);
        }
    }

    // ===== ADMIN =====
    function setStrategyWhitelist(address strategy, bool allowed) external onlyOwner {
        isStrategyWhitelisted[strategy] = allowed;
    }
}
