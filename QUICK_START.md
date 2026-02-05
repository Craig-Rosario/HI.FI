# 🤖 HI.FI Agentic Yield Pools - Quick Start

> **AI-powered investment pools with automated execution for testnet demonstrations**

## 🎯 What is This?

A complete demo-mode yield simulation system featuring:
- **3 risk-tiered pools** (Easy, Medium, High) with simulated yields
- **AI agent recommendations** based on user risk profiles  
- **Agent automation** reducing 8 signatures to 1
- **Treasury-funded yields** for testnet environments
- **Complete UX** from questionnaire to automated withdrawals

## ⚡ Quick Start (5 Minutes)

### 1. Deploy Contracts

```bash
cd contracts
npm install

# Update .env with your private key
echo "PRIVATE_KEY=your_key_here" > .env

# Deploy entire system
npx hardhat run scripts/deploy-agent-system.js --network baseSepolia
```

This deploys:
- ✅ TreasuryFunder
- ✅ DemoYieldController  
- ✅ PoolVaultHighRisk
- ✅ AgentPermissionManager

### 2. Fund Treasury

```bash
# Get testnet USDC: https://faucet.circle.com/

# Update script with deployed address
node scripts/fund-treasury.js
```

### 3. Update Frontend

```bash
cd ../hifi

# Update contract addresses in lib/contracts.ts
# Then start dev server
npm run dev
```

### 4. Test the Flow

```bash
cd ../contracts
node scripts/test-agent-flow.js
```

## 📚 Documentation

**Essential Reading:**
- [AGENTIC_ARCHITECTURE.md](./AGENTIC_ARCHITECTURE.md) - Full system architecture
- [SECURITY.md](./SECURITY.md) - Security model & risks
- [tech_arch.md](./tech_arch.md) - Original technical architecture

## 🎨 User Experience

### Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ 1. User Connects Wallet                                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Complete Risk Questionnaire (7 questions)           │
│    → Investment amount, risk tolerance, duration, etc.  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 3. AI Agent Calculates Risk Score (0-100)              │
│    → Recommends pool: Easy, Medium, or High            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 4. User Reviews Recommendation                          │
│    → See reasoning, warnings, alternatives              │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 5. User Deposits to Pool                                │
│    → Funds deployed when cap reached                    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 6. (Optional) Grant Agent Permissions                   │
│    → Sign once to enable automation                     │
│    → Set time limits, amount caps, usage limits         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Agent Monitors 24/7                                  │
│    → Provides recommendations via chat                  │
│    → Executes actions if permitted                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 8. Withdraw Window Opens (1 min after deployment)      │
│    → Manual withdrawal OR                               │
│    → Agent auto-executes (if permitted)                 │
└─────────────────────────────────────────────────────────┘
```

## 🎮 Key Features

### 1. Risk-Based Pool Selection

| Pool | Yield | Risk | Best For |
|------|-------|------|----------|
| **Easy** | Fixed 0.3%/min | Very Low | Beginners, capital preservation |
| **Medium** | 0.3-0.5%/min | Medium | Balanced growth |
| **High** | -20% to +30% APY | **Very High** | Advanced, aggressive |

### 2. AI Agent Chat

Ask the agent:
- "Should I withdraw now?"
- "Which pool matches my risk profile?"
- "What's the market outlook?"
- "Assess my current risk"

Get personalized recommendations with confidence scores.

### 3. Agent Automation

**Reduce 8 signatures to 1:**

Traditional flow:
```
1. Check if withdraw window open ➜ Sign
2. Approve pool for withdrawal ➜ Sign  
3. Execute withdrawal ➜ Sign
4. Unwrap arcUSDC ➜ Sign
5. Approve for bridge ➜ Sign
6. Initiate bridge ➜ Sign
7. Claim on destination ➜ Sign
8. Final transfer ➜ Sign
= 8 SIGNATURES
```

With agent:
```
1. Grant permission (one-time) ➜ Sign
   [Agent monitors and executes everything]
