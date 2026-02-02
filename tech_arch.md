# HI.FI Technical Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Smart Contract Layer](#smart-contract-layer)
3. [Authentication & Identity](#authentication--identity)
4. [Circle Wallet Integration](#circle-wallet-integration)
5. [Cross-Chain Deposits](#cross-chain-deposits)
6. [Frontend Architecture](#frontend-architecture)
7. [User Flow](#user-flow)
8. [Security Model](#security-model)

---

## Architecture Overview

HI.FI is built on three core principles:

1. **Separation of Concerns**: AI provides advice, smart contracts execute deterministically, users maintain custody
2. **Chain Abstraction**: Users can deposit from any chain, all converted to USDC
3. **Explicit Consent**: No transaction executes without a user's explicit signature

### Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  - MetaMask Authentication   - Circle Wallet Integration │
│  - Risk Profiling UI         - Portfolio Dashboard       │
└─────────────────────────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
        ┌───────────▼─────┐   ┌──────▼──────────┐
        │   Auth Layer     │   │   LI.FI Gateway │
        │  (MongoDB/JWT)   │   │ (Cross-chain)   │
        └──────────────────┘   └─────────────────┘
                    │
        ┌───────────▼─────────────────────────────┐
        │     Smart Contracts (Polygon Amoy)      │
        │  - PoolVault (ERC-4626 inspired)        │
        │  - AaveAdapter (Yield generation)       │
        └─────────────────────────────────────────┘
```

---

## Smart Contract Layer

### PoolVault Contract

The `PoolVault` is the core treasury management contract that handles deposits, share accounting, and pool lifecycle.

#### Key Features

**State Machine**
```solidity
enum State {
    Collecting,  // Pool accepting deposits
    Active       // Pool deployed to yield protocol
}
```

**Share Accounting**
- Uses ERC-4626 inspired share mechanics
- Shares minted based on: `shares = (amount × totalShares) / nav`
- NAV (Net Asset Value) tracks total pool value including yield

**Threshold Mechanism**
```typescript
// Pool activates when threshold is met
if (nav >= threshold) {
    state = State.Active;
    // Deploy funds to yield protocol
}
```

#### Core Functions

| Function | Purpose | Access |
|----------|---------|--------|
| `deposit(uint256 amount)` | User deposits USDC, receives shares | Public |
| `activatePool()` | Activates pool when threshold met | Public |
| `updateNAV(uint256 newNAV)` | Updates pool value with yield | Relayer Role |
| `balanceOf(address user)` | Returns user's USDC value | View |

**Security Features**
- Role-based access control (OpenZeppelin AccessControl)
- Immutable USDC token reference
- State-gated deposits (only in Collecting phase)
- Relayer-only NAV updates

### AaveAdapter Contract

Adapter contract that integrates with Aave protocol for yield generation.

```solidity
contract AaveAdapter {
    function deposit(uint256 amount) external {
        // 1. Approve Aave Pool
        usdc.approve(address(aavePool), amount);
        
        // 2. Supply USDC to Aave
        aavePool.supply(address(usdc), amount, address(this), 0);
    }
    
    function getBalance() external view returns (uint256) {
        // Returns aUSDC balance (includes accrued yield)
        return aUSDC.balanceOf(address(this));
    }
}
```

**Why Aave?**
- Battle-tested DeFi protocol
- Automatic yield accrual via aTokens
- On-chain proof of balance
- No manual claiming required

---

## Authentication & Identity

### Wallet-Based Authentication

HI.FI uses MetaMask signature-based authentication without requiring passwords.

#### Authentication Flow

```typescript
1. User connects MetaMask wallet
   ↓
2. Frontend requests nonce from /api/auth/nonce
   ↓
3. User signs message: "Sign in to HI.FI with nonce: {nonce}"
   ↓
4. Frontend sends signature to /api/auth/verify
   ↓
5. Backend verifies signature using ecrecover
   ↓
6. User object stored in localStorage + MongoDB
```

#### User Model

```typescript
interface User {
  walletAddress: string;      // Primary identifier
  username: string;            // ENS or display name
  nonce: string;               // Random nonce for signing
  circleWalletId?: string;     // Circle wallet ID
  circleWalletAddress?: string; // Circle wallet address
  isActive: boolean;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}
```

**Security Considerations**
- Nonce rotates after each successful login
- Signature verification uses `ethers.verifyMessage()`
- Wallet addresses stored in lowercase for consistency
- No private keys stored server-side

---

## Circle Wallet Integration

HI.FI integrates Circle's Programmable Wallets (SCA) to provide gasless transactions and enhanced UX.

### Circle Wallet Creation

```typescript
async function getOrCreateCircleWallet(userId: string) {
  // Check if user already has a Circle wallet
  if (user.circleWalletId) {
    return existingWallet;
  }
  
  // Create new SCA wallet on Polygon Amoy
  const response = await circle.createWallets({
    walletSetId: CIRCLE_WALLET_SET_ID,
    accountType: "SCA",        // Smart Contract Account
    blockchains: ["MATIC-AMOY"],
    count: 1,
  });
  
  // Store wallet info in database
  user.circleWalletId = wallet.id;
  user.circleWalletAddress = wallet.address;
  await user.save();
}
```

### Benefits of Circle Wallets

1. **Gasless Transactions**: Circle subsidizes gas fees
2. **Account Abstraction**: Users don't need to hold MATIC for gas
3. **Cross-Chain Ready**: Built-in support for multiple chains
4. **Programmable**: Allows for future automation and limits

### Circle + MetaMask Hybrid Model

```
User's MetaMask Wallet ──→ Authentication & Signature
        │
        └──→ Creates Circle Wallet
                    │
                    └──→ Manages Pool Deposits (gasless)
```

This hybrid approach gives users:
- Control (via MetaMask signatures)
- Convenience (via Circle's gasless transactions)

---

## Cross-Chain Deposits

### LI.FI Integration

LI.FI enables users to deposit any token from any supported chain, automatically converting to USDC.

#### Gateway Architecture

```javascript
// 1. User approves token on source chain
await sourceToken.approve(gatewayWallet, amount);

// 2. Deposit to Gateway
await gatewayWallet.deposit(sourceToken, amount);

// 3. LI.FI routes through bridges/DEXs
// 4. Destination: USDC on Polygon Amoy
```

#### Supported Chains

Based on the gateway setup:
- Ethereum
- Base
- Avalanche
- (Extensible to any LI.FI supported chain)

#### User Experience

```
User has ETH on Base
         ↓
Deposits via HI.FI interface
         ↓
LI.FI automatically:
  1. Swaps ETH → USDC
  2. Bridges to Polygon
  3. Deposits to PoolVault
         ↓
User receives pool shares
```

**Safety Features**
- Atomic swaps (all-or-nothing)
- If swap/bridge fails, funds returned to user
- No custodial intermediate steps

---

## Frontend Architecture

### Next.js Application Structure

```
hifi/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── user/                        # Protected routes
│   │   ├── dashboard/              # User dashboard
│   │   ├── pools/                  # Pool selection
│   │   └── transactions/           # Transaction history
│   └── api/
│       ├── auth/                   # Authentication endpoints
│       └── circle-wallet/          # Circle wallet APIs
├── components/
│   ├── landing/                    # Marketing components
│   ├── navbar/                     # Navigation
│   └── ui/                         # Reusable UI components
├── contexts/
│   └── AuthContext.tsx             # Global auth state
├── hooks/
│   ├── use-metamask.ts             # MetaMask integration
│   └── use-mobile.ts               # Responsive utilities
└── lib/
    ├── auth.ts                     # Auth utilities
    ├── circle-wallets.ts           # Circle integration
    └── mongodb.ts                  # Database connection
```

### State Management

**AuthContext Pattern**
```typescript
const AuthContext = {
  user: User | null,
  isAuthenticated: boolean,
  isLoading: boolean,
  login: (userData: User) => void,
  logout: () => void,
}

// Protected routes check authentication
if (!isAuthenticated) {
  redirect('/');
}
```

### Key UI Components

1. **Landing Page**
   - Hero section with value proposition
   - How it works explanation
   - FAQ section
   - Connect wallet CTA

2. **Dashboard**
   - Portfolio overview
   - Active pools
   - Yield earned
   - Quick actions

3. **Pool Interface**
   - Risk profile selector
   - AI-generated strategy preview
   - Deposit amount input
   - Signature confirmation

---

## User Flow

### Complete User Journey

#### Phase 1: Onboarding

```
1. User visits HI.FI
   ↓
2. Clicks "Connect Wallet"
   ↓
3. MetaMask popup → User signs message
   ↓
4. Account created in MongoDB
   ↓
5. Circle wallet automatically provisioned
   ↓
6. Redirected to dashboard
```

#### Phase 2: Risk Profiling

```
1. User completes questionnaire:
   - Risk tolerance (Conservative/Moderate/Aggressive)
   - Liquidity needs (1 month / 3 months / 6+ months)
   - Investment goals
   ↓
2. AI generates portfolio recommendation
   ↓
3. User reviews "Plan" with:
   - Allocation percentages
   - Expected APY range
   - Lock-up period
   - Exit windows
```

#### Phase 3: Deposit & Deployment

```
1. User selects deposit amount
   ↓
2. Chooses source (MetaMask or another chain via LI.FI)
   ↓
3. If cross-chain:
   - LI.FI quotes best route
   - User approves token
   - Bridge executes atomically
   ↓
4. USDC arrives at PoolVault
   ↓
5. Shares minted to user
   ↓
6. When threshold reached:
   - Anyone can call activatePool()
   - Funds deployed to AaveAdapter
   - Yield starts accruing
```

#### Phase 4: Yield Accrual

```
Relayer bot runs periodically:
  ↓
1. Queries AaveAdapter.getBalance()
  ↓
2. Calculates new NAV (principal + yield)
  ↓
3. Calls PoolVault.updateNAV(newNAV)
  ↓
4. All shares automatically appreciate in value
```

#### Phase 5: Exit (Future Implementation)

```
1. User submits exit intent
   ↓
2. Request queued on-chain
   ↓
3. Next scheduled window opens
   ↓
4. Batch processed:
   - Withdraw proportional USDC from Aave
   - Calculate share value
   - Transfer to user wallet
   ↓
5. Principal + Yield received
```

---

## Security Model

### Principles

1. **Non-Custodial**: Users always control their funds
2. **Signature-Required**: Every action requires explicit user signature
3. **Deterministic Execution**: Smart contracts follow fixed rules
4. **Role Separation**: Clear boundaries between components

### Attack Surface Analysis

#### 1. Smart Contract Layer

**Threats:**
- Reentrancy attacks
- Integer overflow/underflow
- Unauthorized access

**Mitigations:**
- OpenZeppelin battle-tested libraries
- Role-based access control
- State machine pattern (prevents invalid transitions)
- Solidity 0.8+ automatic overflow checks

#### 2. Authentication Layer

**Threats:**
- Signature replay attacks
- Man-in-the-middle

**Mitigations:**
- Rotating nonces (single-use)
- Message includes nonce and domain
- HTTPS only
- No passwords (no password leaks)

#### 3. Circle Wallet Integration

**Threats:**
- API key compromise
- Unauthorized wallet creation

**Mitigations:**
- API keys in environment variables
- Entity secret for signing
- One wallet per user (enforced)
- Rate limiting on creation endpoints

#### 4. Cross-Chain Bridge (LI.FI)

**Threats:**
- Bridge exploits
- Failed transactions

**Mitigations:**
- LI.FI handles security
- Atomic transactions (all-or-nothing)
- Funds return to user on failure
- No intermediate custody

### Trust Assumptions

**What users must trust:**
1. LI.FI bridge infrastructure
2. Aave protocol security
3. Polygon network liveness
4. Circle wallet availability

**What users DON'T need to trust:**
1. HI.FI with custody (non-custodial)
2. AI with execution (read-only advisor)
3. Admins withdrawing funds (impossible)
4. DAO changing strategy without consent

---

## Development Workflow

### Local Setup

1. **Contracts**
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat node          # Local blockchain
npx hardhat run scripts/deploy.ts
```

2. **Frontend**
```bash
cd hifi
npm install
# Configure .env.local:
# - MONGODB_URI
# - CIRCLE_API_KEY
# - CIRCLE_ENTITY_SECRET
# - CIRCLE_WALLET_SET_ID
npm run dev
```

3. **Gateway**
```bash
cd gateway/unified-balance-quickstart
npm install
node setup.js             # Configure chains
node deposit.js           # Test deposits
```

### Testing Flow

The `flow.ts` script demonstrates the complete pool lifecycle:

```typescript
1. Mint test USDC to user
2. Approve PoolVault to spend USDC
3. Deposit USDC → Receive shares
4. Check balances and NAV
5. Activate pool when threshold met
6. Deploy to AaveAdapter
7. Monitor yield accrual
```

Run with:
```bash
npx hardhat run scripts/flow.ts --network localhost
```

---

## Future Enhancements

### Planned Features

1. **Exit Windows**: Scheduled withdrawal batches to prevent bank runs
2. **Multiple Yield Strategies**: Support for different risk profiles
3. **ENS Integration**: Human-readable addresses (alice.eth)
4. **AI Advisory Dashboard**: Real-time portfolio recommendations
5. **Multi-Asset Pools**: Beyond USDC (USDT, DAI, etc.)
6. **Sui Integration**: High-frequency accounting and parallel processing
7. **Mobile App**: React Native application
8. **DAO Governance**: Community parameter control

### Scalability Considerations

**Current Limits:**
- Single pool per deployment
- Manual NAV updates via relayer
- Polygon only for contracts

**Scaling Path:**
- Pool factory for multiple pools
- Automated NAV updates via Chainlink oracles
- Multi-chain deployment (Arbitrum, Optimism)
- Layer 2 aggregation via Sui

---

## Glossary

| Term | Definition |
|------|------------|
| **NAV** | Net Asset Value - total pool value including yield |
| **Shares** | Units representing ownership in a pool |
| **Threshold** | Minimum deposit amount before pool activates |
| **SCA** | Smart Contract Account (Circle's account abstraction) |
| **aUSDC** | Aave's interest-bearing USDC token |
| **Relayer** | Backend service that updates NAV from Aave |
| **LI.FI** | Cross-chain bridge and swap aggregator |

---

## Support & Resources

- **Smart Contracts**: [contracts/](../contracts/)
- **Frontend**: [hifi/](../hifi/)
- **Gateway**: [gateway/unified-balance-quickstart/](../gateway/unified-balance-quickstart/)
- **System Architecture**: See README.md for high-level overview

For questions or contributions, please open an issue on GitHub.
