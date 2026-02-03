# HI.FI Relayer Service

Cross-chain relayer service for HI.FI DeFi platform. Handles user deposits from Sepolia, bridges via Circle CCTP to Arc, and manages pool deployments to Aave.

## Architecture

```
User (Sepolia)
    ↓ Transfer USDC
Relayer Wallet (Sepolia)
    ↓ Circle Gateway CCTP
Relayer Wallet (Arc)
    ↓ depositFor()
PoolVault (Arc)
    ↓ When threshold reached
Aave Protocol (Sepolia)
    ↓ Yield generation
NAV Updates
```

## Features

### 1. **Cross-Chain Deposit API**
- REST API for accepting user deposits
- Automatic bridging from Sepolia to Arc
- Status tracking with real-time updates

### 2. **Pool Monitoring**
- Automatically monitors pool threshold
- Alerts when 100% funded
- Ready for Aave deployment

### 3. **Aave Deployment**
- Withdraw USDC from pool
- Bridge Arc → Sepolia
- Deploy to Aave for yield
- Update pool NAV and activate

### 4. **NAV Updates**
- Periodic NAV updates from Aave
- Tracks yield accrual
- Updates every 6 hours

## Setup

### Prerequisites
- Node.js 18+
- Funded relayer wallet with USDC on both Sepolia and Arc
- Gateway balance for cross-chain transfers

### Installation

```bash
cd relayer
npm install
```

### Configuration

Create `.env` file:

```env
# RPC URLs
ARC_RPC_URL=https://rpc.testnet.arc.network
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Relayer Wallet
RELAYER_PRIVATE_KEY=0x...
ARC_PRIVATE_KEY=0x...  # Admin for pool operations

# Contract Addresses
ARC_POOL_VAULT=0x...
ARC_USDC=0x3600000000000000000000000000000000000000
SEPOLIA_USDC=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
SEPOLIA_AAVE_ADAPTER=0x28FE1dc7b075fe0BA3C7aB826f2218960D328B2E

# Gateway Config
ARC_DOMAIN_ID=26
SEPOLIA_DOMAIN_ID=0
```

## Usage

### 1. Start Relayer Server

```bash
npm run server
```

**Endpoints:**
- `GET /health` - Health check
- `GET /api/relayer/address` - Get relayer address
- `POST /api/deposit/process` - Process user deposit
- `GET /api/deposit/status/:depositId` - Check deposit status

**Features:**
- Automatic pool monitoring (every 30 seconds)
- Detects when threshold reached
- Processes deposits asynchronously

### 2. Deploy Pool to Aave

When pool reaches 100% funding:

```bash
npm run deploy-aave
```

**This script will:**
1. ✅ Check pool status and verify threshold
2. 💸 Withdraw USDC from PoolVault on Arc
3. 🌉 Bridge USDC from Arc → Sepolia via Circle CCTP
4. 🏦 Deposit USDC into Aave V3
5. 📊 Update pool NAV with aUSDC balance
6. ✅ Activate pool (state = ACTIVE)

**Expected Output:**
```
═══════════════════════════════════════════════
📊 Summary:
   • Withdrew: 11.0 USDC from pool
   • Bridged: Arc → Sepolia via Circle CCTP
   • Deposited: 11.0 aUSDC in Aave
   • Pool State: ACTIVE

📈 Pool is now earning ~3-8% APY on Aave!
```

### 3. Start NAV Updater

After Aave deployment, run the NAV updater:

```bash
npm run nav-updater
```

**Features:**
- Checks Aave aUSDC balance
- Compares with pool NAV
- Updates NAV if yield has accrued
- Runs every 6 hours automatically

**Example Output:**
```
📊 Updating Pool NAV from Aave...

Current Pool NAV: 11.0 USDC
Aave aUSDC Balance: 11.001234

NAV Change: 0.001234 USDC (+0.0112%)

✅ NAV updated!
New NAV: 11.001234 USDC
```

## API Usage

### Process User Deposit

