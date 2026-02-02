import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { GatewayClient } from '../gateway/unified-balance-quickstart/gateway-client.js';
import { burnIntent, burnIntentTypedData } from '../gateway/unified-balance-quickstart/typed-data.js';

dotenv.config();

/**
 * Complete Pool to Aave Deployment Flow
 * 
 * Steps:
 * 1. Withdraw USDC from PoolVault on Arc
 * 2. Bridge USDC from Arc → Sepolia using Circle CCTP
 * 3. Deposit USDC into Aave on Sepolia
 * 4. Update pool NAV and activate pool
 */

async function deployPoolToAave() {
  console.log('🚀 Deploying Pool to Aave - Complete Flow\n');
  console.log('═'.repeat(60));
  
  // Setup providers and wallets
  const arcProvider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
  const sepoliaProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const adminWallet = new ethers.Wallet(process.env.ARC_PRIVATE_KEY);
  const arcSigner = adminWallet.connect(arcProvider);
  const sepoliaSigner = adminWallet.connect(sepoliaProvider);
  
  const poolAddress = process.env.ARC_POOL_VAULT_3; // Fresh Pool
  const aaveAdapterAddress = process.env.SEPOLIA_AAVE_ADAPTER;
  
  console.log(`👤 Admin: ${adminWallet.address}`);
  console.log(`🏦 Pool (Arc): ${poolAddress}`);
  console.log(`💰 AaveAdapter (Sepolia): ${aaveAdapterAddress}\n`);
  console.log('═'.repeat(60) + '\n');
  
  // Contract ABIs
  const poolABI = [
    'function nav() view returns (uint256)',
    'function threshold() view returns (uint256)',
    'function state() view returns (uint8)',
    'function withdrawForDeployment(address recipient, uint256 amount) external',
    'function updateNAV(uint256 newNAV) external',
    'function setState(uint8 newState) external',
    'function usdc() view returns (address)',
  ];
  
  const usdcABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
  ];
  
  const aaveAdapterABI = [
    'function deposit(uint256 amount) external',
    'function getBalance() view returns (uint256)',
  ];
  
  const pool = new ethers.Contract(poolAddress, poolABI, arcSigner);
  
  // ========== STEP 1: Check Pool Status ==========
  console.log('📊 STEP 1: Checking Pool Status\n');
  
  const [nav, threshold, state] = await Promise.all([
    pool.nav(),
    pool.threshold(),
    pool.state(),
  ]);
  
  console.log(`   NAV: ${ethers.formatUnits(nav, 6)} USDC`);
  console.log(`   Threshold: ${ethers.formatUnits(threshold, 6)} USDC`);
  console.log(`   Progress: ${(Number(nav) / Number(threshold) * 100).toFixed(1)}%`);
  console.log(`   State: ${state === 0n ? 'COLLECTING' : state === 1n ? 'ACTIVE' : 'UNKNOWN'}\n`);
  
  if (nav < threshold) {
    console.log('❌ Pool has not reached threshold');
    console.log(`   Need ${ethers.formatUnits(threshold - nav, 6)} more USDC\n`);
    return;
  }
  
  if (state === 1n) {
    console.log('⚠️  Pool already in ACTIVE state\n');
  }
  
  console.log('✅ Pool ready for deployment!\n');
  console.log('═'.repeat(60) + '\n');
  
  // ========== STEP 2: Withdraw from Pool ==========
  console.log('💸 STEP 2: Withdrawing USDC from Pool on Arc\n');
  
  const withdrawAmount = nav; // Withdraw full NAV
  console.log(`   Withdrawing ${ethers.formatUnits(withdrawAmount, 6)} USDC to ${adminWallet.address}...\n`);
  
  const withdrawTx = await pool.withdrawForDeployment(adminWallet.address, withdrawAmount);
  await withdrawTx.wait();
  console.log(`✅ Withdrawn! TX: ${withdrawTx.hash}\n`);
  
  // Verify balance
  const arcUSDC = new ethers.Contract(process.env.ARC_USDC, usdcABI, arcSigner);
  const arcBalance = await arcUSDC.balanceOf(adminWallet.address);
  console.log(`   Admin balance on Arc: ${ethers.formatUnits(arcBalance, 6)} USDC\n`);
  console.log('═'.repeat(60) + '\n');
  
  // ========== STEP 3: Bridge Arc → Sepolia ==========
  console.log('🌉 STEP 3: Bridging USDC from Arc → Sepolia\n');
  
  const gatewayClient = new GatewayClient();
  const gatewayInfo = await gatewayClient.info();
  
  const arcDomain = 26;
  const sepoliaDomain = 0;
  
  const arcInfo = gatewayInfo.domains?.find(c => c.domain === arcDomain);
  const sepoliaInfo = gatewayInfo.domains?.find(c => c.domain === sepoliaDomain);
  
  if (!arcInfo || !sepoliaInfo) {
    throw new Error('Failed to get Gateway chain info');
  }
  
  console.log('   Constructing burn intent...\n');
  
  const intent = burnIntent({
    account: { address: adminWallet.address },
    from: {
      domain: arcDomain,
      gatewayWallet: { address: arcInfo.walletContract.address },
      usdc: { address: process.env.ARC_USDC },
    },
    to: {
      domain: sepoliaDomain,
      gatewayMinter: { address: sepoliaInfo.minterContract.address },
      usdc: { address: process.env.SEPOLIA_USDC },
    },
    amount: Number(ethers.formatUnits(withdrawAmount, 6)),
    recipient: adminWallet.address,
  });
  
  const typedData = burnIntentTypedData(intent);
  const { EIP712Domain, ...typesWithoutDomain } = typedData.types;
  
  console.log('   Signing burn intent...\n');
  const signature = await arcSigner.signTypedData(
    typedData.domain,
    typesWithoutDomain,
    typedData.message
  );
  
  console.log('   Requesting Circle attestation...\n');
  const response = await gatewayClient.transfer([
    { burnIntent: typedData.message, signature },
  ]);
  
  if (response.success === false) {
    throw new Error(`Gateway error: ${response.message}`);
  }
  
  console.log('✅ Attestation received!\n');
  
  console.log('   Minting on Sepolia...\n');
  const gatewayMinterAbi = ['function gatewayMint(bytes attestation, bytes signature) external'];
  const gatewayMinter = new ethers.Contract(
    sepoliaInfo.minterContract.address,
    gatewayMinterAbi,
    sepoliaSigner
  );
  
  const mintTx = await gatewayMinter.gatewayMint(response.attestation, response.signature);
  const mintReceipt = await mintTx.wait();
  
  console.log(`✅ Minted on Sepolia! TX: ${mintTx.hash}\n`);
  
  // Verify Sepolia balance
  const sepoliaUSDC = new ethers.Contract(process.env.SEPOLIA_USDC, usdcABI, sepoliaSigner);
  const sepoliaBalance = await sepoliaUSDC.balanceOf(adminWallet.address);
  console.log(`   Admin balance on Sepolia: ${ethers.formatUnits(sepoliaBalance, 6)} USDC\n`);
  console.log('═'.repeat(60) + '\n');
  
  // ========== STEP 4: Deploy to Aave ==========
  console.log('🏦 STEP 4: Depositing USDC into Aave on Sepolia\n');
  
  const aaveAdapter = new ethers.Contract(aaveAdapterAddress, aaveAdapterABI, sepoliaSigner);
  
  console.log('   Approving AaveAdapter...\n');
  const approveTx = await sepoliaUSDC.approve(aaveAdapterAddress, withdrawAmount);
  await approveTx.wait();
  console.log('✅ Approved!\n');
  
  console.log(`   Depositing ${ethers.formatUnits(withdrawAmount, 6)} USDC to Aave...\n`);
  const depositTx = await aaveAdapter.deposit(withdrawAmount);
  const depositReceipt = await depositTx.wait();
  console.log(`✅ Deposited! TX: ${depositTx.hash}\n`);
  console.log(`   🔍 https://sepolia.etherscan.io/tx/${depositTx.hash}\n`);
  
  // Check aUSDC balance
  console.log('   Checking aUSDC balance...\n');
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for Aave
  
  const aUSDCBalance = await aaveAdapter.getBalance();
  console.log(`   💎 aUSDC Balance: ${ethers.formatUnits(aUSDCBalance, 6)}\n`);
  console.log('═'.repeat(60) + '\n');
  
  // ========== STEP 5: Update Pool State ==========
  console.log('🔄 STEP 5: Updating Pool State on Arc\n');
  
  console.log('   Activating pool (state = ACTIVE)...\n');
  const setStateTx = await pool.setState(1); // State.Active
  await setStateTx.wait();
  console.log(`✅ Pool activated! TX: ${setStateTx.hash}\n`);
  
  console.log('═'.repeat(60));
  console.log('✅ DEPLOYMENT COMPLETE!\n');
  console.log('📊 Summary:');
  console.log(`   • Withdrew: ${ethers.formatUnits(withdrawAmount, 6)} USDC from pool`);
  console.log(`   • Bridged: Arc → Sepolia via Circle CCTP`);
  console.log(`   • Deposited: ${ethers.formatUnits(aUSDCBalance, 6)} aUSDC in Aave`);
  console.log(`   • Pool State: ACTIVE`);
  console.log('\n📈 Pool is now earning ~3-8% APY on Aave!');
  console.log('💡 Next: Set up periodic NAV updates to track yield\n');
}

deployPoolToAave().catch(error => {
  console.error('\n❌ Deployment failed:', error.message);
  console.error(error);
  process.exit(1);
});
