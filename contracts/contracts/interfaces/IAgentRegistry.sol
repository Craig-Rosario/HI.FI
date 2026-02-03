// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAgentRegistry {
    /// @notice Checks if an address is an active, recognized Agent
    function isAgent(address account) external view returns (bool);

    /// @notice Checks if an agent is authorized to call a specific function on a target
    /// @param agent The agent address
    /// @param target The contract being called (e.g. Vault)
    /// @param functionSelector The function signature (e.g. allocate.selector)
    function isAuthorized(
        address agent, 
        address target, 
        bytes4 functionSelector
    ) external view returns (bool);
}
