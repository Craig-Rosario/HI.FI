# 🔒 Security Model & Risk Disclosure

## ⚠️ CRITICAL: READ BEFORE USING

This document outlines the security model, known risks, and limitations of the HI.FI Agentic Yield Pools system.

---

## 🎯 System Purpose

**This is a DEMO system for TESTNET environments only.**

The system is designed for:
- ✅ Demonstrating agentic DeFi concepts
- ✅ Hackathon judging and showcasing
- ✅ User experience testing
- ✅ Educational purposes

The system is NOT designed for:
- ❌ Production deployment
- ❌ Real user funds (mainnet)
- ❌ Financial advice or guarantees
- ❌ Regulatory compliance

---

## 🔐 What is Real vs. Simulated

### ✅ Real On-Chain Components

| Component | Description | Security Level |
|-----------|-------------|----------------|
| **arcUSDC Wrapping** | 1:1 wrapper for testnet USDC | ✅ Standard ERC-20 |
| **Pool Deposits** | Actual token transfers | ✅ Standard safeguards |
| **Share Accounting** | Pro-rata ownership calculation | ✅ Math verified |
| **Withdraw Windows** | Time-based access control | ✅ Blockchain timestamp |
| **Easy Pool Aave** | Real Aave V3 integration | ✅ Aave's security |
| **Permissions** | On-chain delegation system | ✅ Revocable control |

### ⚠️ Simulated Components

| Component | Why Simulated | Risk Level |
|-----------|---------------|------------|
| **Demo Yields** | Real yield unavailable on testnet | 🟡 Funded by treasury |
| **Medium/High PnL** | Demonstrating volatility concepts | 🟡 Pseudo-random |
| **Market Crashes** | Simulating extreme events | 🟡 Random triggers |
| **Agent AI** | Rules-based recommendations | 🟠 Not ML-trained |
| **Volatility** | Block-based randomness | 🟠 Predictable |

---

## 🚨 Risk Categories

### 1. High Risk Pool - PRINCIPAL LOSS

**⚠️ YOU CAN LOSE UP TO 50% OF YOUR DEPOSIT**

The High Risk Pool (`PoolVaultHighRisk`) is designed to simulate extreme market conditions:

**Risks:**
- 📉 **Negative Returns:** Can lose value every update
- 📉 **Market Crash Events:** 5% probability every 5 minutes
- 📉 **Liquidation:** Automatic at -50% loss
- 📉 **Increasing Volatility:** Risk amplifies over time
- 📉 **No Recovery:** Once liquidated, cannot recover

**Protection:**
- ✅ Floor at -50% (never goes to zero)
- ✅ Clear warning labels in UI
- ✅ Restricted to high risk score users (65+)

**Example Scenarios:**

```
Scenario 1: Favorable Market
Deposit: 10 USDC
After 7 days: 15.75 USDC (+57.5%)

Scenario 2: Mixed Conditions
Deposit: 10 USDC
After 7 days: 11.20 USDC (+12%)

Scenario 3: Market Crash
Deposit: 10 USDC
After 3 days: 5.00 USDC (-50%, LIQUIDATED)

Scenario 4: Extreme Volatility
Deposit: 10 USDC
Day 1: 12.00 USDC (+20%)
Day 2: 9.50 USDC (-5%)
Day 3: 14.00 USDC (+40%)
Day 4: 7.00 USDC (-30%)
Day 5: 5.00 USDC (LIQUIDATED)
```

**Who Should Use:**
- ✅ Risk score > 65
- ✅ Advanced DeFi experience
- ✅ Can afford to lose 50%
- ✅ Short-term speculation

**Who Should NOT Use:**
- ❌ Risk-averse investors
- ❌ First-time DeFi users
- ❌ Capital preservation goals
- ❌ Cannot afford losses

---

### 2. Medium Risk Pool - Variable Returns

**⚠️ CAN HAVE NEGATIVE PERIODS**

The Medium Risk Pool (`PoolVaultMediumRisk`) demonstrates controlled volatility:

**Risks:**
- 📊 **Negative Yields:** Some periods return less than deposited
- 📊 **Annualized Range:** -2% to +6%
- 📊 **Short-Term Losses:** May be underwater temporarily

**Protections:**
- ✅ Principal protected (cannot go negative)
- ✅ Bounded risk (-2% min)
- ✅ Averages positive over time
- ✅ No liquidation

**Example:**

```
Deposit: 10 USDC
Day 1: 10.05 USDC (+0.5%)
Day 2: 9.98 USDC (-0.2%)  ← Negative period
Day 3: 10.03 USDC (+0.5%)
Day 4: 10.10 USDC (+1.0%)
Week 1: 10.25 USDC (+2.5% net)
```

