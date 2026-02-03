// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IGovernanceSchema {
    struct StrategyConfig {
        bool isWhitelisted;
        uint256 depositCap;     // Max assets this strategy can hold
        uint256 minAlloc;       // Min amount to allocate (dust protection)
        uint256 maxSlippage;    // Max slippage bps for strategy entry/exit
    }

    struct AgentPermissions {
        bool isActive;
        mapping(address => mapping(bytes4 => bool)) allowedCalls; // Target -> Selector -> Bool
        uint256 maxRebalanceFreq; // Min delay between rebalances
        uint256 lastRebalance;
    }

    struct GlobalConfig {
        bool isPaused;
        address feeRecipient;
        uint256 managementFeeBps;
        uint256 performanceFeeBps;
    }
}
