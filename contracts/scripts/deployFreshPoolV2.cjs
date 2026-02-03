const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying Fresh PoolVault (v2 with withdrawal)");
  console.log("Deployer:", deployer.address);

  const PoolVault = await ethers.getContractFactory("PoolVault");

  const pool = await PoolVault.deploy(
    "0x3600000000000000000000000000000000000000", // ARC USDC
    ethers.parseUnits("10", 6), // 10 USDC threshold
    "0xC11291d70fE1Efeddeb013544abBeF49B14981B8" // Relayer
  );

  await pool.waitForDeployment();
  const address = await pool.getAddress();

  console.log("✅ Fresh PoolVault (v2) deployed to:", address);
  console.log("\n⚠️  Update .env:");
  console.log(`ARC_POOL_VAULT_3=${address}`);
  console.log(`ARC_POOL_VAULT=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
