require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Script to add V2 Pool contracts to MongoDB
 * 
 * Run: node scripts/add-v2-pools.js
 * 
 * These are the new treasury-funded pools:
 * - EasyPoolV2: Low risk, 0.3% per minute guaranteed yield
 * - MediumPoolV2: Medium risk, -0.2% to +0.5% per minute variable yield
 * - HighRiskPool: High risk, -0.5% to +1.0% per minute high volatility
 * 
 * IMPORTANT: Update the contract addresses below after deploying!
 * Run: cd ../contracts && npx hardhat run scripts/deploy-v2-pools.js --network baseSepolia
 */

// ===== CONFIGURATION =====
// Replace with actual deployed contract addresses after deployment
const EASY_POOL_V2_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Update after deployment
const MEDIUM_POOL_V2_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Update after deployment
const HIGH_RISK_POOL_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Update after deployment

// You can also pass addresses as command line arguments:
// node scripts/add-v2-pools.js <easyPoolV2> <mediumPoolV2> <highRiskPool>

async function addV2Pools() {
  try {
    // Get addresses from command line if provided
    const [,, easyArg, mediumArg, highArg] = process.argv;
    const easyPoolV2Address = (easyArg || EASY_POOL_V2_ADDRESS).toLowerCase();
    const mediumPoolV2Address = (mediumArg || MEDIUM_POOL_V2_ADDRESS).toLowerCase();
    const highRiskPoolAddress = (highArg || HIGH_RISK_POOL_ADDRESS).toLowerCase();

    // Validate addresses
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    if (easyPoolV2Address === zeroAddress || mediumPoolV2Address === zeroAddress || highRiskPoolAddress === zeroAddress) {
      console.log('⚠️  WARNING: Some contract addresses are still zero addresses!');
      console.log('Please deploy the contracts first and update the addresses.');
      console.log('');
      console.log('Deploy: cd ../contracts && npx hardhat run scripts/deploy-v2-pools.js --network baseSepolia');
      console.log('Then run: node scripts/add-v2-pools.js <easyPoolV2> <mediumPoolV2> <highRiskPool>');
      console.log('');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const poolsCollection = mongoose.connection.db.collection('pools');

    // Define V2 pools
    const v2Pools = [
      {
        name: 'Easy Pool V2',
        description: 'Low risk treasury-funded yield. Guaranteed 0.3% per minute return with no downside risk. Perfect for conservative investors in demo environment.',
        state: 'COLLECTING',
        tvl: '0',
        cap: '10', // 10 USDC threshold for testing
        apy: '0.3', // 0.3% per minute (displayed for info)
        waitTime: 60, // 1 minute wait time
        minDeposit: 0.1, // 0.1 USDC minimum
        contractAddress: easyPoolV2Address,
        chainId: 84532, // Base Sepolia
        riskLevel: 'low',
        adapterType: 'simulated', // Treasury-funded simulation
      },
      {
        name: 'Medium Pool V2',
        description: 'Variable yield with moderate risk. Returns range from -0.2% to +0.5% per minute based on simulated market conditions. Some risk of loss.',
        state: 'COLLECTING',
        tvl: '0',
        cap: '10',
        apy: '0.4', // Base rate 0.4% per minute
        waitTime: 60,
        minDeposit: 0.1,
        contractAddress: mediumPoolV2Address,
        chainId: 84532,
        riskLevel: 'medium',
        adapterType: 'simulated',
      },
      {
        name: 'High Risk Pool',
        description: 'High volatility trading simulation. Returns range from -0.5% to +1.0% per minute with market sentiment momentum. Significant risk of loss up to 50%.',
        state: 'COLLECTING',
        tvl: '0',
        cap: '10',
        apy: '0.25', // Base rate 0.25% per minute
        waitTime: 60,
        minDeposit: 0.1,
        contractAddress: highRiskPoolAddress,
        chainId: 84532,
        riskLevel: 'high',
        adapterType: 'simulated',
      },
    ];

    console.log('\n📋 Adding V2 Pools to MongoDB...\n');

    for (const pool of v2Pools) {
      // Check if pool already exists
      const existing = await poolsCollection.findOne({ 
        contractAddress: pool.contractAddress,
        chainId: pool.chainId
      });

      if (existing && pool.contractAddress !== zeroAddress) {
        console.log(`⏭️  ${pool.name} already exists, updating...`);
        await poolsCollection.updateOne(
          { _id: existing._id },
          { 
            $set: {
              ...pool,
              updatedAt: new Date()
            }
          }
        );
        console.log(`   Updated: ${pool.name}`);
      } else if (pool.contractAddress !== zeroAddress) {
        // Insert new pool
        const result = await poolsCollection.insertOne({
          ...pool,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ Created ${pool.name}`);
        console.log(`   ID: ${result.insertedId}`);
        console.log(`   Contract: ${pool.contractAddress}`);
        console.log(`   Risk: ${pool.riskLevel}`);
        console.log('');
      } else {
        console.log(`⏭️  Skipping ${pool.name} (zero address)`);
      }
    }

    // List all pools
    console.log('\n📊 All pools in database:');
    const allPools = await poolsCollection.find({}).toArray();
    for (const pool of allPools) {
      console.log(`  - ${pool.name} (${pool.riskLevel}) @ ${pool.contractAddress}`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addV2Pools();
