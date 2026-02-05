# Agentic Yield Pools - UI Integration

Complete UI integration for the AI-powered agentic yield system with smart contracts for automated DeFi management.

## 🎨 New UI Components

### 1. **High Risk Pool Card** (`components/pools/high-risk-pool-card.tsx`)
- Real-time pool state monitoring
- Interactive deposit/withdraw interface
- Live P&L tracking with color-coded indicators
- Risk metrics dashboard (volatility, liquidation threshold)
- Withdraw window countdown timer
- Force PnL update button

### 2. **Agent Permissions Manager** (`components/agent/agent-permissions-manager.tsx`)
- Grant/revoke agent permissions
- Configure time limits, amount limits, and usage limits
- Visual permission status dashboard
- Support for 5 permission types:
  - Withdraw
  - Stop Loss
  - Take Profit
  - Rebalance
  - Compound

### 3. **Risk Questionnaire** (`components/agent/risk-questionnaire.tsx`)
- 7-step questionnaire form
- Risk score calculation
- Pool recommendations based on profile

### 4. **Agent Chat** (`components/agent/agent-chat.tsx`)
- AI-powered chat interface
- Quick question shortcuts
- Real-time recommendations
- Market analysis integration

## 🪝 Custom Hooks

### `useHighRiskPool` (`hooks/use-high-risk-pool.ts`)
```typescript
const {
    userShares,      // User's current shares
    poolInfo,        // Pool state, cap, deposits
    riskMetrics,     // PnL, volatility, at-risk status
    loading,
    error,
    deposit,         // Deposit USDC
    withdraw,        // Withdraw shares
    forceUpdatePnL,  // Manual PnL refresh
    refresh,         // Refresh all data
} = useHighRiskPool(account);
```

### `useAgentPermissions` (`hooks/use-agent-permissions.ts`)
```typescript
const {
    permissions,          // Map of active permissions
    loading,
    error,
    grantPermission,      // Grant new permission
    revokePermission,     // Revoke specific permission
    revokeAllPermissions, // Revoke all at once
    refresh,
} = useAgentPermissions(account);
```

## 📄 New Pages

### 1. **Enhanced Pools Page** (`/user/pools`)
- Added High Risk Pool + Agent Permissions section at top
- Traditional pools grid below
- Side-by-side layout for easy comparison

### 2. **Agent Management Page** (`/user/agent`)
- Comprehensive agent dashboard
- Risk assessment flow
- AI chat interface
- Permission management
- Educational resources

### 3. **Admin Panel** (`/user/admin`)
- Treasury funder management
- Deposit USDC to treasury
- View funding statistics
- Yield controller preview
- Contract address reference

## 🚀 Deployment Steps

### 1. Deploy Contracts
```bash
cd contracts
npx hardhat run scripts/deploy-agent-system.js --network baseSepolia
```

This deploys:
- TreasuryFunder
- DemoYieldController
- PoolVaultHighRisk
- AgentPermissionManager

### 2. Update Contract Addresses
Edit `hifi/lib/contracts.ts` with deployed addresses from `deployment-agent-system.json`:

```typescript
export const CONTRACT_ADDRESSES = {
    treasuryFunder: "0x...",           // From deployment output
    demoYieldController: "0x...",      // From deployment output
    poolVaultHighRisk: "0x...",        // From deployment output
    agentPermissionManager: "0x...",   // From deployment output
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    arcUsdc: "0x0DD76fB7C83A84C57C81A4353B565f34016aBaf8",
};
```

### 3. Fund Treasury (Admin Only)
```bash
cd contracts
npx hardhat run scripts/fund-treasury.js --network baseSepolia
```

Or use the Admin Panel UI at `/user/admin`

### 4. Start Frontend
```bash
cd hifi
npm run dev
```

## 🎯 User Flow

### For Regular Users:

1. **Visit Pools Page** (`/user/pools`)
   - See High Risk Pool card at top
   - View real-time pool stats and P&L

2. **Complete Risk Assessment** (`/user/agent`)
   - Answer 7-step questionnaire
   - Get personalized recommendations
   - Chat with AI agent for guidance

3. **Deposit to High Risk Pool**
   - Enter USDC amount
   - Approve + Deposit (1 transaction)
   - Wait for pool to deploy

4. **Grant Agent Permissions**
   - Choose permission type (e.g., Withdraw)
   - Set agent address
   - Configure limits:
     - Duration: 7 days
     - Max amount: 100 USDC
     - Max uses: unlimited

5. **Agent Automation**
   - Agent monitors 24/7
   - Executes optimal withdrawals
   - User receives funds automatically
   - No additional signatures needed

6. **Monitor & Revoke**
   - Track permission usage
   - View agent activity
   - Revoke anytime instantly

### For Admins:

1. **Deploy System** (once)
   - Run deployment script
   - Update frontend config

2. **Fund Treasury** (`/user/admin`)
   - Deposit USDC for yield simulation
   - Monitor funding status

