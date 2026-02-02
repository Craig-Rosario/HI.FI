# Recommendation Agent Implementation

This directory contains the complete implementation of the **Deterministic Financial Recommendation Agent** as specified in [RECOMMENDATION_AGENT_DESIGN.md](../../../RECOMMENDATION_AGENT_DESIGN.md).

## 📁 Directory Structure

```
hifi/lib/recommendations/
├── userRiskScoring.ts       # User risk score calculation
├── poolRiskScoring.ts       # Pool risk score calculation
├── matching.ts              # Risk matching and ranking
├── explanation.ts           # Explanation generation
├── engine.ts                # Main recommendation orchestration
├── poolData.ts              # Pool data fetching (mock for now)
└── __tests__/
    └── algorithms.test.ts   # Algorithm validation tests
```

## 🎯 Phase 1 MVP - COMPLETE

All core Phase 1 components have been implemented:

### ✅ Core Algorithms
- **User Risk Scoring**: Deterministic function mapping profile → risk score (0-100)
- **Pool Risk Scoring**: On-chain metrics → pool risk score (0-100)
- **Risk Matching**: Filters pools within user's acceptable risk band
- **Ranking**: Orders pools by capital efficiency, stability, and user goals
- **Explanation Generation**: Transparent reasoning for each recommendation

### ✅ Type Definitions
- Complete TypeScript interfaces in `lib/types/recommendations.ts`
- Type safety across all recommendation logic

### ✅ API Endpoints
- `POST /api/recommendations/generate` - Generate recommendations
- `POST /api/profile/update` - Update user risk profile
- `GET /api/profile/update?userId=X` - Fetch user profile

### ✅ Database Schema
- Extended User model with risk profile fields
- MongoDB schema supports all profile parameters

### ✅ Frontend Components
- `/user/risk-profile` - 5-step risk assessment questionnaire
- `/user/recommendations` - Personalized recommendations display
- Expandable pool details with risk breakdowns

## 🚀 Quick Start

### 1. Test the Algorithms

Run the test suite to validate risk scoring:

```bash
cd hifi
npx tsx lib/recommendations/__tests__/algorithms.test.ts
```

You should see output demonstrating:
- Conservative users match only low-risk pools
- Aggressive users access high-risk pools
- Pool risk scores reflect volatility and liquidity

### 2. Start the Development Server

```bash
cd hifi
npm run dev
```

### 3. Complete Risk Profile

1. Navigate to `http://localhost:3000/user/risk-profile`
2. Complete the 5-step questionnaire
3. Submit to generate recommendations

### 4. View Recommendations

After completing your profile, you'll be redirected to `/user/recommendations` showing:
- Top 10 personalized pool recommendations
- Risk scores and APY metrics
- Detailed explanations for each pool
- Warnings and considerations

## 📊 How It Works

### User Risk Score Calculation

```typescript
// Example: Balanced Professional
{
  riskTolerance: 'balanced',      // Base: 50
  ageRange: '41-55',              // Modifier: 0
  investmentHorizon: '1-year',    // Modifier: +5
  incomeRange: '75k-150k',        // Modifier: 0
  liquidityNeeds: 'medium-term',  // Modifier: 0
  previousDeFiExperience: 'intermediate' // Modifier: +3
}
// Final Score: 50 + 0 + 5 + 0 + 0 + 3 = 58
```

### Pool Risk Score Calculation

```typescript
// Example: WETH/USDC Pool
{
  assetPairRisk: 17.5,        // (30 + 5) / 2
  volatilityRisk: 20.7,       // 45% IV → normalized
  liquidityRisk: 22,          // $15M TVL → good liquidity
  ilRisk: 8                   // 8% historical IL
}
// Composite: 17.5*0.4 + 20.7*0.25 + 22*0.2 + 8*0.15 = 18.4
```

### Matching Logic

```
User Risk Score: 58
Acceptable Band: 53-58 (±5 tolerance)

Matched Pools:
✓ USDC/USDT (Risk: 3)  - Ultra conservative
✓ WETH/USDC (Risk: 18) - Low-medium risk
✓ stETH/ETH (Risk: 12) - Low risk
✗ ALT/ETH (Risk: 85)   - Too risky
```

## 🎨 Key Features

