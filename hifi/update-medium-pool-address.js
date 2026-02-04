require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Script to update Medium Risk Pool contract address after deployment
 * 
 * Run: node update-medium-pool-address.js <contract_address>
 * Example: node update-medium-pool-address.js 0x1234567890abcdef...
 */

async function updateMediumPoolAddress() {
  const contractAddress = process.argv[2];
  
  if (!contractAddress) {
    console.error('Usage: node update-medium-pool-address.js <contract_address>');
    console.error('Example: node update-medium-pool-address.js 0x1234567890abcdef...');
    process.exit(1);
  }

  if (!contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    console.error('Invalid Ethereum address format');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await mongoose.connection.db.collection('pools').updateOne(
      { riskLevel: 'medium' },
      { 
        $set: { 
          contractAddress: contractAddress.toLowerCase(),
          state: 'COLLECTING',
          tvl: '0',
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      console.error('No Medium Risk Pool found. Run add-medium-pool.js first.');
    } else {
      console.log('Updated Medium Risk Pool contract address to:', contractAddress);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateMediumPoolAddress();
