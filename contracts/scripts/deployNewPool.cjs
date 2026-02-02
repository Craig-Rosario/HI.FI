const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("🚀 Deploying New PoolVault with 10 USDC threshold...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const ARC_USDC = process.env.ARC_USDC || "0x3600000000000000000000000000000000000000";
  const RELAYER_ADDRESS = deployer.address;
  const THRESHOLD = ethers.parseUnits("10", 6); // 10 USDC

  console.log("USDC Address:", ARC_USDC);
  console.log("Relayer Address:", RELAYER_ADDRESS);
  console.log("Threshold: 10 USDC\n");

  const PoolVault = await ethers.getContractFactory("PoolVault");
  const poolVault = await PoolVault.deploy(ARC_USDC, THRESHOLD, RELAYER_ADDRESS);

  await poolVault.waitForDeployment();
  const poolAddress = await poolVault.getAddress();

  console.log("✅ PoolVault deployed to:", poolAddress);
  
  // Verify deployment
  const threshold = await poolVault.threshold();
  const usdc = await poolVault.usdc();
  const state = await poolVault.state();
  
  console.log("\n📊 Pool Configuration:");
  console.log("   Threshold:", ethers.formatUnits(threshold, 6), "USDC");
  console.log("   USDC Address:", usdc);
  console.log("   State:", state === 0n ? "Collecting" : "Active");
  console.log("   Relayer:", RELAYER_ADDRESS);
  
  console.log("\n✅ Deployment Complete!");
  console.log("   Add this to your .env file:");
  console.log(`   ARC_POOL_VAULT_NEW=${poolAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
