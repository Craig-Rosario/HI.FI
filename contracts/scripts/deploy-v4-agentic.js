import hre from "hardhat";

<<<<<<< Updated upstream
/**
 * Deploy HI.FI Agentic Execution Layer
 * 
 * Deploys:
 * 1. RiskPolicyRegistry
 * 2. StrategyExecutor
 * 3. V4LiquidityAdapter (with Uniswap v4 PoolManager)
 * 4. PoolVaultV3 (with executor integration)
 * 5. HiFiHook (optional analytics)
 * 
 * Network: Base Sepolia
 */

=======
>>>>>>> Stashed changes
async function main() {
    console.log("🚀 HI.FI Agentic Layer Deployment Started\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

<<<<<<< Updated upstream
    // ===== ADDRESSES =====
    // Base Sepolia addresses
    const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const WETH_BASE_SEPOLIA = "0x4200000000000000000000000000000000000006";
    const ARC_USDC_ADDRESS = process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS || "0x15C7881801F78ECFad935c137eD38B7F8316B5e8";

    // Uniswap v4 PoolManager on Base Sepolia
    // Note: Check https://docs.uniswap.org/contracts/v4/deployments for latest
    const V4_POOL_MANAGER = process.env.V4_POOL_MANAGER || "0x0000000000000000000000000000000000000000";
=======
    // ArcUSDC on Base Sepolia
    const ARC_USDC_ADDRESS = "0x15C7881801F78ECFad935c137eD38B7F8316B5e8";
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
    // ===== DEPLOY V4 LIQUIDITY ADAPTER =====
    console.log("\n🔗 Deploying V4LiquidityAdapter...");

    let adapterAddress;
    if (V4_POOL_MANAGER !== "0x0000000000000000000000000000000000000000") {
        const V4LiquidityAdapter = await hre.ethers.getContractFactory("V4LiquidityAdapter");
        const adapter = await V4LiquidityAdapter.deploy(V4_POOL_MANAGER);
        await adapter.waitForDeployment();
        adapterAddress = await adapter.getAddress();
        console.log("✅ V4LiquidityAdapter:", adapterAddress);

        // Configure pool key (USDC/ETH)
        // Sort tokens: currency0 < currency1
        const [currency0, currency1] = USDC_BASE_SEPOLIA.toLowerCase() < WETH_BASE_SEPOLIA.toLowerCase()
            ? [USDC_BASE_SEPOLIA, WETH_BASE_SEPOLIA]
            : [WETH_BASE_SEPOLIA, USDC_BASE_SEPOLIA];

        console.log("   Setting pool key: USDC/ETH");
        await adapter.setPoolKey(
            currency0,
            currency1,
            3000,      // 0.3% fee tier
            60,        // tick spacing
            "0x0000000000000000000000000000000000000000" // no hook for LP operations
        );

        // Authorize executor
        await adapter.setExecutorAuthorization(executorAddress, true);
        console.log("   Executor authorized on adapter");

        // Set adapter on executor
        await executor.setV4Adapter(adapterAddress);
        console.log("   Adapter set on executor");
    } else {
        console.log("⚠️  V4_POOL_MANAGER not set, skipping V4LiquidityAdapter");
        adapterAddress = "Not deployed";
    }

    // ===== DEPLOY POOL VAULT V3 =====
    console.log("\n🏦 Deploying PoolVaultV3...");
    const CAP = hre.ethers.parseUnits("100", 6); // 100 USDC for demo
=======
    // ===== DEPLOY POOL VAULT V3 =====
    console.log("\n🏦 Deploying PoolVaultV3...");
    const CAP = hre.ethers.parseUnits("15", 6); // 15 USDC for demo
>>>>>>> Stashed changes
    const PoolVaultV3 = await hre.ethers.getContractFactory("PoolVaultV3");
    const vault = await PoolVaultV3.deploy(ARC_USDC_ADDRESS, CAP, executorAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("✅ PoolVaultV3:", vaultAddress);

<<<<<<< Updated upstream
    // Authorize vault on executor
    await executor.setVaultAuthorization(vaultAddress, true);
    console.log("   Vault authorized on executor");

    // Register as pool owner in registry
    await registry.registerAsPoolOwner(vaultAddress);
    console.log("   Registered as pool owner");

    // Set MEDIUM risk policy (30% v4 exposure)
    await registry.setPoolRiskLevel(vaultAddress, 1); // 1 = MEDIUM
    console.log("   Set MEDIUM risk policy (30% v4 max)");

    // ===== DEPLOY HOOK (OPTIONAL) =====
    console.log("\n📊 Deploying HiFiHook (Analytics)...");

    let hookAddress;
    if (V4_POOL_MANAGER !== "0x0000000000000000000000000000000000000000") {
        const HiFiHook = await hre.ethers.getContractFactory("HiFiHook");
        const hook = await HiFiHook.deploy(V4_POOL_MANAGER);
        await hook.waitForDeployment();
        hookAddress = await hook.getAddress();
        console.log("✅ HiFiHook:", hookAddress);

        // Set adapter on hook
        await hook.setV4Adapter(adapterAddress);
        console.log("   V4Adapter set on hook");
    } else {
        console.log("⚠️  Skipping HiFiHook (no PoolManager)");
        hookAddress = "Not deployed";
    }

    // ===== SUMMARY =====
    console.log("\n");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                   DEPLOYMENT SUMMARY");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
    console.log("  RiskPolicyRegistry:", registryAddress);
    console.log("  StrategyExecutor:  ", executorAddress);
    console.log("  V4LiquidityAdapter:", adapterAddress);
    console.log("  PoolVaultV3:       ", vaultAddress);
    console.log("  HiFiHook:          ", hookAddress);
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
    console.log("  Risk Policy: MEDIUM (30% max v4 exposure)");
    console.log("  Pool Pair:   USDC/ETH");
    console.log("  Network:     Base Sepolia");
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
    console.log("🎉 Agentic Layer deployed successfully!");
    console.log("");

    // Save addresses to file
    const addresses = {
        network: "base-sepolia",
        timestamp: new Date().toISOString(),
        contracts: {
            RiskPolicyRegistry: registryAddress,
            StrategyExecutor: executorAddress,
            V4LiquidityAdapter: adapterAddress,
            PoolVaultV3: vaultAddress,
            HiFiHook: hookAddress,
        },
        config: {
            arcUsdc: ARC_USDC_ADDRESS,
            usdc: USDC_BASE_SEPOLIA,
            weth: WETH_BASE_SEPOLIA,
            poolManager: V4_POOL_MANAGER,
            cap: CAP.toString(),
            riskLevel: "MEDIUM",
            maxV4Allocation: "30%",
        }
    };

    const fs = await import('fs');
    fs.writeFileSync(
        './deployments-v4.json',
        JSON.stringify(addresses, null, 2)
    );
    console.log("📝 Addresses saved to deployments-v4.json");

    return addresses;
}

main()
    .then(() => process.exit(0))
=======
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
    .then(() => {
        console.log("\n🎉 Deployment completed!");
        process.exit(0);
    })
>>>>>>> Stashed changes
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
