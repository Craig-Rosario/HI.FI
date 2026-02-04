require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Script to add Medium Risk Pool to MongoDB
 * Also updates existing Aave pool with riskLevel and adapterType
 * 
 * Run: node add-medium-pool.js
 * 
 * IMPORTANT: After deploying PoolVaultMediumRisk.sol, update the 
 * MEDIUM_RISK_CONTRACT_ADDRESS below with the actual deployed address
 */

// ===== CONFIGURATION =====
// Replace with actual deployed contract address after deployment
const MEDIUM_RISK_CONTRACT_ADDRESS = '0xd88E2E3d16f4868e8CEbf0c4A8bf0853ae96A8A5'; // Deployed on Base Sepolia

async function addMediumPool() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const poolsCollection = mongoose.connection.db.collection('pools');

    // Step 1: Update existing Aave pool(s) with riskLevel and adapterType
    const updateExisting = await poolsCollection.updateMany(
      { riskLevel: { $exists: false } }, // Only update pools without riskLevel
      { 
        $set: { 
          riskLevel: 'low',
          adapterType: 'aave',
          updatedAt: new Date()
        } 
      }
    );
    console.log(`Updated ${updateExisting.modifiedCount} existing pool(s) with riskLevel and adapterType`);

    // Step 2: Check if Medium Risk pool already exists
    const existingMedium = await poolsCollection.findOne({ riskLevel: 'medium' });
    if (existingMedium) {
      console.log('Medium Risk Pool already exists:', existingMedium.name);
      console.log('Contract address:', existingMedium.contractAddress);
      await mongoose.disconnect();
      return;
    }

    // Step 3: Insert new Medium Risk Pool
    const mediumPool = {
      name: 'Medium Risk Pool',
      description: 'Higher potential yields with bounded downside. Simulated strategy with -2% to +6% annualized returns.',
      state: 'COLLECTING',
      tvl: '0',
      cap: '10', // 10 USDC threshold for testing
      apy: '4', // Base 4% APY with volatility
      waitTime: 60, // 1 minute wait time for testing
      minDeposit: 3, // 3 USDC minimum (same as Aave pool)
      contractAddress: MEDIUM_RISK_CONTRACT_ADDRESS.toLowerCase(),
      chainId: 84532, // Base Sepolia
      riskLevel: 'medium',
      adapterType: 'simulated',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await poolsCollection.insertOne(mediumPool);
    console.log('Created Medium Risk Pool with ID:', result.insertedId);
    console.log('Pool details:', mediumPool);

    console.log('\n⚠️  IMPORTANT: Update the contractAddress after deploying PoolVaultMediumRisk.sol');
    console.log('Run this script again after deployment to update the address, or run:');
    console.log('node update-medium-pool-address.js <contract_address>\n');

    await mongoose.disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addMediumPool();