= 1 SIGNATURE
```

### 4. Safety Features

✅ **Time-Bound:** Permissions auto-expire (max 30 days)
✅ **Amount-Capped:** Limit per action  
✅ **Usage-Limited:** Max number of times
✅ **Revocable:** Instant revoke anytime
✅ **Per-Pool:** Isolated permissions
✅ **Transparent:** All actions logged

## 🏗️ Architecture Overview

```
Frontend (Next.js)
  ├─ Risk Questionnaire
  ├─ Agent Chat Interface
  └─ Pool Dashboard

Backend (Next.js API + MongoDB)
  ├─ /api/agent/questionnaire
  ├─ /api/agent/recommendation
  └─ /api/agent/permissions

Smart Contracts (Solidity)
  ├─ TreasuryFunder (USDC management)
  ├─ DemoYieldController (yield config)
  ├─ PoolVaultHighRisk (new pool)
  ├─ AgentPermissionManager (delegation)
  ├─ EasyPool (existing)
  └─ PoolVaultMediumRisk (existing)
```

## 📦 What's Included

### New Smart Contracts

1. **TreasuryFunder.sol** - Centralized yield funding
   - Owner deposits USDC
   - Authorizes pools to request funds
   - Per-pool and global limits
   - Emergency controls

2. **DemoYieldController.sol** - Dynamic yield configuration
   - Register pools with yield models
   - Calculate yields (fixed, percentage, mixed)
   - Request treasury funding
   - Update rates without redeployment

3. **PoolVaultHighRisk.sol** - High volatility pool
   - -20% to +30% annualized range
   - 1.5x leverage simulation
   - Market crash events (5% probability)
   - Liquidation at -50%
   - Volatility amplification

4. **AgentPermissionManager.sol** - Permission system
   - Grant/revoke permissions
   - Time-bound and usage-limited
   - Per-pool isolation
   - Execute actions on behalf of users
   - Transparent logging

### Backend API Routes

- `POST /api/agent/questionnaire` - Submit risk assessment
- `GET /api/agent/questionnaire?address=0x...` - Get user profile
- `POST /api/agent/recommendation` - Get AI recommendations
- `POST /api/agent/permissions` - Grant permissions
- `GET /api/agent/permissions?address=0x...` - Get permissions
- `DELETE /api/agent/permissions` - Revoke permissions

### Frontend Components

- `components/agent/risk-questionnaire.tsx` - 7-step assessment
- `components/agent/agent-chat.tsx` - AI chat interface

### Deployment Scripts

- `scripts/deploy-agent-system.js` - Deploy all contracts
- `scripts/fund-treasury.js` - Fund treasury with USDC
- `scripts/test-agent-flow.js` - Test complete flow

## 🧪 Testing

### Unit Tests
```bash
cd contracts
npx hardhat test
```

### Integration Test
```bash
node scripts/test-agent-flow.js
```

### Manual Testing Flow

1. **Questionnaire:**
   - Complete 7-step assessment
   - Verify risk score calculation
   - Check pool recommendation

2. **Pool Interaction:**
   - Deposit to recommended pool
   - Verify share calculation
   - Check state transitions

3. **Agent Permissions:**
   - Grant withdrawal permission
   - Set time/amount/usage limits
   - Verify permission storage

4. **Agent Execution:**
   - Wait for withdraw window
   - Agent executes withdrawal
   - Verify funds transferred

5. **Permission Management:**
   - Revoke permission
   - Verify permission disabled
   - Test emergency revoke all

## ⚠️ CRITICAL WARNINGS

### High Risk Pool

🚨 **CAN LOSE UP TO 50% OF PRINCIPAL**
- Do NOT use for capital preservation
- Only for risk score > 65
- Can trigger liquidation
- No recovery after liquidation

### Security

⚠️ **NOT PRODUCTION READY**
- No professional audit
- Demo yields only
- Centralized components
- Testnet use only

### Treasury

💰 **Limited Funding**
- Treasury can run out
- Demo yields require funding
- Monitor treasury balance
- Refill as needed

## 📊 Example Usage

### Easy Pool (Low Risk)

```solidity
// User deposits 10 USDC
deposit(10 * 1e6);

// After 1 minute
withdraw(shares); // Receives ~10.03 USDC (+0.3%)

// After 1 hour  
withdraw(shares); // Receives ~11.80 USDC (+18%)
```

### High Risk Pool (Aggressive)

```solidity
// User deposits 10 USDC
deposit(10 * 1e6);

