<<<<<<< Updated upstream
"# HI.FI" 
=======
# HI.FI 🎯

> Non-custodial treasury pooling with AI guidance and deterministic execution.

## What is HI.FI?

HI.FI solves the "Trust Gap" in AI-driven DeFi by separating **advice** from **execution**. Users receive AI-generated portfolio strategies but maintain complete control—no transaction executes without explicit consent.

## Key Features

- **🔐 Non-Custodial:** You always control your funds
- **🔗 Chain-Agnostic:** Deposit via **Circle CCTP** (No relayers)
- **📊 V4 Vaults:** Uniswap V4-powered yield strategies
- **🛡️ Deterministic Execution:** Agents are restricted to specific rebalancing logic
- **🚪 Controlled Access:** Hooks enforce constraints

## Project Structure

```bash
├── contracts/          # Smart Contracts (DepositRouter, Vault, UniswapV4Strategy)
├── hifi/               # Next.js Frontend (Wagmi + Viem + Base Sepolia)
├── gateway/            # (Legacy) Cross-chain integration
└── .gemini/            # Architecture Docs (Walkthrough, Plans)
```

## Getting Started

### 1. Contracts (Base Sepolia)
Deploy the core protocol:
```bash
cd contracts
npm install
# Set .env with BASE_SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY
npx hardhat run scripts/deploy.cjs --network baseSepolia
```

### 2. Frontend
Start the UI:
```bash
cd hifi
npm install
# Copy deployed addresses to hifi/app/page.tsx
npm run dev
```

## The Golden Rule

**Advice → Explicit Consent → Deterministic Execution → Observable Accounting → Controlled Exits**

AI can advise. Contracts can execute. But only **you** can authorize.
>>>>>>> Stashed changes
