// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IVault is IERC4626 {
    error UnauthorizedAgent();
    error InvalidStrategy();
    error StrategyCallFailed();

    event Allocated(address indexed strategy, uint256 amount);
    event Deallocated(address indexed strategy, uint256 amount);
    event StrategyCalled(address indexed strategy, bytes4 selector);

    /// @notice Moves funds from the Vault to a Strategy
    /// @dev RESTRICTED: Only callable by allowed Arc Agents
    function allocate(address strategy, uint256 amount) external;

    /// @notice Pulls funds from a Strategy back to the Vault
    /// @dev RESTRICTED: Only callable by allowed Arc Agents or Emergency Admin
    function deallocate(address strategy, uint256 amount) external;

    /// @notice Triggers a function on a strategy (e.g., rebalance, harvest)
    /// @dev RESTRICTED: Only callable by allowed Arc Agents. 
    ///      The AgentRegistry must validate (Agent + Strategy + Selector).
    /// @param strategy The target strategy address
    /// @param data The calldata to send to the strategy
    function callStrategy(address strategy, bytes calldata data) external;

    /// @notice Returns the total assets held in a specific strategy
    function getStrategyAssets(address strategy) external view returns (uint256);
}
