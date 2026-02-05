# HI.FI 🎯

> **Non-custodial treasury pooling** with onchain agentic execution — bridging the trust gap between AI advice and DeFi execution.

---

## 🔥 The Problem

**DeFi has a trust crisis.**

Today's yield protocols force users to choose between:
1. **Custody risk** — Hand over your keys to earn yield
2. **Complexity** — Manage positions manually across multiple protocols
3. **AI anxiety** — Let an AI control your funds (scary!)

Users want smart portfolio management, but they don't want to give up control. **There's no middle ground.**

### The Trust Gap

```
                    ┌─────────────────────────┐
Current DeFi:       │  AI/Bot has custody     │  ← Users don't trust this
                    │  User has no control    │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
Manual DeFi:        │  User does everything   │  ← Too complex
                    │  No automation          │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
HI.FI:              │  User sets risk ONCE    │  ← Best of both worlds
                    │  Agent executes within  │
                    │  those bounds           │
                    └─────────────────────────┘
```

---

## ✅ The Solution: HI.FI

HI.FI separates **advice** from **execution** with a simple principle:

> **User consents once → Agent executes deterministically → User can exit anytime**

### How It Works

1. **Connect & Deposit** — Deposit any token from any chain (auto-converted to USDC)
2. **Set Risk Preference** — Choose LOW / MEDIUM / HIGH (one-time decision)
3. **Agent Executes** — Onchain StrategyExecutor deploys funds within your risk bounds
4. **Earn Yield** — Funds deployed to Arc protocol + optional Uniswap v4 LP
5. **Exit Anytime** — Withdraw during scheduled windows with full transparency

### The Golden Rule

```
Risk Policy → Explicit Consent → Deterministic Agent → Observable State → Controlled Exit
```

**The agent can execute. But only YOU define the bounds.**

---

## 🏆 Hackathon Tracks

### 1. Arc Protocol — Yield Infrastructure

HI.FI uses **Arc** as the primary yield layer:

- **arcUSDC**: Wrapped USDC that earns yield
- **Pool Deposits**: All deposits flow through Arc's gateway
- **Yield Accrual**: Automatic yield from Arc's underlying strategies

**Why Arc?**
- Battle-tested yield infrastructure
- Clean ERC-4626 integration
- Native support for scheduled withdrawals

---

### 2. Uniswap v4 — Agentic Finance

HI.FI implements a **fully onchain agent** that uses Uniswap v4:

| Component | Purpose |
|-----------|---------|
| `RiskPolicyRegistry` | Stores user risk preferences |
| `StrategyExecutor` | **THE AGENT** — deterministic decision maker |
| `V4LiquidityAdapter` | Interfaces with v4 PoolManager |
| `HiFiHook` | Optional hook for analytics |

**Why This Is Agentic:**
- Agent acts **autonomously** based on policy
- No human intervention after initial setup
- Fully **deterministic** (no AI randomness)
- All logic is **onchain and auditable**

**Risk → Allocation Mapping:**

| Risk Level | v4 Exposure | Description |
|------------|-------------|-------------|
| LOW | 0% | Never touches v4 — vault-only |
| MEDIUM | 30% max | Balanced exposure to USDC/ETH LP |
| HIGH | 70% max | Aggressive but capped |

> "LOW risk pools never touch Uniswap v4. Agent execution is explicitly disabled by policy."

---

### 3. Circle — Cross-Chain Deposits

HI.FI uses **Circle Gateway** for seamless cross-chain deposits:

- **Circle Programmable Wallets (SCA)** — Gasless transactions
- **USDC Bridging** — Ethereum Sepolia → Base Sepolia
- **Gateway Wallet** — Secure deposit & attestation flow
- **No Manual Bridging** — Users deposit on any chain, funds arrive automatically