**Who Should Use:**
- ✅ Risk score 35-65
- ✅ Can tolerate short-term losses
- ✅ Growth-oriented
- ✅ 2+ week timeframe

---

### 3. Easy Pool - Fixed Returns

**✅ PRINCIPAL PROTECTED**

The Easy Pool (`EasyPool`) provides predictable returns:

**Risks:**
- 🟢 **Minimal:** Treasury could run out of subsidy funds
- 🟢 **Aave Risk:** Aave protocol risk (low on testnet)

**Protections:**
- ✅ Fixed 0.3% per minute
- ✅ Backed by Aave
- ✅ Treasury subsidized
- ✅ No principal loss

**Example:**

```
Deposit: 10 USDC
After 1 minute: 10.03 USDC
After 10 minutes: 10.30 USDC
After 1 hour: 11.80 USDC
After 1 day: 14.32 USDC

Predictable and stable.
```

---

## 🤖 Agent Permission Risks

### Delegation Model

When you grant permissions to the AI agent:

**What You Grant:**
- ✅ Agent can execute specific actions (e.g., withdraw)
- ✅ Only for specified pools
- ✅ Only within limits you set
- ✅ Only until expiration time

**What You Keep:**
- ✅ Ownership of funds
- ✅ Ability to revoke anytime
- ✅ Per-pool control
- ✅ View all agent actions

### Agent Risks

| Risk | Mitigation |
|------|------------|
| **Agent Operator Offline** | Fallback: Manual withdrawal available |
| **Agent Makes Wrong Decision** | User can revoke and override |
| **Agent Operator Compromise** | Limited by time bounds and caps |
| **Smart Contract Bug** | Testnet only, limited funds |

### Permission Examples

**Safe Permission:**
```
Pool: Easy Pool
Action: Auto-withdraw
Duration: 7 days
Max Amount: 5 USDC
Max Uses: 1
```

**Risky Permission:**
```
Pool: High Risk Pool
Action: Emergency exit
Duration: 30 days
Max Amount: Unlimited
Max Uses: Unlimited
```
⚠️ Avoid unlimited permissions on high-risk pools!

---

## 🏦 Treasury Dependency

### How Demo Yields Work

```
1. Owner deposits USDC to TreasuryFunder
2. Pools authorized to request funds
3. On withdrawal, pool calculates yield
4. Pool requests funding from treasury
5. Treasury transfers yield to user
```

### Treasury Risks

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| **Treasury Empty** | No yield paid | Per-pool funding limits |
| **Owner Malicious** | Emergency withdrawal | Monitoring, caps |
| **Treasury Hack** | Funds stolen | Testnet only |
| **Gas Costs** | High on mainnet | Use L2s |

**Treasury Limits:**
- Global cap: 10,000 USDC
- Per-pool cap: 1,000 USDC
- Monitoring required

---

## 🔒 Smart Contract Security

### Audit Status

**❌ NOT AUDITED**

These contracts have NOT been professionally audited:
- TreasuryFunder
- DemoYieldController
- PoolVaultHighRisk
- AgentPermissionManager

**Implications:**
- May contain bugs
- May have vulnerabilities
- Should NOT hold real value
- Testnet use only

### Known Limitations

1. **Pseudo-Random Number Generation**
   - Uses `block.timestamp` and `block.prevrandao`
   - Predictable by miners/validators
   - Not secure for production

2. **Centralized Components**
   - Treasury controlled by single owner
   - Agent operators are centralized
   - No multi-sig or governance

3. **Gas Inefficiency**
   - Not optimized for gas costs
   - May be expensive on mainnet
   - Loops and complex calculations

4. **Access Control**
   - Simple owner-based
   - No role-based access control
   - No timelock for critical functions

5. **Upgradeability**
   - Not upgradeable
   - Bug fixes require redeployment
   - No migration path

---

## 💰 Financial Risks

### Not Financial Advice

**This system does NOT provide financial advice.**

- ❌ Agent recommendations are algorithmic
- ❌ Not based on real market analysis
- ❌ Not personalized financial planning
- ❌ Not investment advice

### No Guarantees

**No returns are guaranteed.**

- Easy Pool: Treasury could run out
- Medium Pool: Can have negative periods
- High Risk Pool: Can lose up to 50%

### No Insurance

**Your funds are not insured.**

- No FDIC or similar protection
- No smart contract insurance
- No recovery mechanism
- Loss is permanent

---

## 🌐 Network & Integration Risks

### Testnet Limitations

**Base Sepolia Testnet:**
- Test tokens have no value
- Network can reset
- Contracts can be redeployed
- Faucet availability varies

### External Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| **Aave V3** | Protocol changes | Monitor Aave docs |
| **USDC Faucet** | Availability | Alternative tokens |
| **Base RPC** | Downtime | Multiple providers |
| **MongoDB** | Database failure | Backups |

