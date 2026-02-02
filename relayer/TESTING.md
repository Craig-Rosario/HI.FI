# HIFI Relayer Testing Guide

## Prerequisites

1. **Environment Setup:**
   ```bash
   cd relayer
   npm install
   ```

2. **Configuration:**
   - Ensure `.env` has all required values
   - CIRCLE_API_KEY (for production Gateway integration)
   - RELAYER_PRIVATE_KEY must have:
     - Gas tokens on Arc
     - Gas tokens on Sepolia
     - RELAYER_ROLE on PoolVault

3. **Contract State:**
   - PoolVault must be in "Collecting" state
   - Threshold must be reachable (1000 USDC)

---

## Test Flow

### **1. Start Relayer**

```bash
cd relayer
npm start
```

**Expected output:**
```
🚀 HIFI RELAYER STARTING
=====================================
✅ Relayer address: 0x...
✅ Arc PoolVault: 0x5BF5868E09D9395968F7C2A989679F4a5b415683
✅ Sepolia AaveAdapter: 0x67247676e21331f866b820d5C0CD05219c939b89
✅ Arc network: arc-testnet (Chain ID: 5042002)
✅ Sepolia network: sepolia (Chain ID: 11155111)
💰 Arc balance: 0.123 ARC
💰 Sepolia balance: 0.456 ETH

📊 PoolVault State:
   State: Collecting
   NAV: 0.0 USDC
   Threshold: 1000.0 USDC

✅ RELAYER READY
=====================================
Listening for DeploymentRequested events on Arc...
```

---

### **2. Deposit USDC to Pool**

**Option A: Using existing script**
```bash
cd ../contracts
npx hardhat run scripts/depositToPool.cjs --network arc
```

**Option B: Manual deposit via Hardhat console**
```bash
cd ../contracts
npx hardhat console --network arc
```

```javascript
const poolVault = await ethers.getContractAt("PoolVault", "0x5BF5868E09D9395968F7C2A989679F4a5b415683");
const usdc = await ethers.getContractAt("IERC20", "0x3600000000000000000000000000000000000000");

// Approve
await usdc.approve(poolVault.address, ethers.parseUnits("1000", 6));

// Deposit
await poolVault.deposit(ethers.parseUnits("1000", 6));
```

---

### **3. Activate Pool (Trigger DeploymentRequested)**

Once threshold is met:

```bash
cd ../contracts
npx hardhat console --network arc
```

```javascript
const poolVault = await ethers.getContractAt("PoolVault", "0x5BF5868E09D9395968F7C2A989679F4a5b415683");
await poolVault.activatePool();
```

**Expected relayer output:**
```
🚨 DEPLOYMENT REQUESTED EVENT DETECTED
=====================================
Block: 12345
Amount: 1000.0 USDC
Transaction: 0x...

🌉 BRIDGING USDC
=====================================
Source: Arc (Domain 26)
Destination: Sepolia (Domain 0)
Amount: 1000.0 USDC
Recipient: 0x67247676e21331f866b820d5C0CD05219c939b89

⚠️  Bridge integration: TODO
    For MVP: Manually bridge USDC to AaveAdapter on Sepolia
    Target: 0x67247676e21331f866b820d5C0CD05219c939b89
    Amount: 1000.0 USDC

⏳ Waiting for USDC to arrive on Sepolia...
```

---

### **4. Manual Bridge Step (MVP)**

For MVP demo, manually bridge USDC:

**Option A: Transfer USDC to AaveAdapter**
```bash
# On Sepolia
# Transfer 1000 USDC to 0x67247676e21331f866b820d5C0CD05219c939b89
```

**Option B: Implement full Gateway flow**
(See "Production Bridge Integration" section below)

---

### **5. Verify Aave Deposit**

After bridge completes, relayer should automatically:

```
💰 DEPOSITING TO AAVE
=====================================
Amount: 1000.0 USDC
Current USDC in AaveAdapter: 1000.0 USDC
⏳ Calling AaveAdapter.deposit()...
   Tx hash: 0x...
⏳ Waiting for confirmation...
✅ Deposited to Aave (Block 67890)
   Event: YieldDeployed
```

---

### **6. Verify NAV Sync**