// Scenario A: Favorable (30% gain)
forceUpdatePnL(); // +2.5 USDC
withdraw(shares); // Receives 12.50 USDC

// Scenario B: Market crash (-50% liquidated)
forceUpdatePnL(); // -5.0 USDC (liquidated)
withdraw(shares); // Receives 5.00 USDC only
```

### Agent Permissions

```solidity
// Grant withdrawal permission
agentManager.grantPermission(
  poolAddress,
  PermissionType.WITHDRAW,
  7 days,              // Duration
  5 * 1e6,            // Max 5 USDC
  0,                  // No threshold
  3                   // Max 3 uses
);

// Agent executes when conditions met
agentManager.executeWithdrawal(
  userAddress,
  poolAddress,
  shareAmount
);

// User revokes anytime
agentManager.revokePermission(poolAddress, PermissionType.WITHDRAW);
```

## 🔧 Configuration

### Contract Addresses (Update After Deploy)

```typescript
// hifi/lib/contracts.ts
export const CONTRACTS = {
  baseSepolia: {
    treasuryFunder: '0x...',
    demoYieldController: '0x...',
    poolVaultHighRisk: '0x...',
    agentPermissionManager: '0x...',
    easyPool: '0x...', // existing
    poolVaultMediumRisk: '0x...', // existing
  }
};
```

### Environment Variables

```bash
# contracts/.env
PRIVATE_KEY=your_private_key
BASE_SEPOLIA_RPC=https://sepolia.base.org

# hifi/.env.local
MONGODB_URI=mongodb://...
NEXT_PUBLIC_CHAIN_ID=84532
```

## 📖 Further Reading

- **Architecture:** [AGENTIC_ARCHITECTURE.md](./AGENTIC_ARCHITECTURE.md)
- **Security:** [SECURITY.md](./SECURITY.md)
- **Original Tech:** [tech_arch.md](./tech_arch.md)

## 🤝 Integration with Existing System

This system **extends** (not replaces) the existing HI.FI infrastructure:

**Preserved:**
- ✅ ArcUSDC wrapper
- ✅ EasyPool (Aave integration)
- ✅ PoolVaultMediumRisk
- ✅ Bridge flows
- ✅ Multi-user share accounting

**Added:**
- ✨ TreasuryFunder (centralized funding)
- ✨ DemoYieldController (dynamic config)
- ✨ PoolVaultHighRisk (new pool)
- ✨ AgentPermissionManager (automation)
- ✨ Agent APIs (recommendations)
- ✨ Agent UI (questionnaire + chat)

## 🚀 Deployment Checklist

- [ ] Deploy contracts to Base Sepolia
- [ ] Verify contracts on Basescan
- [ ] Fund treasury with testnet USDC
- [ ] Update frontend contract addresses
- [ ] Configure MongoDB connection
- [ ] Test questionnaire flow
- [ ] Test pool deposits
- [ ] Test agent permissions
- [ ] Test agent execution
- [ ] Monitor treasury balance

## 🎓 Educational Value

This system demonstrates:

1. **Risk-Based DeFi** - Matching users to appropriate products
2. **Agent Architecture** - Off-chain monitoring + on-chain execution
3. **Permission Delegation** - Granular, revocable control
4. **Yield Simulation** - Demo modes for testnet environments
5. **UX Innovation** - Reducing signature fatigue

Perfect for:
- Hackathon submissions
- Educational demos
- Concept validation
- User research

## 📞 Support

**Issues?**
1. Check documentation
2. Review contract comments
3. Test scripts for examples
4. Verify addresses and configuration

---

**Built for testnet demonstrations and educational purposes.**

**⚠️ NOT FOR PRODUCTION USE - READ SECURITY.md ⚠️**

---

## 🏁 Next Steps

1. **Deploy:** Run `scripts/deploy-agent-system.js`
2. **Fund:** Run `scripts/fund-treasury.js`  
3. **Test:** Run `scripts/test-agent-flow.js`
4. **Explore:** Open agent chat and try recommendations
5. **Automate:** Grant permissions and test agent execution

**Happy building! 🚀**
