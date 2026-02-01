const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("🚀 Deploying PoolVault to Arc Testnet");
  console.log("=====================================");
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "Arc tokens\n");

  // Arc Testnet configuration
  const ARC_USDC = process.env.ARC_USDC || "0x3600000000000000000000000000000000000000";
  const THRESHOLD = hre.ethers.parseUnits("1000", 6); // 1000 USDC
  const RELAYER = deployer.address; // Deployer is relayer for MVP

  console.log("📋 Configuration:");
  console.log("   USDC:       ", ARC_USDC);
  console.log("   Threshold:  ", hre.ethers.formatUnits(THRESHOLD, 6), "USDC");
  console.log("   Relayer:    ", RELAYER);
  console.log();

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
  console.log("   State:     ", state === 0n ? "Collecting" : "Active");
  console.log("   NAV:       ", hre.ethers.formatUnits(nav, 6), "USDC");
  console.log("   Threshold: ", hre.ethers.formatUnits(threshold, 6), "USDC");
  console.log();
  console.log("💾 SAVE THIS ADDRESS:");
  console.log("   - Update .env: ARC_POOL_VAULT=" + address);
  console.log("   - Update frontend contracts.ts");
  console.log("   - Update relayer config");
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
