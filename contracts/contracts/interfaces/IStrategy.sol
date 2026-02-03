// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IStrategy {
    /// @notice Returns the underlying asset provided to the strategy
    function asset() external view returns (address);

    /// @notice Returns the total value managed by this strategy in terms of `asset`
    function totalAssets() external view returns (uint256);

    /// @notice Deposit assets into the underlying protocol
    /// @dev Only callable by the Vault
    /// @param amount The amount of asset to deposit
    function deposit(uint256 amount) external;

    /// @notice Withdraw assets from the underlying protocol
    /// @dev Only callable by the Vault
    /// @param amount The amount of asset to withdraw
    function withdraw(uint256 amount) external;

    /// @notice Emergency exit: attempt to withdraw all funds regardless of losses
    function emergencyExit() external;
}
