"# HI.FI 🎯

> Non-custodial treasury pooling with AI guidance and deterministic execution.

## What is HI.FI?

HI.FI solves the "Trust Gap" in AI-driven DeFi by separating **advice** from **execution**. Users receive AI-generated portfolio strategies but maintain complete control—no transaction executes without explicit consent.

## Key Features

- **🔐 Non-Custodial:** You always control your funds
- **🤖 AI Advisory:** Smart portfolio recommendations without custody risk
- **🎯 Personalized Recommendations:** Deterministic risk-based pool matching
- **🔗 Chain-Agnostic:** Deposit any token from any chain via LI.FI integration
- **📊 ERC-4626 Vaults:** Standardized, transparent yield-bearing pools
- **🛡️ Deterministic Execution:** Rule-based smart contracts with zero AI control
- **🚪 Scheduled Exits:** Controlled withdrawal windows to prevent bank runs
- **📈 Risk Profiling:** Intelligent matching based on your goals and risk tolerance

## How It Works

1. **Connect:** Link your wallet and complete a risk profile
2. **Deposit:** Use any token from any chain—automatically converted to pool base asset
3. **Review Plan:** AI proposes a portfolio strategy based on your preferences
4. **Sign & Deploy:** Explicitly approve the plan with your signature
5. **Earn Yield:** Funds automatically deploy to Arc protocol when threshold is met
6. **Exit Anytime:** Request withdrawal during scheduled exit windows

## Project Structure

```
├── contracts/          # Solidity smart contracts (PoolVault, AaveAdapter)
├── hifi/              # Next.js frontend with Circle wallet integration
│   └── lib/
│       └── recommendations/  # Deterministic recommendation engine
├── gateway/           # LI.FI integration for cross-chain deposits
└── relayer/           # Backend services
```

## 🎯 New: Recommendation Engine

HI.FI now includes a **deterministic financial recommendation agent** that matches users to suitable liquidity pools based on their risk profile.

### How It Works
1. **Complete Risk Profile**: Answer questions about age, income, investment goals, and risk tolerance
2. **Get Personalized Recommendations**: Receive top 10 pool recommendations matched to your profile
3. **Understand Each Pool**: Detailed risk breakdowns, warnings, and transparent explanations
4. **Make Informed Decisions**: Review metrics, APY, and considerations before investing

### Key Principles
- ✅ **Deterministic**: Same inputs → same outputs (no black boxes)
- ✅ **Transparent**: Every calculation is explainable
- ✅ **Conservative**: Never recommends pools above your risk tolerance
- ✅ **Non-Custodial**: Recommendations only—you control execution

📖 See [RECOMMENDATION_AGENT_DESIGN.md](RECOMMENDATION_AGENT_DESIGN.md) for complete documentation.

## The Golden Rule

**Advice → Explicit Consent → Deterministic Execution → Observable Accounting → Controlled Exits**

AI can advise. Contracts can execute. But only **you** can authorize." 