**Request:**
```bash
curl -X POST http://localhost:3001/api/deposit/process \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x...",
    "amount": "1000000",
    "poolAddress": "0x...",
    "txHash": "0x..."
  }'
```

**Response:**
```json
{
  "success": true,
  "depositId": "0x...--1234567890",
  "message": "Deposit queued for processing"
}
```

### Check Deposit Status

**Request:**
```bash
curl http://localhost:3001/api/deposit/status/DEPOSIT_ID
```

**Response:**
```json
{
  "id": "0x...--1234567890",
  "userAddress": "0x...",
  "amount": "1000000",
  "status": "completed",
  "bridgeTxHash": "0x...",
  "poolTxHash": "0x...",
  "createdAt": 1234567890,
  "completedAt": 1234567900
}
```

**Status Values:**
- `pending` - Queued for processing
- `verifying` - Verifying Sepolia transaction
- `bridging` - Bridging via Circle CCTP
- `depositing` - Depositing to pool on Arc
- `completed` - Successfully completed
- `failed` - Failed with error

## Deployment Flow

### Phase 1: Collecting (State = 0)
1. Users deposit USDC via relayer
2. Pool accumulates funds on Arc
3. Monitor threshold progress

### Phase 2: Deployment (Threshold Reached)
1. Run `npm run deploy-aave`
2. Funds bridged to Sepolia
3. Deposited into Aave V3
4. Pool activated (State = 1)

### Phase 3: Active (State = 1)
1. Start NAV updater: `npm run nav-updater`
2. Yield accrues on Aave (~3-8% APY)
3. NAV updates every 6 hours
4. Users can withdraw proportional shares

## Monitoring

### Pool Status

Check pool status anytime:
```bash
# In contracts directory
npx hardhat run scripts/checkPools.cjs --network arc
```

### Balances

```javascript
// Check relayer USDC on Sepolia
const balance = await usdcContract.balanceOf(RELAYER_ADDRESS);

// Check Gateway balance
const gatewayClient = new GatewayClient();
const balance = await gatewayClient.balances('USDC', RELAYER_ADDRESS);

// Check Aave aUSDC balance
const aUSDC = await aaveAdapter.getBalance();
```

## Troubleshooting

### Insufficient Gateway Balance

**Error:** `Gateway balance too low`

**Solution:**
```bash
# Deposit USDC to Gateway Wallet
# Use Circle Gateway API or manual transfer
```

### Circle API Indexing Delay

**Issue:** Gateway balance not updating immediately

**Reason:** Circle API has 1-3 minute indexing delay

**Solution:** Wait 2-3 minutes after on-chain confirmation

### Pool Already Deployed

**Error:** `Pool already in ACTIVE state`

**Solution:** Pool can only be deployed once. Check state:
```bash
npx hardhat run scripts/checkPools.cjs --network arc
```

## Production Deployment

### Cloud Hosting

Deploy relayer server to:
- AWS EC2 / ECS
- Google Cloud Run
- Heroku
- Railway

### Environment Variables

Set in production:
- All `.env` variables
- Add monitoring/alerting
- Set up logging service

### Process Management

Use PM2 for process management:

```bash
# Install PM2
npm install -g pm2

# Start relayer server
pm2 start server.js --name hifi-relayer

# Start NAV updater
pm2 start nav-updater.js --name nav-updater

# Monitor
pm2 monit

# View logs
pm2 logs
```

## Security

- ⚠️ Never commit `.env` file
- ⚠️ Rotate private keys regularly
- ⚠️ Use separate wallets for testnet/mainnet
- ⚠️ Monitor wallet balances and set alerts
- ⚠️ Add rate limiting to API endpoints
- ⚠️ Validate all user inputs
- ⚠️ Use HTTPS in production

## Gas Optimization

- Bridge in batches when possible
- Use gas price oracles for optimal timing
- Monitor gas costs per transaction
- Consider L2 solutions for scaling

## Support

For issues or questions:
- Check TESTING.md for detailed test scenarios
- Review Circle Gateway documentation
- Check Aave V3 docs for yield information

## License

MIT
