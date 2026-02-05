// Contract addresses and ABIs for agentic yield system

export const CONTRACT_ADDRESSES = {
    // Base Sepolia addresses - UPDATE AFTER DEPLOYMENT
    treasuryFunder: "0x0000000000000000000000000000000000000000",
    demoYieldController: "0x0000000000000000000000000000000000000000",
    poolVaultHighRisk: "0x0000000000000000000000000000000000000000",
    agentPermissionManager: "0x0000000000000000000000000000000000000000",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
    arcUsdc: "0x0DD76fB7C83A84C57C81A4353B565f34016aBaf8", // Circle Gateway arcUSDC
};

// Minimal ABIs for contract interaction
export const ABIS = {
    poolVaultHighRisk: [
        "function deposit(uint256 amount) external",
        "function withdraw(uint256 shares) external",
        "function balanceOf(address account) external view returns (uint256)",
        "function shares(address account) external view returns (uint256)",
        "function getPendingWithdrawals(address user) external view returns (tuple(uint256 shares, uint256 usdcAmount, uint256 initiatedAt, bool redeemed)[])",
        "function getRiskMetrics() external view returns (tuple(uint256 currentPnL, uint256 volatilityIndex, bool atRisk, uint256 liquidationThreshold))",
        "function state() external view returns (uint8)",
        "function cap() external view returns (uint256)",
        "function totalDeposited() external view returns (uint256)",
        "function deployedAt() external view returns (uint256)",
        "function isWithdrawOpen() external view returns (bool)",
        "function timeUntilWithdraw() external view returns (uint256)",
        "function forceUpdatePnL() external",
    ],
    agentPermissionManager: [
        "function grantPermission(uint8 permissionType, address pool, address agent, uint256 expiresAt, uint256 maxAmount, uint256 maxUses) external",
        "function revokePermission(uint8 permissionType, address pool) external",
        "function revokeAllPermissions() external",
        "function getPermission(address user, address pool, uint8 permissionType) external view returns (tuple(bool enabled, address agent, uint256 expiresAt, uint256 maxAmount, uint256 maxUses, uint256 usedCount))",
        "function getUserPermissions(address user) external view returns (tuple(uint8 permissionType, address pool, address agent, uint256 expiresAt, uint256 maxAmount)[])",
        "function executeWithdrawal(address user, address pool, uint256 amount) external",
        "function executeStopLoss(address user, address pool) external",
    ],
    treasuryFunder: [
        "function depositTreasury(uint256 amount) external",
        "function totalTreasury() external view returns (uint256)",
        "function totalFunded() external view returns (uint256)",
        "function isPoolAuthorized(address pool) external view returns (bool)",
        "function poolFundingLimits(address pool) external view returns (uint256)",
        "function globalFundingLimit() external view returns (uint256)",
    ],
    demoYieldController: [
        "function calculateYield(address pool, uint256 principal, uint256 durationMinutes) external view returns (int256)",
        "function previewYield(address pool, uint256 principal) external view returns (int256 expectedYield, uint256 confidence)",
        "function getPoolConfig(address pool) external view returns (tuple(bool enabled, uint8 yieldModel, uint256 fixedRatePerMinute, uint256 percentageBps, int256 minYieldBps, int256 maxYieldBps, uint256 capPerWithdrawal, uint256 totalYieldPaid))",
    ],
    erc20: [
        "function balanceOf(address account) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function decimals() external view returns (uint8)",
    ],
};

// Permission types enum
export enum PermissionType {
    WITHDRAW = 0,
    STOP_LOSS = 1,
    TAKE_PROFIT = 2,
    REBALANCE = 3,
    COMPOUND = 4,
}

// Pool states enum
export enum PoolState {
    COLLECTING = 0,
    DEPLOYED = 1,
    WITHDRAW_WINDOW = 2,
    CLOSED = 3,
}

// Risk levels
export const RISK_LEVELS = {
    EASY: { name: "Easy", apy: "5-8%", risk: "Low", color: "green" },
    MEDIUM: { name: "Medium", apy: "10-15%", risk: "Medium", color: "yellow" },
    HIGH: { name: "High", apy: "-20% to +30%", risk: "High", color: "red" },
};
