import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { GatewayClient } from '../gateway/unified-balance-quickstart/gateway-client.js';
import { burnIntent, burnIntentTypedData } from '../gateway/unified-balance-quickstart/typed-data.js';

dotenv.config();

/**
 * Bridge existing Gateway balance and deploy to Aave
 * (Skip pool withdrawal since funds already in Gateway)
 */

async function bridgeAndDeployToAave() {
  console.log('🚀 Bridge & Deploy to Aave\n');
  console.log('═'.repeat(60));
  
  const arcProvider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
  const sepoliaProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.ARC_PRIVATE_KEY);
  const arcSigner = wallet.connect(arcProvider);
  const sepoliaSigner = wallet.connect(sepoliaProvider);
  
  const amount = ethers.parseUnits('10', 6); // 10 USDC
  const aaveAdapterAddress = process.env.SEPOLIA_AAVE_ADAPTER;
  const poolAddress = process.env.ARC_POOL_VAULT_3;
  
  console.log(`👤 Wallet: ${wallet.address}`);
  console.log(`💰 Amount: ${ethers.formatUnits(amount, 6)} USDC\n`);
  console.log('═'.repeat(60) + '\n');
  
  // ========== STEP 1: Bridge Arc → Sepolia ==========
  console.log('🌉 STEP 1: Bridging USDC from Arc → Sepolia\n');
  
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
    account: { address: wallet.address },
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
    amount: Number(ethers.formatUnits(amount, 6)),
    recipient: wallet.address,
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
  await mintTx.wait();
  
  console.log(`✅ Minted on Sepolia! TX: ${mintTx.hash}\n`);
  console.log('═'.repeat(60) + '\n');
  
  // ========== STEP 2: Deploy to Aave ==========
  console.log('🏦 STEP 2: Depositing USDC into Aave on Sepolia\n');
  
  const usdcABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
  ];
  
  const aaveAdapterABI = [
    'function deposit(uint256 amount) external',
    'function getBalance() view returns (uint256)',
  ];
  
  const sepoliaUSDC = new ethers.Contract(process.env.SEPOLIA_USDC, usdcABI, sepoliaSigner);
  const aaveAdapter = new ethers.Contract(aaveAdapterAddress, aaveAdapterABI, sepoliaSigner);
  
  const balance = await sepoliaUSDC.balanceOf(wallet.address);
  console.log(`   Wallet balance on Sepolia: ${ethers.formatUnits(balance, 6)} USDC\n`);
  
  console.log('   Approving AaveAdapter...\n');
  const approveTx = await sepoliaUSDC.approve(aaveAdapterAddress, amount);
  await approveTx.wait();
  console.log('✅ Approved!\n');
  
  console.log(`   Depositing ${ethers.formatUnits(amount, 6)} USDC to Aave...\n`);
  const depositTx = await aaveAdapter.deposit(amount);
  await depositTx.wait();
  console.log(`✅ Deposited! TX: ${depositTx.hash}\n`);
  console.log(`   🔍 https://sepolia.etherscan.io/tx/${depositTx.hash}\n`);
  
  // Check aUSDC balance
  console.log('   Checking aUSDC balance...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const aUSDCBalance = await aaveAdapter.getBalance();
  console.log(`   💎 aUSDC Balance: ${ethers.formatUnits(aUSDCBalance, 6)}\n`);
  console.log('═'.repeat(60) + '\n');
  
  // ========== STEP 3: Activate Pool ==========
  console.log('🔄 STEP 3: Activating Pool on Arc\n');
  
  const poolABI = [
    'function setState(uint8 newState) external',
  ];
  
  const pool = new ethers.Contract(poolAddress, poolABI, arcSigner);
  
  console.log('   Setting pool state to ACTIVE...\n');
  const setStateTx = await pool.setState(1);
  await setStateTx.wait();
  console.log(`✅ Pool activated! TX: ${setStateTx.hash}\n`);
  
  console.log('═'.repeat(60));
  console.log('✅ DEPLOYMENT COMPLETE!\n');
  console.log('📊 Summary:');
  console.log(`   • Bridged: 10.0 USDC Arc → Sepolia`);
  console.log(`   • Deposited: ${ethers.formatUnits(aUSDCBalance, 6)} aUSDC in Aave`);
  console.log(`   • Pool State: ACTIVE`);
  console.log('\n📈 Pool is now earning ~3-8% APY on Aave!');
  console.log('💡 Next: Run nav-updater to track yield\n');
}

bridgeAndDeployToAave().catch(error => {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
});
