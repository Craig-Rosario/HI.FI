// Add new 15 USDC pool to MongoDB
import mongoose from 'mongoose';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) process.exit(1);

const PoolSchema = new mongoose.Schema({
    name: String,
    description: String,
    state: { type: String, default: 'COLLECTING' },
    tvl: { type: String, default: '0' },
    cap: String,
    apy: { type: String, default: '0' },
    waitTime: { type: Number, default: 60 },
    minDeposit: { type: Number, default: 1 },
    contractAddress: { type: String, lowercase: true },
    chainId: Number,
    riskLevel: { type: String, default: 'medium' },
    adapterType: { type: String, default: 'other' },
}, { timestamps: true });

const Pool = mongoose.models.Pool || mongoose.model('Pool', PoolSchema);

async function main() {
    await mongoose.connect(MONGODB_URI as string);
    console.log('Connected to MongoDB');

    const pool = new Pool({
        name: '🤖 Agent Pool (15 USDC)',
        description: 'Fresh agentic pool - deposit 15 USDC to trigger the StrategyExecutor agent!',
        state: 'COLLECTING',
        tvl: '0',
        cap: '15',
        apy: '0',
        waitTime: 60,
        minDeposit: 1,
        contractAddress: '0xb2e6fDB008804060bCb9AbA15Bd875b4E6ECe131',
        chainId: 84532,
        riskLevel: 'medium',
        adapterType: 'other',
    });

    await pool.save();
    console.log('✅ New pool created:', pool._id);
    console.log('Contract:', pool.contractAddress);
    console.log('Cap:', pool.cap, 'USDC');

    await mongoose.disconnect();
}

main().catch(console.error);