### Future Integrations (Planned)

When integrating with:
- 1inch: API rate limits
- Sui: Cross-chain risks
- Uniswap v4: Hook security
- ENS: Resolution failures
- Yellow Protocol: Data accuracy

All external integrations should be:
- ✅ Optional (non-blocking)
- ✅ Swappable (modular)
- ✅ Monitored (health checks)
- ✅ Tested independently

---

## 📋 User Responsibilities

### Before Using

**You must:**
1. ✅ Read this security document
2. ✅ Understand risk levels
3. ✅ Complete risk questionnaire
4. ✅ Only use testnet funds
5. ✅ Never deploy on mainnet without audit

### While Using

**You should:**
1. ✅ Monitor your positions
2. ✅ Review agent recommendations
3. ✅ Understand permission grants
4. ✅ Use stop-loss on high-risk pools
5. ✅ Be prepared for losses

### When Granting Permissions

**You should:**
1. ✅ Set time limits (prefer shorter)
2. ✅ Set amount caps (prefer lower)
3. ✅ Limit number of uses
4. ✅ Regularly review and revoke
5. ✅ Only grant what you need

---

## 🚫 Prohibited Uses

**DO NOT:**
- ❌ Deploy to mainnet
- ❌ Use with real funds
- ❌ Rely for financial decisions
- ❌ Promote as production-ready
- ❌ Claim audited or secure
- ❌ Use for financial advice
- ❌ Guarantee returns
- ❌ Exceed testnet limits

---

## 📞 Incident Response

### If You Encounter a Bug

1. Stop using the system
2. Document the issue
3. Revoke agent permissions
4. Withdraw funds if possible
5. Report to development team

### If Treasury is Empty

1. Easy Pool may not pay demo yield
2. Aave yield still accrues
3. Principal remains safe
4. Wait for treasury refill or withdraw

### If Agent Misbehaves

1. Immediately revoke permissions
2. Manually withdraw your position
3. Document agent actions
4. Report to operator

---

## ✅ Best Practices

### For Users

**Risk Management:**
- Start with Easy Pool
- Test with small amounts
- Use stop-loss on High Risk Pool
- Don't invest more than you can lose

**Permission Management:**
- Grant minimum necessary permissions
- Set short expiration times
- Use amount and usage caps
- Regularly review and revoke

**Monitoring:**
- Check positions daily
- Review agent recommendations
- Monitor P&L and risk metrics
- Act on liquidation warnings

### For Developers

**Security:**
- Audit before mainnet
- Use hardware wallets for owner keys
- Implement multi-sig
- Add timelock for critical functions

**Monitoring:**
- Set up alerts for treasury levels
- Monitor agent operator uptime
- Track on-chain events
- Log all critical actions

**Testing:**
- Comprehensive unit tests
- Integration test end-to-end flows
- Stress test edge cases
- Test permission revocation

---

## 📊 Risk Matrix Summary

| Pool | Principal Risk | Volatility | Suitable For | Required Risk Score |
|------|----------------|------------|--------------|---------------------|
| **Easy** | Very Low | Very Low | Beginners | < 35 |
| **Medium** | Low | Medium | Intermediate | 35-65 |
| **High** | **HIGH (-50%)** | Extreme | Advanced | > 65 |

| Feature | Risk Level | Mitigation |
|---------|------------|------------|
| **Treasury Funding** | Medium | Caps & limits |
| **Agent Permissions** | Low-Medium | Time bounds, revocable |
| **Smart Contracts** | High (unaudited) | Testnet only |
| **Pseudo-Random** | Medium | Production needs VRF |

---

## 📝 Legal Disclaimer

**USE AT YOUR OWN RISK**

This software is provided "AS IS", without warranty of any kind, express or implied. In no event shall the authors or copyright holders be liable for any claim, damages or other liability arising from the use of this software.

**Not Financial Advice:** Nothing in this system constitutes financial, investment, legal, or tax advice.

**No Guarantees:** Returns, if any, are not guaranteed and may be negative.

**Experimental Software:** This is experimental software for demonstration purposes only.

**Testnet Only:** This system is designed for testnet use only and should not be deployed to mainnet without professional security audit.

**No Regulatory Compliance:** This system makes no claims of regulatory compliance.

**User Responsibility:** Users are solely responsible for understanding risks and making informed decisions.

---

## 🔄 Updates to This Document

This security model may be updated as the system evolves. Always refer to the latest version before using the system.

**Last Updated:** [Current Date]
**Version:** 1.0.0
**Status:** Testnet Demo

---

**By using this system, you acknowledge that you have read, understood, and agree to this security model and risk disclosure.**

**⚠️ TESTNET ONLY - NOT FOR PRODUCTION USE ⚠️**
