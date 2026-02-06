import hre from "hardhat";
import { ethers } from "ethers";
import "dotenv/config";

/**
 * Deploy script for all V2 pools (EasyPoolV2, MediumPoolV2, HighRiskPool)
 * 
 * Run: npx hardhat run scripts/deploy-v2-pools.js --network baseSepolia
 * 
 * These pools feature:
 * - Treasury-funded yield simulation (for testnet demo)
 * - Auto-deploy when cap is reached
 * - Auto-reset after all withdrawals
 * - Remainder funds go to treasury
 */

async function main() {
  console.log("🚀 Deploying V2 Pool Contracts...\n");

  // Get RPC URL and private key from environment
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set in .env file");
  }
  
  // Create provider and signer
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(privateKey, provider);
  
  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await provider.getBalance(deployer.address)), "ETH\n");

  // Base Sepolia addresses
  const ARC_USDC_ADDRESS = "0x15C7881801F78ECFad935c137eD38B7F8316B5e8"; // arcUSDC on Base Sepolia
  const UNDERLYING_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // USDC on Base Sepolia
  const TREASURY_ADDRESS = "0x6D41680267986408E5e7c175Ee0622cA931859A4"; // Treasury wallet
  
  // Cap: 10 USDC (6 decimals) for testing
  const CAP = ethers.parseUnits("10", 6);

  console.log("📋 Configuration:");
  console.log("  arcUSDC:", ARC_USDC_ADDRESS);
  console.log("  USDC:", UNDERLYING_USDC);
  console.log("  Treasury:", TREASURY_ADDRESS);
  console.log("  Cap:", ethers.formatUnits(CAP, 6), "USDC");
  console.log("");

  const deployedContracts = {};

  // Helper to deploy contract
  async function deployContract(name, args) {
    const artifact = await hre.artifacts.readArtifact(name);
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    // Wait for a few blocks to ensure contract is available
    const receipt = await contract.deploymentTransaction().wait(2);
    console.log("   Confirmed in block:", receipt.blockNumber);
    return contract;
  }
  
  // Helper to safely read contract value
  async function safeRead(contract, method, label) {
    try {
      const value = await contract[method]();
      console.log(`   ${label}:`, value.toString());
      return value;
    } catch (e) {
      console.log(`   ${label}: (unavailable - ${e.message})`);
      return null;
    }
  }

  // ===== DEPLOY EasyPoolV2 =====
  console.log("═".repeat(60));
  console.log("🏦 Deploying EasyPoolV2 (Low Risk - 0.3% per minute)...");
  console.log("═".repeat(60));
  
  const easyPool = await deployContract("EasyPoolV2", [
    ARC_USDC_ADDRESS,
    UNDERLYING_USDC,
    TREASURY_ADDRESS,
    CAP
  ]);
  deployedContracts.easyPoolV2 = await easyPool.getAddress();
  
  console.log("✅ EasyPoolV2 deployed at:", deployedContracts.easyPoolV2);
  await safeRead(easyPool, "state", "State");
  await safeRead(easyPool, "cap", "Cap (raw)");
  await safeRead(easyPool, "treasury", "Treasury");
  await safeRead(easyPool, "YIELD_RATE_BPS_PER_MINUTE", "Yield Rate (bps/min)");
  console.log("");

  // ===== DEPLOY MediumPoolV2 =====
  console.log("═".repeat(60));
  console.log("🏦 Deploying MediumPoolV2 (Medium Risk - -0.2% to +0.5% per minute)...");
  console.log("═".repeat(60));
  
  const mediumPool = await deployContract("MediumPoolV2", [
    ARC_USDC_ADDRESS,
    UNDERLYING_USDC,
    TREASURY_ADDRESS,
    CAP
  ]);
  deployedContracts.mediumPoolV2 = await mediumPool.getAddress();
  
  console.log("✅ MediumPoolV2 deployed at:", deployedContracts.mediumPoolV2);
  await safeRead(mediumPool, "state", "State");
  await safeRead(mediumPool, "cap", "Cap (raw)");
  await safeRead(mediumPool, "treasury", "Treasury");
  await safeRead(mediumPool, "MIN_RATE_BPS_PER_MIN", "Min Rate (bps/min)");
  await safeRead(mediumPool, "MAX_RATE_BPS_PER_MIN", "Max Rate (bps/min)");
  console.log("");

  // ===== DEPLOY HighRiskPool =====
  console.log("═".repeat(60));
  console.log("🏦 Deploying HighRiskPool (High Risk - -0.5% to +1.0% per minute)...");
  console.log("═".repeat(60));
  
  const highRiskPool = await deployContract("HighRiskPool", [
    ARC_USDC_ADDRESS,
    UNDERLYING_USDC,
    TREASURY_ADDRESS,
    CAP
  ]);
  deployedContracts.highRiskPool = await highRiskPool.getAddress();
  
  console.log("✅ HighRiskPool deployed at:", deployedContracts.highRiskPool);
  await safeRead(highRiskPool, "state", "State");
  await safeRead(highRiskPool, "cap", "Cap (raw)");
  await safeRead(highRiskPool, "treasury", "Treasury");
  await safeRead(highRiskPool, "MIN_RATE_BPS_PER_MIN", "Min Rate (bps/min)");
  await safeRead(highRiskPool, "MAX_RATE_BPS_PER_MIN", "Max Rate (bps/min)");
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
