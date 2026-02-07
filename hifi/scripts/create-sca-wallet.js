const { CircleDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.log('Usage: node scripts/create-sca-wallet.js <userId>');
    process.exit(1);
  }

  const circle = new CircleDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  });
  
  console.log('Creating SCA wallet on BASE-SEPOLIA...');
  
  const response = await circle.createWallets({
    walletSetId: process.env.CIRCLE_WALLET_SET_ID,
    accountType: 'SCA',
    blockchains: ['BASE-SEPOLIA'],
    count: 1,
  });
  
  const wallet = response.data.wallets[0];
  console.log('New SCA wallet created:');
  console.log('  ID:', wallet.id);
  console.log('  Address:', wallet.address);
  console.log('  Type:', wallet.accountType);
  console.log('  Blockchain:', wallet.blockchain);
  
  // Update user in database
  await mongoose.connect(process.env.MONGODB_URI);
  const User = mongoose.connection.db.collection('users');
  await User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { 
      $set: { 
        circleWalletId: wallet.id,
        circleWalletAddress: wallet.address
      }
    }
  );
  console.log('\nUser updated with new SCA wallet!');
  console.log('\n⚠️  IMPORTANT: You need to fund this wallet with ETH and USDC on Base Sepolia!');
  console.log('   Wallet address:', wallet.address);
  await mongoose.disconnect();
}

main().catch(console.error);
