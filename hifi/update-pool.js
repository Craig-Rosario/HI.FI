require('dotenv').config();
const mongoose = require('mongoose');

async function updatePool() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const result = await mongoose.connection.db.collection('pools').updateMany(
    {},
    { 
      $set: { 
        contractAddress: '0x83a160f38b240Ae0AE67299DeE3134F77716D050',
        state: 'COLLECTING',
        tvl: '0',
        updatedAt: new Date()
      } 
    }
  );
  
  console.log('Updated pools:', result.modifiedCount);
  await mongoose.disconnect();
}

updatePool().catch(console.error);