/**
 * Deploy script for V2 pools only (EasyPoolV2, MediumPoolV2, HighRiskPool)
 * 
 * Run: npx hardhat run scripts/deploy-v2-pools.cjs --network baseSepolia
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying V2 Pool Contracts...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Base Sepolia addresses
  const ARC_USDC_ADDRESS = "0x15C7881801F78ECFad935c137eD38B7F8316B5e8"; // arcUSDC on Base Sepolia
  const UNDERLYING_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // USDC on Base Sepolia
  const TREASURY_ADDRESS = "0x6D41680267986408E5e7c175Ee0622cA931859A4"; // Treasury wallet
  
  // Cap: 10 USDC (6 decimals) for testing
  const CAP = hre.ethers.parseUnits("10", 6);

  console.log("📋 Configuration:");
  console.log("  arcUSDC:", ARC_USDC_ADDRESS);
  console.log("  USDC:", UNDERLYING_USDC);
  console.log("  Treasury:", TREASURY_ADDRESS);
  console.log("  Cap:", hre.ethers.formatUnits(CAP, 6), "USDC");
  console.log("");

  const deployedContracts = {};

  // ===== DEPLOY EasyPoolV2 =====
  console.log("═".repeat(60));
  console.log("🏦 Deploying EasyPoolV2 (Low Risk - 0.3% per minute)...");
  console.log("═".repeat(60));
  
  const EasyPoolV2 = await hre.ethers.getContractFactory("EasyPoolV2");
  const easyPool = await EasyPoolV2.deploy(
    ARC_USDC_ADDRESS,
    UNDERLYING_USDC,
    TREASURY_ADDRESS,
    CAP
  );
  await easyPool.waitForDeployment();
  deployedContracts.easyPoolV2 = await easyPool.getAddress();
  
  console.log("✅ EasyPoolV2 deployed at:", deployedContracts.easyPoolV2);
  console.log("   State:", await easyPool.state());
  console.log("   Cap:", hre.ethers.formatUnits(await easyPool.cap(), 6), "USDC");
  console.log("   Treasury:", await easyPool.treasury());
  console.log("   Yield Rate:", await easyPool.YIELD_RATE_BPS_PER_MINUTE(), "bps per minute (0.3%)");
  console.log("");

  // ===== DEPLOY MediumPoolV2 =====
  console.log("═".repeat(60));
  console.log("🏦 Deploying MediumPoolV2 (Medium Risk - -0.2% to +0.5% per minute)...");
  console.log("═".repeat(60));
  
  const MediumPoolV2 = await hre.ethers.getContractFactory("MediumPoolV2");
  const mediumPool = await MediumPoolV2.deploy(
    ARC_USDC_ADDRESS,
    UNDERLYING_USDC,
    TREASURY_ADDRESS,
    CAP
  );
  await mediumPool.waitForDeployment();
  deployedContracts.mediumPoolV2 = await mediumPool.getAddress();
  
  console.log("✅ MediumPoolV2 deployed at:", deployedContracts.mediumPoolV2);
  console.log("   State:", await mediumPool.state());
  console.log("   Cap:", hre.ethers.formatUnits(await mediumPool.cap(), 6), "USDC");
  console.log("   Treasury:", await mediumPool.treasury());
  console.log("   Min Rate:", await mediumPool.MIN_RATE_BPS_PER_MIN(), "bps per minute (-0.2%)");
  console.log("   Max Rate:", await mediumPool.MAX_RATE_BPS_PER_MIN(), "bps per minute (+0.5%)");
  console.log("   Base Rate:", await mediumPool.BASE_RATE_BPS_PER_MIN(), "bps per minute (+0.4%)");
  console.log("");

  // ===== DEPLOY HighRiskPool =====
  console.log("═".repeat(60));
  console.log("🏦 Deploying HighRiskPool (High Risk - -0.5% to +1.0% per minute)...");
  console.log("═".repeat(60));
  
  const HighRiskPool = await hre.ethers.getContractFactory("HighRiskPool");
  const highRiskPool = await HighRiskPool.deploy(
    ARC_USDC_ADDRESS,
    UNDERLYING_USDC,
    TREASURY_ADDRESS,
    CAP
  );
  await highRiskPool.waitForDeployment();
  deployedContracts.highRiskPool = await highRiskPool.getAddress();
  
  console.log("✅ HighRiskPool deployed at:", deployedContracts.highRiskPool);
  console.log("   State:", await highRiskPool.state());
  console.log("   Cap:", hre.ethers.formatUnits(await highRiskPool.cap(), 6), "USDC");
  console.log("   Treasury:", await highRiskPool.treasury());
  console.log("   Min Rate:", await highRiskPool.MIN_RATE_BPS_PER_MIN(), "bps per minute (-0.5%)");
  console.log("   Max Rate:", await highRiskPool.MAX_RATE_BPS_PER_MIN(), "bps per minute (+1.0%)");
  console.log("   Max Loss:", await highRiskPool.MAX_LOSS_PERCENT(), "%");
  console.log("");

  // ===== DEPLOYMENT SUMMARY =====
  console.log("\n" + "═".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("═".repeat(60));
  console.log("");
  console.log("┌─────────────────┬────────────────────────────────────────────┐");
  console.log("│ Contract        │ Address                                    │");
  console.log("├─────────────────┼────────────────────────────────────────────┤");
  console.log(`│ EasyPoolV2      │ ${deployedContracts.easyPoolV2} │`);
  console.log(`│ MediumPoolV2    │ ${deployedContracts.mediumPoolV2} │`);
  console.log(`│ HighRiskPool    │ ${deployedContracts.highRiskPool} │`);
  console.log("└─────────────────┴────────────────────────────────────────────┘");
  console.log("");
  console.log("Network:      Base Sepolia (84532)");
  console.log("Cap:          10 USDC (each pool)");
  console.log("Treasury:    ", TREASURY_ADDRESS);
  console.log("");
  console.log("═".repeat(60));
  
  console.log("\n📝 NEXT STEPS:");
  console.log("1. Update .env file with the new addresses:");
  console.log(`   NEXT_PUBLIC_EASY_POOL_V2_ADDRESS=${deployedContracts.easyPoolV2}`);
  console.log(`   NEXT_PUBLIC_MEDIUM_POOL_V2_ADDRESS=${deployedContracts.mediumPoolV2}`);
  console.log(`   NEXT_PUBLIC_HIGH_RISK_POOL_ADDRESS=${deployedContracts.highRiskPool}`);
  console.log("");
  console.log("2. Add pools to MongoDB:");
  console.log(`   cd ../hifi && node scripts/add-v2-pools.js ${deployedContracts.easyPoolV2} ${deployedContracts.mediumPoolV2} ${deployedContracts.highRiskPool}`);
  console.log("");
  console.log("3. Ensure treasury has approved each contract to spend USDC:");
  console.log("   - For positive yields, treasury needs to fund the difference");
  console.log("");

  return deployedContracts;
}

// Execute deployment
main()
  .then((contracts) => {
    console.log("\n✅ All V2 pools deployed successfully!");
    console.log(JSON.stringify(contracts, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
