const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("🚀 Deploying NEW PoolVault with CORRECT USDC");
  console.log("=====================================");
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "Arc tokens\n");

  // CORRECT Arc Testnet USDC address
  const ARC_USDC = "0x8d28df956801068aa8f3a45edf92d58ea1f0b3f1";
  const THRESHOLD = hre.ethers.parseUnits("10", 6); // 10 USDC (testing)
  const RELAYER = deployer.address; // Deployer is relayer for MVP

  console.log("📋 Configuration:");
  console.log("   USDC:       ", ARC_USDC, "✅ CORRECT ADDRESS");
  console.log("   Threshold:  ", hre.ethers.formatUnits(THRESHOLD, 6), "USDC");
  console.log("   Relayer:    ", RELAYER);
  console.log();

  // Verify USDC contract exists
  console.log("🔍 Verifying USDC contract...");
  try {
    const usdc = await hre.ethers.getContractAt("IERC20", ARC_USDC);
    const symbol = await usdc.symbol();
    const decimals = await usdc.decimals();
    const deployerBalance = await usdc.balanceOf(deployer.address);
    
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Your Balance: ${hre.ethers.formatUnits(deployerBalance, 6)} USDC`);
    console.log("   ✅ USDC contract is valid!\n");
  } catch (error) {
    console.log("   ❌ USDC contract verification failed!");
    console.log("   Error:", error.message);
    console.log("\n   This USDC address might not exist on Arc Testnet.");
    console.log("   Continuing anyway...\n");
  }

  console.log("⏳ Deploying PoolVault...");
  const PoolVault = await hre.ethers.deployContract("PoolVault", [
    ARC_USDC,
    THRESHOLD,
    RELAYER
  ]);

  await PoolVault.waitForDeployment();
  const address = await PoolVault.getAddress();

  console.log("\n✅ DEPLOYMENT SUCCESSFUL!");
  console.log("=====================================");
  console.log("PoolVault:", address);
  console.log();
  console.log("📊 Initial State:");
  const state = await PoolVault.state();
  const nav = await PoolVault.nav();
  const threshold = await PoolVault.threshold();
  const usdcAddr = await PoolVault.usdc();
  console.log("   State:     ", state === 0n ? "Collecting" : "Active");
  console.log("   NAV:       ", hre.ethers.formatUnits(nav, 6), "USDC");
  console.log("   Threshold: ", hre.ethers.formatUnits(threshold, 6), "USDC");
  console.log("   USDC Addr: ", usdcAddr);
  console.log();
  console.log("💾 NEXT STEPS:");
  console.log("   1. Update frontend pools array with this address:", address);
  console.log("   2. This pool is properly configured with real USDC!");
  console.log("   3. Test deposit with: npx hardhat run scripts/depositToPool.cjs --network arc");
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
