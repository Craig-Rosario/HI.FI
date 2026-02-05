const hre = require("hardhat");

/**
 * Deploy HI.FI Agentic Execution Layer to Base Sepolia
 */

async function main() {
    console.log("🚀 HI.FI Agentic Layer Deployment Started\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

    // ArcUSDC on Base Sepolia
    const ARC_USDC_ADDRESS = "0x15C7881801F78ECFad935c137eD38B7F8316B5e8";

    // ===== DEPLOY RISK POLICY REGISTRY =====
    console.log("📋 Deploying RiskPolicyRegistry...");
    const RiskPolicyRegistry = await hre.ethers.getContractFactory("RiskPolicyRegistry");
    const registry = await RiskPolicyRegistry.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log("✅ RiskPolicyRegistry:", registryAddress);

    // ===== DEPLOY STRATEGY EXECUTOR (THE AGENT) =====
    console.log("\n🤖 Deploying StrategyExecutor (The Agent)...");
    const StrategyExecutor = await hre.ethers.getContractFactory("StrategyExecutor");
    const executor = await StrategyExecutor.deploy(registryAddress);
    await executor.waitForDeployment();
    const executorAddress = await executor.getAddress();
    console.log("✅ StrategyExecutor:", executorAddress);

    // ===== DEPLOY POOL VAULT V3 =====
    console.log("\n🏦 Deploying PoolVaultV3...");
    const CAP = hre.ethers.parseUnits("50", 6); // 50 USDC for demo
    const PoolVaultV3 = await hre.ethers.getContractFactory("PoolVaultV3");
    const vault = await PoolVaultV3.deploy(ARC_USDC_ADDRESS, CAP, executorAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("✅ PoolVaultV3:", vaultAddress);

    // ===== CONFIGURE =====
    console.log("\n⚙️  Configuring...");

    // Authorize vault on executor
    const authTx = await executor.setVaultAuthorization(vaultAddress, true);
    await authTx.wait();
    console.log("   Vault authorized on executor");

    // Register as pool owner in registry
    const regTx = await registry.registerAsPoolOwner(vaultAddress);
    await regTx.wait();
    console.log("   Registered as pool owner");

    // Set MEDIUM risk policy (30% v4 exposure)
    const policyTx = await registry.setPoolRiskLevel(vaultAddress, 1); // 1 = MEDIUM
    await policyTx.wait();
    console.log("   Set MEDIUM risk policy (30% v4 max)");

    // ===== SUMMARY =====
    console.log("\n");
    console.log("═".repeat(60));
    console.log("                   DEPLOYMENT SUMMARY");
    console.log("═".repeat(60));
    console.log("");
    console.log("  RiskPolicyRegistry:", registryAddress);
    console.log("  StrategyExecutor:  ", executorAddress);
    console.log("  PoolVaultV3:       ", vaultAddress);
    console.log("");
    console.log("  ArcUSDC:           ", ARC_USDC_ADDRESS);
    console.log("  Cap:               ", "50 USDC");
    console.log("  Risk Policy:       ", "MEDIUM (30% max v4 exposure)");
    console.log("");
    console.log("═".repeat(60));
    console.log("  🎉 Agentic Layer deployed successfully!");
    console.log("═".repeat(60));
    console.log("");

    console.log("\n📝 Add these to your .env:");
    console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${registryAddress}`);
    console.log(`NEXT_PUBLIC_EXECUTOR_ADDRESS=${executorAddress}`);
    console.log(`NEXT_PUBLIC_POOL_VAULT_V3_ADDRESS=${vaultAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
