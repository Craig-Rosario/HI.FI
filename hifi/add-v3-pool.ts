// Add PoolVaultV3 (Agentic Pool) to MongoDB
// Run: npx tsx add-v3-pool.ts

import mongoose from 'mongoose';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
}

// Pool schema (inline for this script)
const PoolSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    state: { type: String, default: 'COLLECTING' },
    tvl: { type: String, default: '0' },
    cap: { type: String, required: true },
    apy: { type: String, default: '0' },
    waitTime: { type: Number, default: 60 },
    minDeposit: { type: Number, default: 1 },
    contractAddress: { type: String, required: true, lowercase: true },
    chainId: { type: Number, required: true },
    riskLevel: { type: String, default: 'medium' },
    adapterType: { type: String, default: 'other' },
}, { timestamps: true });

const Pool = mongoose.models.Pool || mongoose.model('Pool', PoolSchema);

const newPool = {
    name: '🤖 Agentic V4 Pool',
    description: 'Onchain agent-managed pool with Uniswap v4 yield optimization. Risk policy enforced by StrategyExecutor contract.',
    state: 'COLLECTING',
    tvl: '0',
    cap: '50', // 50 USDC cap for demo
    apy: '0',
    waitTime: 60, // 1 minute for demo
    minDeposit: 1,
    contractAddress: '0x8275a3aa1365E06A70334e208618F4E7158aB141',
    chainId: 84532, // Base Sepolia
    riskLevel: 'medium',
    adapterType: 'other',
};

async function main() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('Connected!\n');

    // Check if pool already exists
    const existing = await Pool.findOne({ contractAddress: newPool.contractAddress.toLowerCase() });
    if (existing) {
        console.log('Pool already exists:', existing._id);
        console.log('Updating pool...');
        Object.assign(existing, newPool);
        await existing.save();
        console.log('✅ Pool updated!');
    } else {
        console.log('Creating new pool...');
        const pool = new Pool(newPool);
        await pool.save();
        console.log('✅ Pool created!');
        console.log('Pool ID:', pool._id);
    }

    console.log('\nPool details:');
    console.log(JSON.stringify(newPool, null, 2));

    await mongoose.disconnect();
    console.log('\nDone!');
}

main().catch(console.error);
