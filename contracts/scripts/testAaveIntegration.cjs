const { ethers } = require("hardhat");

/**
 * Test Aave deposit with existing Sepolia USDC (not Gateway USDC)
 */

async function testAaveWithExistingUSDC() {
  console.log('🧪 Testing Aave Integration\n');
  
  const sepoliaProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.ARC_PRIVATE_KEY, sepoliaProvider);
  
  // Use standard Sepolia USDC (not Gateway)
  const sepoliaUSDC = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
  const amount = ethers.parseUnits('5', 6); // Test with 5 USDC
  
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Testing with: ${ethers.formatUnits(amount, 6)} USDC\n`);
  
  const usdcABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
  ];
  
  const aaveAdapterABI = [
    'function deposit(uint256 amount) external',
    'function getBalance() view returns (uint256)',
  ];
  
  const usdc = new ethers.Contract(sepoliaUSDC, usdcABI, wallet);
  
  // Deploy new AaveAdapter with correct USDC
  console.log('📝 Deploying AaveAdapter with Aave-compatible USDC...\n');
  
  const AaveAdapter = await ethers.getContractFactory("AaveAdapter", wallet);
  const adapter = await AaveAdapter.deploy(
    sepoliaUSDC,
    "0x16dA4541aD1807f4443d92D26044C1147406EB80", // aUSDC
    "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"  // Aave Pool
  );
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  
  console.log(`✅ AaveAdapter deployed: ${adapterAddress}\n`);
  
  const balance = await usdc.balanceOf(wallet.address);
  console.log(`USDC Balance: ${ethers.formatUnits(balance, 6)}\n`);
  
  if (balance < amount) {
    console.log('❌ Insufficient USDC for test\n');
    return;
  }
  
  console.log('📝 Approving Aave Adapter...\n');
  const approveTx = await usdc.approve(adapterAddress, amount);
  await approveTx.wait();
  console.log('✅ Approved\n');
  
  console.log(`💸 Depositing ${ethers.formatUnits(amount, 6)} USDC to Aave...\n`);
  const depositTx = await adapter.deposit(amount);
  await depositTx.wait();
  console.log(`✅ Deposited! TX: ${depositTx.hash}\n`);
  console.log(`🔍 https://sepolia.etherscan.io/tx/${depositTx.hash}\n`);
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const aUSDCBalance = await adapter.getBalance();
  console.log(`💎 aUSDC Balance: ${ethers.formatUnits(aUSDCBalance, 6)}\n`);
  
  console.log('✅ AAVE INTEGRATION WORKING!\n');
  console.log(`Save this adapter address: ${adapterAddress}\n`);
}

testAaveWithExistingUSDC().catch(console.error);
