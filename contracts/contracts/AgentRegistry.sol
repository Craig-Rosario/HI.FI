// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAgentRegistry.sol";

contract AgentRegistry is IAgentRegistry, Ownable {
    // Mapping: Agent => Is Whitelisted
    mapping(address => bool) private _isAgent;

    // Mapping: Agent => Target Contract => Function Selector => Is Authorized
    mapping(address => mapping(address => mapping(bytes4 => bool))) private _permissions;

    event AgentAdded(address indexed agent);
    event AgentRemoved(address indexed agent);
    event PermissionSet(address indexed agent, address indexed target, bytes4 indexed selector, bool allowed);

    constructor() Ownable(msg.sender) {}

    /// @inheritdoc IAgentRegistry
    function isAgent(address account) external view override returns (bool) {
        return _isAgent[account];
    }

    /// @inheritdoc IAgentRegistry
    function isAuthorized(
        address agent,
        address target,
        bytes4 functionSelector
    ) external view override returns (bool) {
        if (!_isAgent[agent]) return false;
        return _permissions[agent][target][functionSelector];
    }

    // ===== ADMIN FUNCTIONS =====

    /// @notice Adds a new agent to the whitelist
    function addAgent(address agent) external onlyOwner {
        require(agent != address(0), "Invalid address");
        require(!_isAgent[agent], "Already agent");
        _isAgent[agent] = true;
        emit AgentAdded(agent);
    }

    /// @notice Removes an agent from the whitelist
    function removeAgent(address agent) external onlyOwner {
        require(_isAgent[agent], "Not agent");
        _isAgent[agent] = false;
        emit AgentRemoved(agent);
    }

    /// @notice Sets permission for a specific function call
    function setPermission(
        address agent,
        address target,
        bytes4 functionSelector,
        bool allowed
    ) external onlyOwner {
        require(_isAgent[agent], "Not agent");
        _permissions[agent][target][functionSelector] = allowed;
        emit PermissionSet(agent, target, functionSelector, allowed);
    }
}
