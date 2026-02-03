import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Deposit USDC to Gateway Wallet on Arc for bridging
 */

async function depositToGateway() {
  console.log('💰 Depositing USDC to Gateway on Arc\n');
  
  const arcProvider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
  const wallet = new ethers.Wallet(process.env.ARC_PRIVATE_KEY, arcProvider);
  
  const gatewayWallet = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';
  const arcUSDC = process.env.ARC_USDC;
  const amount = ethers.parseUnits('10.5', 6); // 10.5 USDC (includes fee buffer)
  
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Gateway: ${gatewayWallet}`);
  console.log(`Amount: ${ethers.formatUnits(amount, 6)} USDC\n`);
  
  const usdcABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
  ];
  
  const gatewayABI = [
    'function deposit(address token, uint256 amount) external',
  ];
  
  const usdc = new ethers.Contract(arcUSDC, usdcABI, wallet);
  const gateway = new ethers.Contract(gatewayWallet, gatewayABI, wallet);
  
  // Check balance
  const balance = await usdc.balanceOf(wallet.address);
  console.log(`Current USDC balance: ${ethers.formatUnits(balance, 6)} USDC`);
  
  if (balance < amount) {
    console.log(`❌ Insufficient balance (need ${ethers.formatUnits(amount, 6)} USDC)`);
    return;
  }
  
  // Check allowance
  const allowance = await usdc.allowance(wallet.address, gatewayWallet);
  if (allowance < amount) {
    console.log('\n📝 Approving Gateway...');
    const approveTx = await usdc.approve(gatewayWallet, amount);
    await approveTx.wait();
    console.log('✅ Approved');
  }
  
  // Deposit
  console.log('\n💸 Depositing to Gateway...');
  const depositTx = await gateway.deposit(arcUSDC, amount);
  await depositTx.wait();
  
  console.log(`✅ Deposited! TX: ${depositTx.hash}`);
  console.log('\n⏳ Wait 1-2 minutes for Circle API to index...');
  console.log('   Then run: npm run deploy-aave\n');
}

depositToGateway().catch(console.error);
