# HIFI Contract Deployment Summary
**Deployment Date:** February 2, 2026

## 🎯 Arc Testnet (Treasury Layer)
**Chain ID:** 5042002  
**RPC:** https://rpc.testnet.arc.network

### PoolVault (Main Treasury)
- **Address:** `0x5BF5868E09D9395968F7C2A989679F4a5b415683`
- **USDC:** `0x3600000000000000000000000000000000000000`
- **Deployer:** `0xC11291d70fE1Efeddeb013544abBeF49B14981B8`
- **Threshold:** 1000 USDC
- **Relayer Role:** `0xC11291d70fE1Efeddeb013544abBeF49B14981B8`
- **Initial State:** Collecting

---

## 🎯 Sepolia Testnet (Execution Layer)
**Chain ID:** 11155111  
**RPC:** https://eth-sepolia.g.alchemy.com/v2/...

### AaveAdapter (Yield Deployment)
- **Address:** `0x67247676e21331f866b820d5C0CD05219c939b89`
- **Deployer:** `0x6D41680267986408E5e7c175Ee0622cA931859A4`
- **Aave Pool:** `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`
- **USDC:** `0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8`
- **aUSDC:** `0x16dA4541aD1807f4443d92D26044C1147406EB80`
- **Etherscan:** https://sepolia.etherscan.io/address/0x67247676e21331f866b820d5C0CD05219c939b89

---

## 📋 Next Steps

### 1. **Build Relayer Service**
The relayer needs to:
- Listen to `DeploymentRequested` events on Arc PoolVault
- Bridge USDC via Circle Gateway (Arc → Sepolia)
- Call `deposit()` on Sepolia AaveAdapter
- Poll aUSDC balance and sync NAV back to Arc

### 2. **Update Frontend**
Create `/hifi/lib/contracts.ts`:
```typescript
export const CONTRACTS = {
  ARC: {
    POOL_VAULT: "0x5BF5868E09D9395968F7C2A989679F4a5b415683",
    USDC: "0x3600000000000000000000000000000000000000",
    RPC: "https://rpc.testnet.arc.network",
    CHAIN_ID: 5042002
  },
  SEPOLIA: {
    AAVE_ADAPTER: "0x67247676e21331f866b820d5C0CD05219c939b89",
    USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    RPC: "https://eth-sepolia.g.alchemy.com/v3/...",
    CHAIN_ID: 11155111
  }
};
```

### 3. **Test Flow**
1. User deposits USDC to PoolVault on Arc
2. Once threshold (1000 USDC) is met, call `activatePool()`
3. Relayer detects event and bridges USDC
4. AaveAdapter receives USDC and deposits to Aave
5. Relayer syncs NAV updates from Sepolia back to Arc

---

## 🔐 Security Notes
- ⚠️ Current deployer also has RELAYER_ROLE (MVP setup)
- ⚠️ For production: Use multi-sig for admin roles
- ⚠️ For production: Separate relayer from deployer
- ✅ Private keys stored in `.env` (git-ignored)

---

## 📊 Architecture
```
┌─────────────────────────────────────┐
│         ARC TESTNET                 │
│  ┌─────────────────────────────┐   │
│  │ PoolVault                   │   │
│  │ 0x5BF586...                 │   │
│  │ • Deposits                  │   │
│  │ • Share accounting          │   │
│  │ • NAV tracking              │   │
│  │ • Event emission            │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
            │
            │ Circle Gateway
            │ (USDC bridge)
            ▼
┌─────────────────────────────────────┐
│       SEPOLIA TESTNET               │
│  ┌─────────────────────────────┐   │
│  │ AaveAdapter                 │   │
│  │ 0x672476...                 │   │
│  │ • Receive USDC              │   │
│  │ • Deploy to Aave            │   │
│  │ • Track aUSDC               │   │
│  └─────────────────────────────┘   │
│            ▼                        │
│  ┌─────────────────────────────┐   │
│  │ Aave V3 Pool                │   │
│  │ (Yield generation)          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```
