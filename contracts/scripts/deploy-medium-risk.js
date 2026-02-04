const hre = require("hardhat");

/**
 * Deploy script for PoolVaultMediumRisk contract
 * 
 * Run: npx hardhat run scripts/deploy-medium-risk.js --network baseSepolia
 * 
 * After deployment:
 * 1. Copy the contract address
 * 2. Run: cd ../hifi && node update-medium-pool-address.js <contract_address>
 */

async function main() {
  console.log("🚀 Deploying PoolVaultMediumRisk...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Base Sepolia addresses
  const ARC_USDC_ADDRESS = "0x0DD76fB7C83A84C57C81A4353B565f34016aBaf8"; // arcUSDC on Base Sepolia
  const UNDERLYING_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // USDC on Base Sepolia
  
  // Cap: 10 USDC (6 decimals) for testing
  const CAP = hre.ethers.parseUnits("10", 6);

  console.log("📋 Configuration:");
  console.log("  arcUSDC:", ARC_USDC_ADDRESS);
  console.log("  USDC:", UNDERLYING_USDC);
  console.log("  Cap:", hre.ethers.formatUnits(CAP, 6), "USDC");
  console.log("");

  // Deploy PoolVaultMediumRisk
  console.log("🏦 Deploying PoolVaultMediumRisk...");
  const PoolVaultMediumRisk = await hre.ethers.getContractFactory("PoolVaultMediumRisk");
  const vault = await PoolVaultMediumRisk.deploy(
    ARC_USDC_ADDRESS,
    UNDERLYING_USDC,
    CAP
  );
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("✅ PoolVaultMediumRisk deployed at:", vaultAddress);

  // Verify contract state
  console.log("\n📊 Contract State:");
  console.log("  State:", await vault.state());
  console.log("  Cap:", hre.ethers.formatUnits(await vault.cap(), 6), "USDC");
  console.log("  Owner:", await vault.owner());
  console.log("  Withdraw Delay:", await vault.WITHDRAW_DELAY(), "seconds");
  console.log("  Base Annual Rate:", await vault.BASE_ANNUAL_RATE_BPS(), "bps (4%)");
  console.log("  Min Annual Rate:", await vault.MIN_ANNUAL_RATE_BPS(), "bps (-2%)");
  console.log("  Max Annual Rate:", await vault.MAX_ANNUAL_RATE_BPS(), "bps (+6%)");

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Contract:     PoolVaultMediumRisk");
  console.log("Address:      " + vaultAddress);
  console.log("Network:      Base Sepolia (84532)");
  console.log("Cap:          10 USDC");
  console.log("Risk Level:   MEDIUM");
  console.log("Adapter:      Simulated (internal)");
  console.log("Yield Range:  -2% to +6% APY");
  console.log("=".repeat(60));
  
  console.log("\n📝 NEXT STEPS:");
  console.log("1. Copy the contract address above");
  console.log("2. Update MongoDB: cd ../hifi && node update-medium-pool-address.js " + vaultAddress);
  console.log("3. Or first add pool: node add-medium-pool.js (if not already added)");
  console.log("");

  return {
    vault: vaultAddress
  };
}

// Execute deployment
main()
  .then((addresses) => {
    console.log("🎉 Deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
