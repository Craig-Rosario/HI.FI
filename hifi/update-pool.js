const mongoose = require('mongoose');

async function updatePool() {
  await mongoose.connect('mongodb+srv://craigr:hifipasscode@hifi.7kbsfr8.mongodb.net/?appName=HIFI');
  
  const result = await mongoose.connection.db.collection('pools').updateMany(
    {},
    { 
      $set: { 
        contractAddress: '0x58ab53e0863bf9F9F0136b0a7c0a76bE955A39b5',
        state: 'COLLECTING',
        updatedAt: new Date()
      } 
    }
  );
  
  console.log('Updated pools:', result.modifiedCount);
  await mongoose.disconnect();
}

updatePool().catch(console.error);
