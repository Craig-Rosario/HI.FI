const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying AaveAdapter to Sepolia");
  console.log("Deployer:", deployer.address);

  const AaveAdapter = await ethers.getContractFactory("AaveAdapter");

  const adapter = await AaveAdapter.deploy(
    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Gateway-compatible USDC
    "0x16dA4541aD1807f4443d92D26044C1147406EB80", // aUSDC
    "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"  // Aave Pool
  );

  // ✅ ethers v6
  await adapter.waitForDeployment();

  const address = await adapter.getAddress();

  console.log("✅ AaveAdapter deployed to:", address);
  console.log(`🔍 https://sepolia.etherscan.io/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
