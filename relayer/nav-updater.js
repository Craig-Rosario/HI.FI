import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Periodic NAV Update Service
 * 
 * Monitors Aave balance and updates pool NAV to reflect yield accrual
 * Run this as a cron job or background service
 */

async function updatePoolNAV() {
  console.log('📊 Updating Pool NAV from Aave...\n');
  
  const sepoliaProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const arcProvider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
  
  const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY);
  const sepoliaSigner = relayerWallet.connect(sepoliaProvider);
  const arcSigner = relayerWallet.connect(arcProvider);
  
  const poolAddress = process.env.ARC_POOL_VAULT_3;
  const aaveAdapterAddress = process.env.SEPOLIA_AAVE_ADAPTER;
  
  console.log(`🏦 Pool (Arc): ${poolAddress}`);
  console.log(`💰 AaveAdapter (Sepolia): ${aaveAdapterAddress}\n`);
  
  // Contract ABIs
  const poolABI = [
    'function nav() view returns (uint256)',
    'function state() view returns (uint8)',
    'function updateNAV(uint256 newNAV) external',
  ];
  
  const aaveAdapterABI = [
    'function getBalance() view returns (uint256)',
  ];
  
  const pool = new ethers.Contract(poolAddress, poolABI, arcSigner);
  const aaveAdapter = new ethers.Contract(aaveAdapterAddress, aaveAdapterABI, sepoliaSigner);
  
  // Get current pool NAV
  const [currentNAV, state] = await Promise.all([
    pool.nav(),
    pool.state(),
  ]);
  
  console.log(`Current Pool NAV: ${ethers.formatUnits(currentNAV, 6)} USDC`);
  console.log(`Pool State: ${state === 0n ? 'COLLECTING' : state === 1n ? 'ACTIVE' : 'UNKNOWN'}\n`);
  
  if (state === 0n) {
    console.log('⚠️  Pool is still in COLLECTING state - no NAV update needed');
    return;
  }
  
  // Get Aave balance (aUSDC)
  const aUSDCBalance = await aaveAdapter.getBalance();
  console.log(`Aave aUSDC Balance: ${ethers.formatUnits(aUSDCBalance, 6)}\n`);
  
  // Check if NAV needs updating
  if (aUSDCBalance === currentNAV) {
    console.log('✅ NAV is up to date - no change needed');
    return;
  }
  
  const difference = aUSDCBalance - currentNAV;
  const percentChange = (Number(difference) / Number(currentNAV)) * 100;
  
  console.log(`NAV Change: ${ethers.formatUnits(difference, 6)} USDC (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(4)}%)\n`);
  
  // Update NAV
  console.log('🔄 Updating pool NAV...');
  const tx = await pool.updateNAV(aUSDCBalance);
  await tx.wait();
  
  console.log(`✅ NAV updated! TX: ${tx.hash}\n`);
  console.log(`New NAV: ${ethers.formatUnits(aUSDCBalance, 6)} USDC`);
}

// Run immediately
updatePoolNAV().catch(console.error);

// Then run every 6 hours (21600000 ms)
setInterval(() => {
  console.log('\n' + '═'.repeat(60));
  console.log('🔔 Periodic NAV Update');
  console.log('═'.repeat(60) + '\n');
  updatePoolNAV().catch(console.error);
}, 21600000); // 6 hours

console.log('\n👀 NAV monitoring started - updating every 6 hours...');
