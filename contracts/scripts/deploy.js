import hre from "hardhat";

async function main() {
  console.log("🚀 Deploy started");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  // Deploy MockUSDC first
  console.log("\n📋 Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const usdcAddress = await usdc.getAddress();
  console.log("✅ MockUSDC deployed at:", usdcAddress);

  // Deploy PoolVault
  console.log("\n🏦 Deploying PoolVault...");
  const CAP = hre.ethers.parseUnits("1000000", 6); // 1M USDC cap
  const PoolVault = await hre.ethers.getContractFactory("PoolVault");
  const poolVault = await PoolVault.deploy(usdcAddress, CAP);
  await poolVault.waitForDeployment();

  const poolVaultAddress = await poolVault.getAddress();
  console.log("✅ PoolVault deployed at:", poolVaultAddress);

  // For AaveAdapter, we need mock Aave pool and aToken addresses
  // In a real deployment, these would be actual Aave protocol addresses
  console.log("\n🔄 Deploying AaveAdapter...");
  
  // Mock aave pool address (you'll need to replace with actual Aave pool address)
  const mockAavePool = "0x0000000000000000000000000000000000000001";
  // Mock aToken address (you'll need to replace with actual aUSDC token address)
  const mockAToken = "0x0000000000000000000000000000000000000002";

  const AaveAdapter = await hre.ethers.getContractFactory("AaveAdapter");
  const aaveAdapter = await AaveAdapter.deploy(
    usdcAddress,      // underlying USDC
    mockAToken,       // aUSDC token address
    mockAavePool,     // Aave pool address
    poolVaultAddress  // vault address
  );
  await aaveAdapter.waitForDeployment();

  const aaveAdapterAddress = await aaveAdapter.getAddress();
  console.log("✅ AaveAdapter deployed at:", aaveAdapterAddress);

  // Summary
  console.log("\n📋 DEPLOYMENT SUMMARY:");
  console.log("=====================================");
  console.log("MockUSDC:     ", usdcAddress);
  console.log("PoolVault:    ", poolVaultAddress);
  console.log("AaveAdapter:  ", aaveAdapterAddress);
  console.log("=====================================");
  console.log("✅ All contracts deployed successfully!");

  return {
    usdc: usdcAddress,
    poolVault: poolVaultAddress,
    aaveAdapter: aaveAdapterAddress
  };
}

// Execute deployment
main()
  .then((addresses) => {
    console.log("\n🎉 Deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