### Deterministic & Transparent
- **No black boxes**: Every calculation is explainable
- **Reproducible**: Same inputs always produce same outputs
- **Auditable**: Public formulas documented in design doc

### Conservative by Design
- Users **never** matched to pools above their risk tolerance
- Built-in safety margins (±5 risk band)
- Comprehensive warnings for edge cases

### User-Centric Explanations
Each recommendation includes:
- **Match Reason**: Why this pool suits your profile
- **Risk Breakdown**: Component-by-component risk analysis
- **Warnings**: Low liquidity, high volatility, etc.
- **Considerations**: Time horizon, IL expectations, gas costs

## 📝 Example Output

```json
{
  "poolName": "USDC/USDT",
  "riskLevel": "ULTRA_LOW",
  "riskScore": 3,
  "userRiskScore": 58,
  "matchReason": "This pool is significantly more conservative than your profile...",
  "riskBreakdown": {
    "assetPairRisk": {
      "score": 2,
      "explanation": "Ultra-low risk: Both assets are stablecoins..."
    },
    "volatilityRisk": {
      "score": 0.5,
      "explanation": "Low volatility: Prices have been stable (0.5% annualized vol)..."
    }
  },
  "metrics": {
    "apy30d": 5.2,
    "tvl": 50000000,
    "feeTier": 1
  }
}
```

## 🔄 Next Steps (Future Phases)

### Phase 2: Enhanced Risk Modeling
- [ ] Real-time on-chain data integration
- [ ] Advanced IL calculation from historical swaps
- [ ] Multi-chain pool support

### Phase 3: Data Pipeline
- [ ] The Graph integration for Uniswap v4 data
- [ ] Redis caching layer
- [ ] Automated data quality checks

### Phase 4: Advanced Features
- [ ] Multi-pool portfolio allocation
- [ ] Backtesting engine
- [ ] Real-time alerts on risk changes
- [ ] Dynamic risk override preferences

## 🧪 Testing

### Unit Tests
```bash
# Run algorithm tests
npx tsx lib/recommendations/__tests__/algorithms.test.ts
```

### Manual Testing
1. **Conservative User**: Risk score ~20
   - Should only see stablecoin pools
   - APY range: 3-8%

2. **Aggressive User**: Risk score ~85
   - Should see volatile altcoin pairs
   - APY range: 20-50%+

3. **Balanced User**: Risk score ~50
   - Should see ETH/stablecoin pairs
   - APY range: 8-15%

## 📚 API Reference

### Generate Recommendations

```typescript
POST /api/recommendations/generate
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "refreshData": false  // optional
}

Response:
{
  "success": true,
  "recommendations": {
    "userId": "507f...",
    "userRiskScore": 58,
    "recommendations": [...],
    "algorithmVersion": "1.0.0"
  }
}
```

### Update Risk Profile

```typescript
POST /api/profile/update
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "riskProfile": {
    "ageRange": "25-40",
    "incomeRange": "75k-150k",
    "investmentHorizon": "1-year",
    "riskTolerance": "balanced",
    "liquidityNeeds": "medium-term",
    "investmentGoals": ["income", "growth"],
    "previousDeFiExperience": "intermediate"
  }
}
```

## 🛡️ Security & Compliance

### No Autonomous Execution
- Agent **never** executes trades automatically
- All transactions require explicit user signatures
- Recommendations are advisory only

### Data Privacy
- Risk profile stored in MongoDB (encrypted at rest)
- No PII on-chain
- Wallet addresses only identifier in smart contracts

### Disclaimers
All recommendations include 7 standard disclaimers:
- Past performance ≠ future results
- Risk of loss disclosure
- Not financial advice
- IL risk warning
- Smart contract risk
- User responsibility
- Verification requirements

## 🤝 Contributing

When adding new features:
1. Update type definitions in `lib/types/recommendations.ts`
2. Add tests in `__tests__/` directory
3. Document algorithm changes in design doc
4. Maintain deterministic behavior (no randomness)

## 📞 Support

For questions or issues:
- Review [RECOMMENDATION_AGENT_DESIGN.md](../../../RECOMMENDATION_AGENT_DESIGN.md)
- Check algorithm test output
- Verify MongoDB schema matches IUser interface

---

**Algorithm Version**: 1.0.0  
**Implementation Status**: Phase 1 MVP Complete ✅  
**Last Updated**: 2026-02-03