3. **Monitor System**
   - Check treasury balance
   - Preview yield calculations
   - View all contract addresses

## 🔧 Configuration

### Chain Setup
- **Network**: Base Sepolia (chainId: 84532)
- **USDC**: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
- **ArcUSDC**: 0x0DD76fB7C83A84C57C81A4353B565f34016aBaf8

### Environment Variables
No additional env vars needed - contract addresses are in `lib/contracts.ts`

## 🎨 UI Features

### High Risk Pool Card
- **State Indicators**: Collecting, Deployed, Withdraw Window, Closed
- **Fill Percentage**: Visual progress bar
- **P&L Display**: Green for profit, red for loss
- **Risk Metrics**: Volatility index, at-risk status, liquidation threshold
- **Actions**: Deposit (collecting), Withdraw (window open), Update PnL

### Agent Permissions Manager
- **Grant Form**: Dropdown permission types, input fields for limits
- **Active Permissions Table**: Shows all granted permissions with usage stats
- **Quick Revoke**: One-click revocation for any permission
- **Revoke All**: Emergency button to revoke everything

### Responsive Design
- Mobile-friendly grid layouts
- Collapsible sections
- Touch-optimized buttons
- Accessible forms

## ⚠️ Important Notes

1. **Testnet Only**: This system is for demo/testnet use only
2. **Not Audited**: Contracts are experimental and not audited
3. **Simulated Yields**: High risk pool uses pseudo-random volatility
4. **High Volatility**: Can lose up to 50% (liquidation at -50%)
5. **Agent Trust**: Only grant permissions to trusted agent addresses
6. **Permission Limits**: Always set reasonable time and amount limits

## 📊 Contract Interactions

### Deposit Flow:
1. User approves USDC to PoolVaultHighRisk
2. User calls `deposit(amount)`
3. Pool mints shares 1:1 with USDC
4. When cap reached, pool auto-deploys
5. After 1 minute, withdraw window opens

### Agent Execution Flow:
1. User grants withdrawal permission to agent
2. Agent monitors pool state 24/7
3. When conditions optimal, agent calls `executeWithdrawal`
4. AgentPermissionManager verifies permission
5. Funds transferred to user automatically
6. Permission usage count incremented

### Withdrawal Flow:
1. User or agent calls `withdraw(shares)`
2. Contract checks if withdraw window open
3. P&L calculated and applied
4. USDC transferred back to user
5. Shares burned

## 🔗 Navigation

- **Home**: `/` - Landing page
- **Pools**: `/user/pools` - All investment pools
- **Agent**: `/user/agent` - AI agent management
- **Admin**: `/user/admin` - Treasury & yield controller
- **Dashboard**: `/user/dashboard` - User overview
- **Transactions**: `/user/transactions` - Transaction history

## 📚 API Routes

- `POST /api/agent/questionnaire` - Submit risk assessment
- `GET /api/agent/questionnaire?address=0x...` - Get user's assessment
- `POST /api/agent/recommendation` - Get AI recommendations
- `POST /api/agent/permissions` - Store permission preferences

## 🎉 Benefits

### For Users:
- ✅ Reduce signatures from 8→1
- ✅ 24/7 automated monitoring
- ✅ Optimal timing execution
- ✅ Personalized AI guidance
- ✅ Full control and transparency

### For Developers:
- ✅ Modular component architecture
- ✅ Type-safe contract interactions
- ✅ Reusable custom hooks
- ✅ Clean separation of concerns
- ✅ Extensible permission system

## 🛠️ Development

### Adding New Permission Types:
1. Add to `PermissionType` enum in `lib/contracts.ts`
2. Update AgentPermissionManager contract
3. Add handler in agent backend
4. Update UI dropdown options

### Customizing Risk Levels:
Edit `RISK_LEVELS` in `lib/contracts.ts`:
```typescript
export const RISK_LEVELS = {
    EASY: { name: "Easy", apy: "5-8%", risk: "Low", color: "green" },
    MEDIUM: { name: "Medium", apy: "10-15%", risk: "Medium", color: "yellow" },
    HIGH: { name: "High", apy: "-20% to +30%", risk: "High", color: "red" },
};
```

### Testing Locally:
1. Start Hardhat node: `npx hardhat node`
2. Deploy contracts: `npx hardhat run scripts/deploy-agent-system.js --network localhost`
3. Fund treasury: `npx hardhat run scripts/fund-treasury.js --network localhost`
4. Start frontend: `cd hifi && npm run dev`
5. Connect MetaMask to localhost:8545

## 📝 TODO / Future Enhancements

- [ ] Add transaction history for agent executions
- [ ] Real-time notifications for agent actions
- [ ] Multi-pool support in permission manager
- [ ] Advanced analytics dashboard
- [ ] Gas optimization estimates
- [ ] Permission templates/presets
- [ ] Social recovery for permissions

---

**Ready to deploy!** Follow the deployment steps above to get started with the agentic yield system. The UI is fully integrated and ready to interact with your deployed contracts.
