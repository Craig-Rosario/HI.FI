require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Script to update V2 Pool contract addresses in MongoDB
 * 
 * Usage: node scripts/update-v2-pool-addresses.js <easyPoolV2> <mediumPoolV2> <highRiskPool>
 * 
 * Example:
 * node scripts/update-v2-pool-addresses.js 0x123... 0x456... 0x789...
 */

async function updateV2PoolAddresses() {
  const [,, easyArg, mediumArg, highArg] = process.argv;

  if (!easyArg || !mediumArg || !highArg) {
    console.log('Usage: node scripts/update-v2-pool-addresses.js <easyPoolV2> <mediumPoolV2> <highRiskPool>');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/update-v2-pool-addresses.js 0x123... 0x456... 0x789...');
    process.exit(1);
  }

  const addresses = {
    'Easy Pool V2': easyArg.toLowerCase(),
    'Medium Pool V2': mediumArg.toLowerCase(),
    'High Risk Pool': highArg.toLowerCase(),
  };

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const poolsCollection = mongoose.connection.db.collection('pools');

    console.log('\n📋 Updating V2 Pool addresses...\n');

    for (const [poolName, address] of Object.entries(addresses)) {
      const result = await poolsCollection.updateOne(
        { name: poolName },
        { 
          $set: { 
            contractAddress: address,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount > 0) {
        console.log(`✅ Updated ${poolName}: ${address}`);
      } else {
        console.log(`⚠️  ${poolName} not found in database. Run add-v2-pools.js first.`);
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

    // Print env variables for easy copy-paste
    console.log('\n📝 Add these to your .env file:');
    console.log(`NEXT_PUBLIC_EASY_POOL_V2_ADDRESS=${addresses['Easy Pool V2']}`);
    console.log(`NEXT_PUBLIC_MEDIUM_POOL_V2_ADDRESS=${addresses['Medium Pool V2']}`);
    console.log(`NEXT_PUBLIC_HIGH_RISK_POOL_ADDRESS=${addresses['High Risk Pool']}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateV2PoolAddresses();
