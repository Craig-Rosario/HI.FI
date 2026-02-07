require('dotenv').config();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const keepIds = [
    '6982c1d71607d9320a864520', // Base Sepolia Conservative
    '6987833816ca4cf08ced519a', // Easy Pool V2 (correct V2)
    '6987833816ca4cf08ced519b', // Medium Pool V2 (correct V2)
    '6987833816ca4cf08ced519c', // High Risk Pool (correct V2)
  ].map(id => new ObjectId(id));

  const result = await mongoose.connection.db.collection('pools').deleteMany({
    _id: { $nin: keepIds }
  });

  console.log('Deleted:', result.deletedCount, 'stale pool documents');

  const remaining = await mongoose.connection.db.collection('pools').find({}).toArray();
  console.log('\nRemaining pools:');
  remaining.forEach(p => {
    console.log(`  ${p.name} | ${p.riskLevel} | ${p.contractAddress}`);
  });

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