**Cross-Chain Flow:**
```
Ethereum Sepolia          Circle Gateway          Base Sepolia
     │                         │                       │
     │   1. Deposit USDC       │                       │
     ├────────────────────────►│                       │
     │                         │   2. Sign & Attest    │
     │                         │                       │
     │                         │   3. Mint USDC        │
     │                         ├──────────────────────►│
     │                         │                       │
     │                         │   4. Wrap to arcUSDC  │
     │                         │                       ├─► PoolVault
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER WALLET                             │
│                      (MetaMask / WalletConnect)                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ RiskPolicy    │      │ Circle        │      │ PoolVault     │
│ Registry      │      │ Gateway       │      │ (ERC-4626)    │
│               │      │               │      │               │
│ • setRisk()   │      │ • deposit()   │      │ • deposit()   │
│ • getRisk()   │      │ • bridge()    │      │ • withdraw()  │
└───────────────┘      └───────────────┘      └───────┬───────┘
                                                      │
                                                      ▼
                                              ┌───────────────┐
                                              │ Strategy      │
                                              │ Executor      │
                                              │               │
                                              │ THE AGENT     │
                                              │               │
                                              │ • execute()   │
                                              │ • unwind()    │
                                              └───────┬───────┘
                                                      │
                              ┌────────────────────────┼────────────────────────┐
                              │                        │                        │
                              ▼                        ▼                        ▼
                      ┌───────────────┐        ┌───────────────┐        ┌───────────────┐
                      │ Arc Protocol  │        │ Uniswap v4    │        │ HiFi Hook     │
                      │ (arcUSDC)     │        │ PoolManager   │        │ (Analytics)   │
                      │               │        │               │        │               │
                      │ Primary yield │        │ LP exposure   │        │ Observability │
                      └───────────────┘        └───────────────┘        └───────────────┘
```

---

## 🔐 Security Model

| Principle | Implementation |
|-----------|----------------|
| **Non-Custodial** | Vault always owns funds; user owns shares |
| **No Relayer** | All execution is user or cap-triggered |
| **No Backend Signer** | Contracts don't depend on offchain signatures |
| **No AI/ML** | Purely deterministic policy-based logic |
| **Policy Enforcement** | Risk limits enforced at contract level |
| **Scheduled Exits** | Prevents bank runs with controlled windows |

---

## 📁 Project Structure

```
├── contracts/
│   ├── PoolVault.sol           # Base vault (Arc integration)
│   ├── PoolVaultMediumRisk.sol # Simulated PnL vault
│   ├── PoolVaultV3.sol         # Agent-integrated vault
│   ├── RiskPolicyRegistry.sol  # Risk level storage
│   ├── StrategyExecutor.sol    # THE AGENT
│   ├── V4LiquidityAdapter.sol  # Uniswap v4 interface
│   ├── HiFiHook.sol            # Optional v4 hook
│   ├── ArcUSDC.sol             # Wrapped yield token
│   └── scripts/
│       └── deploy-v4-agentic.js
├── hifi/                        # Next.js frontend
│   ├── app/
│   │   ├── user/dashboard/     # Portfolio view
│   │   ├── user/pools/         # Investment pools
│   │   └── api/                # Backend APIs
│   └── components/
└── gateway/                     # Circle Gateway scripts
```

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/Craig-Rosario/HI.FI.git
cd HI.FI

# Install & compile contracts
cd contracts
npm install
npx hardhat compile

# Run frontend
cd ../hifi
npm install
npm run dev

# Open http://localhost:3000
```

### Deploy Agentic Layer

```bash
cd contracts

# Set environment variables
export PRIVATE_KEY=<your-key>
export V4_POOL_MANAGER=<uniswap-v4-address>

# Deploy to Base Sepolia
npx hardhat run scripts/deploy-v4-agentic.js --network base-sepolia
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.28, Hardhat, OpenZeppelin |
| Frontend | Next.js 15, TypeScript, TailwindCSS |
| Cross-Chain | Circle Gateway, Circle Programmable Wallets |
| Yield | Arc Protocol (arcUSDC) |
| DEX | Uniswap v4 (Base Sepolia) |
| Database | MongoDB (user profiles) |
| Network | Base Sepolia, Ethereum Sepolia |

---

## 👥 Team

Built with ❤️ for ETHGlobal

---

## 📜 License

MIT

---

**HI.FI** — Where users set the rules, and agents follow them.