```
📊 NAV SYNC
=====================================
Sepolia aUSDC balance: 1000.0 USDC
Current Arc NAV: 0.0 USDC
⏳ Updating NAV on Arc PoolVault...
   Tx hash: 0x...
⏳ Waiting for confirmation...
✅ NAV updated (Block 12346)
   Old NAV: 0.0 USDC
   New NAV: 1000.0 USDC

✅ DEPLOYMENT FLOW COMPLETED
=====================================
```

---

### **7. Verify Final State**

```bash
cd ../contracts
npx hardhat run scripts/testPoolVault.cjs --network arc
```

**Expected:**
- State: Active
- NAV: 1000+ USDC (may increase due to Aave yield)
- User shares minted correctly

---

## Periodic NAV Sync

Relayer automatically syncs NAV every 10 minutes:

```
📊 NAV SYNC
=====================================
Sepolia aUSDC balance: 1000.234 USDC
Current Arc NAV: 1000.0 USDC
⏳ Updating NAV on Arc PoolVault...
✅ NAV updated (Block 12350)
   Old NAV: 1000.0 USDC
   New NAV: 1000.234 USDC
```

---

## Troubleshooting

### Relayer has no RELAYER_ROLE

**Error:**
```
❌ NAV sync failed: execution reverted
⚠️  Relayer may not have RELAYER_ROLE on PoolVault
```

**Fix:**
```bash
cd ../contracts
npx hardhat console --network arc
```

```javascript
const poolVault = await ethers.getContractAt("PoolVault", "0x5BF5868E09D9395968F7C2A989679F4a5b415683");
const RELAYER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RELAYER_ROLE"));
await poolVault.grantRole(RELAYER_ROLE, "RELAYER_WALLET_ADDRESS");
```

### Insufficient Gas

**Error:**
```
❌ insufficient funds for gas
```

**Fix:**
- Add Arc tokens to relayer wallet (for Arc transactions)
- Add Sepolia ETH to relayer wallet (for Sepolia transactions)

### USDC Not in AaveAdapter

**Error:**
```
⚠️  Insufficient USDC in AaveAdapter
   Required: 1000.0 USDC
   Available: 0.0 USDC
```

**Fix:**
- Complete manual bridge step
- Or implement full Circle Gateway integration

---

## Production Bridge Integration

To implement full Circle Gateway flow, modify `bridgeUSDC()` in `index.js`:

```javascript
import { GatewayClient } from '../gateway/unified-balance-quickstart/gateway-client.js';
import { burnIntent, burnIntentTypedData } from '../gateway/unified-balance-quickstart/typed-data.js';

async function bridgeUSDC(amount) {
  // 1. Create Gateway client
  const gatewayClient = new GatewayClient();
  
  // 2. Construct burn intent
  const intent = burnIntent({
    account: relayerWallet,
    from: {
      domain: CONFIG.arc.domain,
      gatewayWallet: { address: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" },
      usdc: { address: CONFIG.arc.usdc },
    },
    to: {
      domain: CONFIG.sepolia.domain,
      gatewayMinter: { address: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" },
      usdc: { address: CONFIG.sepolia.usdc },
    },
    amount: parseFloat(ethers.formatUnits(amount, 6)),
    recipient: CONFIG.sepolia.aaveAdapter,
  });
  
  // 3. Sign burn intent
  const typedData = burnIntentTypedData(intent);
  const signature = await relayerWallet.signTypedData(
    typedData.domain,
    typedData.types,
    typedData.message
  );
  
  // 4. Request attestation
  const response = await gatewayClient.transfer([
    { burnIntent: typedData.message, signature }
  ]);
  
  if (!response.success) {
    throw new Error(`Gateway error: ${response.message}`);
  }
  
  // 5. Mint on Sepolia
  const gatewayMinter = new ethers.Contract(
    "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
    ["function gatewayMint(bytes attestation, bytes signature)"],
    sepoliaSigner
  );
  
  const mintTx = await gatewayMinter.gatewayMint(
    response.attestation,
    response.signature
  );
  
  await mintTx.wait();
  console.log('✅ USDC minted on Sepolia');
}
```

---

## Shutdown

Press `Ctrl+C` to gracefully stop the relayer:

```
🛑 RELAYER SHUTTING DOWN
=====================================
```
