# 🤖 HI.FI Agentic Yield Pools - Architecture & Documentation

## 📋 Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Smart Contracts](#smart-contracts)
- [Pool Types](#pool-types)
- [Agent System](#agent-system)
- [Security Model](#security-model)
- [Deployment Guide](#deployment-guide)
- [API Reference](#api-reference)
- [Frontend Integration](#frontend-integration)
- [Testing Strategy](#testing-strategy)
- [Known Limitations](#known-limitations)

---

## 🎯 Overview

HI.FI Agentic Yield Pools is a **demo-mode yield simulation system** designed for testnets where real yield is unavailable. The system combines:

- **Three risk-tiered investment pools** (Easy, Medium, High)
- **Simulated yield generation** funded by treasury
- **AI-powered agent recommendations** based on user risk profiles
- **Automated execution** with user-approved permissions
- **On-chain permission management** reducing signature fatigue

### Key Features

✅ **Demo Yield Simulation** - Treasury-funded yields for testing
✅ **Risk-Based Pool Selection** - Easy (0.3%/min), Medium (0.3-0.5%/min), High (-20% to +30% APY)
✅ **AI Agent Integration** - Personalized recommendations and automation
✅ **Permission Delegation** - 1 signature instead of 8 for automated actions
✅ **Time-Bound Security** - Auto-expiring permissions with usage limits
✅ **Multi-Pool Support** - Granular permissions per pool

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│  • Risk Questionnaire Component                             │
│  • AI Agent Chat Interface                                  │
│  • Pool Dashboard                                           │
│  • Permission Management UI                                 │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
             ▼                            ▼
┌────────────────────────┐  ┌────────────────────────────────┐
│   BACKEND (Next.js)    │  │   BLOCKCHAIN (Base Sepolia)    │
├────────────────────────┤  ├────────────────────────────────┤
│  • /api/agent/         │  │  ┌──────────────────────────┐ │
│    questionnaire       │  │  │  TreasuryFunder          │ │
│  • /api/agent/         │  │  │  ├─ USDC Management      │ │
│    recommendation      │  │  │  ├─ Pool Authorization   │ │
│  • /api/agent/         │  │  │  └─ Funding Limits       │ │
│    permissions         │  │  └────────┬─────────────────┘ │
│  • /api/pools          │  │           │                   │
│                        │  │           ▼                   │
│  • MongoDB             │  │  ┌──────────────────────────┐ │
│    - User profiles     │  │  │  DemoYieldController     │ │
│    - Questionnaires    │  │  │  ├─ Yield Rates Config  │ │
│    - Permissions       │  │  │  ├─ Pool Registration   │ │
│                        │  │  │  └─ Yield Calculation   │ │
└────────────────────────┘  │  └────────┬─────────────────┘ │
                            │           │                   │
                            │           ▼                   │
                            │  ┌──────────────────────────┐ │
                            │  │  Pool Vaults             │ │
                            │  │  ├─ EasyPool (Aave)     │ │
                            │  │  ├─ MediumRisk          │ │
                            │  │  └─ HighRisk            │ │
                            │  └────────┬─────────────────┘ │
                            │           │                   │
                            │           ▼                   │
                            │  ┌──────────────────────────┐ │
                            │  │  AgentPermissionManager  │ │
                            │  │  ├─ Permission Grants    │ │
                            │  │  ├─ Auto-Execution       │ │
                            │  │  └─ Revoke Controls      │ │
                            │  └──────────────────────────┘ │
                            └────────────────────────────────┘
```

---

## 📜 Smart Contracts

### 1. TreasuryFunder

**Purpose:** Centralized treasury for demo yield funding across all pools.

**Key Functions:**
- `depositTreasury(uint256 amount)` - Owner deposits USDC for yields
- `authorizePool(address pool, uint256 fundingLimit)` - Authorize pool to request funds
- `fundYield(address recipient, uint256 amount)` - Called by pools to fund yields
- `emergencyWithdraw()` - Owner emergency withdrawal

**State Variables:**
- `mapping(address => bool) authorizedPools` - Authorized pool contracts
- `mapping(address => uint256) fundingProvided` - Total funding per pool
- `uint256 globalFundingLimit` - Maximum total funding across all pools

**Security:**
- ✅ Owner-only configuration
- ✅ Per-pool funding limits
- ✅ Global funding cap
- ✅ Emergency pause functionality
- ✅ Transparent event logging

---

### 2. DemoYieldController

**Purpose:** Dynamic yield rate configuration without redeploying pools.

**Key Functions:**
- `registerPool(...)` - Register pool with yield configuration
- `calculateYield(address user, uint256 principal, uint256 time)` - Calculate yield
- `requestYieldFunding(address recipient, uint256 amount)` - Request treasury funding
- `previewYield(address pool, uint256 principal, uint256 time)` - Preview calculation

**Yield Models:**
- **Model 0 (Fixed):** Flat rate per minute (e.g., 0.03 USDC/min)
- **Model 1 (Percentage):** Annualized percentage (e.g., 5% APY)
- **Model 2 (Mixed):** Fixed + Percentage combined

**Configuration Per Pool:**
```solidity
struct YieldConfig {
    bool enabled;
    uint8 yieldModel;
    uint256 fixedRatePerMinute;
    int256 percentageBps;
    int256 minYieldBps;
    int256 maxYieldBps;
    uint256 capPerWithdrawal;
}
```

---

### 3. PoolVaultHighRisk

**Purpose:** High-risk, high-reward investment pool with extreme volatility simulation.

**Key Features:**
- ⚠️ **Annualized yield range:** -20% to +30%
- ⚠️ **Leverage simulation:** 1.5x effective leverage
- ⚠️ **Principal protection floor:** -50% maximum loss
- ⚠️ **Market crash events:** 5% probability every 5 minutes
- ⚠️ **Volatility amplification:** Increases over time
- ⚠️ **Liquidation state:** Triggered at -50% loss

**Risk Metrics API:**
```solidity
function getRiskMetrics() returns (
    uint256 currentVolatility,
    int256 currentPnLPercent,
    uint256 timeInMarket,
    bool isLiquidated
)
```

**State Transitions:**
```
COLLECTING → DEPLOYED → WITHDRAW_WINDOW
                ↓
           LIQUIDATED (if loss >= 50%)
```

---

### 4. AgentPermissionManager

**Purpose:** Delegation system for agent automation with granular permissions.

**Permission Types:**
- `WITHDRAW` - Auto-withdraw when conditions met
- `REBALANCE` - Move between pools
- `EMERGENCY_EXIT` - Exit position immediately
- `AUTO_COMPOUND` - Reinvest yields
- `STOP_LOSS` - Auto-exit on loss threshold

**Key Functions:**
- `grantPermission(...)` - User grants permission to agent
- `revokePermission(...)` - User revokes specific permission
- `revokeAllPermissions()` - Emergency revoke all
- `executeWithdrawal(...)` - Agent executes withdrawal
- `executeStopLoss(...)` - Agent triggers stop-loss

**Permission Structure:**
```solidity
struct Permission {
    PermissionType permissionType;
    address pool;
    bool enabled;
    uint256 expiresAt;
    uint256 maxAmount;
    int256 thresholdBps;
    uint256 grantedAt;
    uint256 usedCount;
    uint256 maxUses;
}
```

**Security Features:**
- ✅ Time-bound expiration (max 30 days)
- ✅ Usage limits (e.g., max 3 withdrawals)
- ✅ Amount limits per action
- ✅ Per-pool isolation
- ✅ Instant revoke capability
- ✅ Transparent action history

---

## 🎰 Pool Types

### Easy Pool (Low Risk)

**Existing Contract:** `EasyPool.sol`

**Characteristics:**
- ✅ Fixed 0.3% return per minute
- ✅ Backed by Aave + Treasury subsidy
- ✅ Principal protected
- ✅ Predictable returns
- ✅ Ideal for capital preservation

**Target Users:**
- Risk score < 35
- Conservative investors
- First-time DeFi users
- Capital preservation goals

**Example Return:**
```
10 USDC deposit
After 1 minute: 10.03 USDC
After 10 minutes: 10.30 USDC
After 1 hour: 11.80 USDC
```

---

### Medium Pool (Variable Risk)

**Existing Contract:** `PoolVaultMediumRisk.sol`

**Characteristics:**
- 📊 Variable yield: -2% to +6% annualized
- 📊 Base rate: +4% APY
- 📊 Pseudo-random volatility
- 📊 Can have negative periods
- 📊 Averages out over time

**Target Users:**
- Risk score 35-65
- Balanced investors
- Growth-oriented goals
- Can tolerate minor losses

**Yield Calculation:**
```javascript
effectiveRate = baseRate (4%) + volatility (-6% to +2%)
finalRange = -2% to +6% annualized
```

---

### High Risk Pool (Aggressive)

**New Contract:** `PoolVaultHighRisk.sol`

**Characteristics:**
- ⚠️ Extreme volatility: -20% to +30% APY
- ⚠️ 1.5x leverage amplification
- ⚠️ Market crash simulation (5% probability)
- ⚠️ Volatility increases over time
- ⚠️ CAN REDUCE PRINCIPAL
- ⚠️ Liquidation at -50%

**Target Users:**
- Risk score > 65
- Aggressive growth goals
- High risk tolerance
- Advanced DeFi experience

**Warning Example:**
```
Deposit: 10 USDC

Best Case (after 1 week): 15.75 USDC (+57.5%)
Average Case: 11.20 USDC (+12%)
Worst Case: 5.00 USDC (-50%, liquidated)

This is NOT suitable for risk-averse users!
```

---

## 🤖 Agent System

### Risk Questionnaire

7-step assessment collecting:
1. **Investment Amount** - Capital to deploy
2. **Risk Tolerance** - Low, Medium, High
3. **Investment Duration** - Days to hold
4. **Investment Goal** - Preservation, Income, Growth, Aggressive
5. **Liquidity Needs** - How quickly need access
6. **Experience Level** - Beginner, Intermediate, Advanced
7. **Market Outlook** - Bullish, Neutral, Bearish

**Risk Score Calculation:**
```
Risk Score (0-100) =
  Risk Tolerance (0-40) +
  Investment Goal (0-20) +
  Duration (0-20) +
  Experience (0-10) +
  Market View (0-10)

Categories:
  0-35:   Low Risk → Easy Pool
  35-65:  Medium Risk → Medium Pool
  65-100: High Risk → High Risk Pool
```

---

### Agent Recommendations

The AI agent provides:

**1. Pool Selection**
- Matches risk score to appropriate pool
- Provides reasoning and alternatives
- Considers market conditions

**2. Withdrawal Timing**
- Analyzes P&L and position duration
- Compares to user's target timeframe
- Checks pool-specific risk factors
- Recommends action with confidence score

**3. Market Analysis**
- Simulated market sentiment
- Volatility assessment
- Liquidity conditions
- Timing recommendations

**4. Risk Assessment**
- Current risk level
- Principal at risk
- Stop-loss recommendations
- Automation suggestions

**5. Automation Setup**
- Recommends permission types
- Suggests thresholds and limits
- Explains benefits

---

### Agent Automation

**Workflow:**

1. **User Completes Questionnaire**
   - Frontend: `RiskQuestionnaire` component
   - Backend: `/api/agent/questionnaire` → MongoDB

2. **Agent Provides Recommendation**
   - Frontend: `AgentChat` component
   - Backend: `/api/agent/recommendation` → AI logic

3. **User Grants Permissions** (Optional)
   - Frontend: Permission UI
   - Smart Contract: `AgentPermissionManager.grantPermission()`
   - User signs transaction ONCE

4. **Agent Monitors 24/7** (Off-chain)
   - Reads on-chain pool state
   - Evaluates withdrawal conditions
   - Checks user permissions

5. **Agent Executes Actions**
   - Smart Contract: `AgentPermissionManager.executeWithdrawal()`
   - Requires: Valid permission + Open withdraw window
   - Agent operator signature (not user)

**Benefits:**
- 🎯 **8 signatures → 1 signature** (initial grant)
- 🤖 **24/7 monitoring** without user attention
- ⚡ **Optimal timing** for withdrawals
- 🔒 **User retains control** (instant revoke)

---

## 🔐 Security Model

### What is Real vs. Simulated

| Component | Status | Notes |
|-----------|--------|-------|
| arcUSDC wrapping | ✅ Real | 1:1 with testnet USDC |
| Pool deposits | ✅ Real | Actual ERC-20 transfers |
| Share accounting | ✅ Real | On-chain share calculation |
| Withdraw windows | ✅ Real | Time-based on-chain logic |
| Easy Pool Aave | ✅ Real | Actual Aave V3 integration |
| Demo yields | ⚠️ Simulated | Treasury-funded for testing |
| Medium/High PnL | ⚠️ Simulated | Pseudo-random calculation |
| Agent AI | ⚠️ Simulated | Rules-based logic |
| Market crashes | ⚠️ Simulated | Random events |

---

### Security Assumptions

#### ✅ Safe for Demo/Testnet:
- Treasury-funded yields (limited by caps)
- Agent permissions (time-bound, revocable)
- Simulated volatility (capped ranges)
- Permission delegation (per-pool isolation)

#### ⚠️ NOT Safe for Production:
- **Treasury dependency** - Centralized funding point
- **Simulated yields** - Not backed by real protocols
- **Pseudo-randomness** - Uses block data (predictable)
- **Agent operators** - Centralized execution
- **No audits** - Contracts not professionally audited
- **No insurance** - No protection against smart contract bugs

---

### Risk Disclosures

**For Easy Pool:**
- ✅ Principal protected by Aave
- ⚠️ Demo yield comes from treasury (limited funds)
- ⚠️ Treasury could run out

**For Medium Pool:**
- ⚠️ Can have negative yield periods
- ⚠️ Not backed by real strategies
- ✅ Principal cannot go below zero

**For High Risk Pool:**
- 🚨 **CAN LOSE UP TO 50% OF PRINCIPAL**
- 🚨 Market crash events can trigger instantly
- 🚨 Liquidation is permanent
- 🚨 Not suitable for most users
- ⚠️ Volatility simulation, not real market

**For Agent Permissions:**
- ✅ User can revoke anytime
- ✅ Time-bound and usage-limited
- ⚠️ Relies on agent operator staying online
- ⚠️ Agent operator is centralized
- ⚠️ User must approve pool shares transfer

---

## 🚀 Deployment Guide

### Prerequisites

```bash
# Install dependencies
cd contracts
npm install

# Set up environment variables
cp .env.example .env
# Add your private key and RPC URLs
```

### Step 1: Deploy Core System

```bash
# Deploy TreasuryFunder, DemoYieldController, HighRiskPool, AgentPermissionManager
npx hardhat run scripts/deploy-agent-system.js --network baseSepolia
```

This creates `deployment-agent-system.json` with addresses.

### Step 2: Fund Treasury

```bash
# Get testnet USDC from Circle faucet
# https://faucet.circle.com/

# Fund the treasury
node scripts/fund-treasury.js
```

### Step 3: Update Frontend

```typescript
// hifi/lib/contracts.ts
export const CONTRACTS = {
  treasuryFunder: '0x...',
  demoYieldController: '0x...',
  poolVaultHighRisk: '0x...',
  agentPermissionManager: '0x...',
};
```

### Step 4: Verify Contracts

```bash
npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### Step 5: Test Flow

```bash
node scripts/test-agent-flow.js
```

---

## 📡 API Reference

### Backend Endpoints

#### POST /api/agent/questionnaire
Submit user risk assessment.

**Request:**
```json
{
  "address": "0x...",
  "questionnaire": {
    "investmentAmount": "100",
    "riskTolerance": "medium",
    "investmentDuration": "30",
    "investmentGoal": "growth",
    "liquidityNeeds": "medium",
    "experienceLevel": "intermediate",
    "marketConditionView": "neutral"
  }
}
```

**Response:**
```json
{
  "success": true,
  "riskScore": 55,
  "recommendation": {
    "recommendedPool": "medium",
    "reasoning": [...],
    "warnings": [...]
  }
}
```

---

#### POST /api/agent/recommendation
Get AI agent recommendation.

**Request:**
```json
{
  "address": "0x...",
  "poolId": "pool_id",
  "question": "should_withdraw" | "best_pool" | "market_analysis" | "risk_assessment"
}
```

**Response:**
```json
{
  "success": true,
  "recommendation": {
    "action": "withdraw",
    "confidence": 85,
    "message": "Strong recommendation: Withdraw your position now",
    "factors": ["Strong profit: +12.5%", "Target duration reached"],
    "currentPnL": 12.5
  }
}
```

---

## 🖥️ Frontend Integration

### Components

1. **RiskQuestionnaire**
   ```tsx
   import RiskQuestionnaire from '@/components/agent/risk-questionnaire';
   
   <RiskQuestionnaire
     onComplete={(data, recommendation) => {
       // Handle completion
     }}
     onSkip={() => {
       // Handle skip
     }}
   />
   ```

2. **AgentChat**
   ```tsx
   import AgentChat from '@/components/agent/agent-chat';
   
   <AgentChat
     isOpen={chatOpen}
     onClose={() => setChatOpen(false)}
     poolId={currentPoolId}
   />
   ```

### User Flow

```
1. User Connects Wallet
   ↓
2. Risk Questionnaire (one-time)
   ↓
3. Agent Recommends Pool
   ↓
4. User Deposits to Pool
   ↓
5. User Grants Agent Permissions (optional)
   ↓
6. Agent Monitors & Provides Recommendations
   ↓
7. Agent Auto-Executes (if permitted)
   ↓
8. User Withdraws (manual or automated)
```

---

## 🧪 Testing Strategy

### Unit Tests (Smart Contracts)

```bash
cd contracts
npx hardhat test
```

Test coverage:
- ✅ TreasuryFunder: deposits, authorizations, funding limits
- ✅ DemoYieldController: yield calculations, pool registration
- ✅ PoolVaultHighRisk: deposits, PnL calculation, liquidation
- ✅ AgentPermissionManager: permission grants, execution, revokes

### Integration Tests

```bash
node scripts/test-agent-flow.js
```

Tests:
- ✅ Complete user journey
- ✅ Agent permission flow
- ✅ Multi-pool interactions
- ✅ Treasury funding

### Frontend Tests

```bash
cd hifi
npm run test
```

---

## ⚠️ Known Limitations

### Smart Contract Limitations

1. **Pseudo-randomness**
   - Uses block.timestamp and block.prevrandao
   - Predictable by miners/validators
   - OK for demo, NOT for production

2. **Centralized Treasury**
   - Single point of control
   - Limited by caps
   - Could run out of funds

3. **No Oracle Integration**
   - Market data is simulated
   - No real external price feeds
   - Yields are not market-driven

4. **Gas Optimization**
   - Not optimized for gas efficiency
   - Loop operations may be expensive
   - Consider batch operations

### Agent System Limitations

1. **Off-Chain Agent**
   - Requires centralized server
   - Not trustless
   - Dependent on operator uptime

2. **Permission Model**
   - User must approve shares transfer separately
   - Cannot execute across chains
   - Limited to configured pool addresses

3. **AI Recommendations**
   - Rules-based, not ML-trained
   - Limited market data integration
   - Simplified decision logic

### Production Readiness

**❌ NOT Production Ready:**
- No professional audit
- Demo yield model only
- Centralized components
- Limited testing
- No insurance/protection

**✅ Suitable For:**
- Testnet demonstrations
- Hackathon judging
- Concept validation
- User testing
- Educational purposes

---

## 🔄 Future Enhancements

### Phase 1: Production Hardening
- [ ] Professional security audit
- [ ] Replace pseudo-randomness with Chainlink VRF
- [ ] Integrate real yield protocols (Aave, Compound, Yearn)
- [ ] Add comprehensive test suite
- [ ] Gas optimization

### Phase 2: Decentralization
- [ ] Decentralized agent operators (Gelato, Chainlink Automation)
- [ ] DAO governance for treasury
- [ ] Multi-sig controls
- [ ] Upgrade to proxy pattern

### Phase 3: Advanced Features
- [ ] Cross-chain pooling (LayerZero, Wormhole)
- [ ] Real ML-powered recommendations
- [ ] Integration with 1inch, Uniswap v4
- [ ] ENS identity mapping
- [ ] Insurance integration

### Phase 4: External Integrations
- [ ] Sui ecosystem bridge
- [ ] Yellow Protocol data feeds
- [ ] Additional DeFi protocol adapters
- [ ] Social recovery mechanisms

---

## 📚 Additional Resources

- **Existing Docs:** `README.md`, `tech_arch.md`
- **Contract Source:** `/contracts/contracts/`
- **API Source:** `/hifi/app/api/agent/`
- **Frontend Source:** `/hifi/components/agent/`
- **Deployment Scripts:** `/contracts/scripts/`

---

## 📞 Support

For questions or issues:
1. Check existing documentation
2. Review contract comments
3. Test on Base Sepolia testnet first
4. Verify all addresses before transactions

---

**Built with ❤️ for testnet demos and educational purposes.**

**⚠️ Use at your own risk. Not financial advice. Not production-ready.**
