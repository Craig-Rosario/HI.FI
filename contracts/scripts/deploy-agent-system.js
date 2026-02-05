// scripts/deploy-agent-system.js
// Deploy complete agentic yield system: TreasuryFunder, DemoYieldController, PoolVaultHighRisk, AgentPermissionManager

import fs from 'fs';

async function main() {
    console.log("🚀 Deploying Agentic Yield System to Base Sepolia...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // ===== CONFIGURATION =====
    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC
    const ARC_USDC_ADDRESS = "0x0DD76fB7C83A84C57C81A4353B565f34016aBaf8"; // Circle Gateway arcUSDC
    const POOL_CAP = ethers.parseUnits("10", 6); // 10 USDC cap for testing

    // ===== 1. DEPLOY TREASURY FUNDER =====
    console.log("📦 Deploying TreasuryFunder...");
    const TreasuryFunder = await ethers.getContractFactory("TreasuryFunder");
    const treasuryFunder = await TreasuryFunder.deploy(USDC_ADDRESS);
    await treasuryFunder.waitForDeployment();
    const treasuryFunderAddress = await treasuryFunder.getAddress();
    console.log("✅ TreasuryFunder deployed to:", treasuryFunderAddress);
    console.log("   Owner:", await treasuryFunder.owner());
    console.log();

    // ===== 2. DEPLOY DEMO YIELD CONTROLLER =====
    console.log("📦 Deploying DemoYieldController...");
    const DemoYieldController = await ethers.getContractFactory("DemoYieldController");
    const yieldController = await DemoYieldController.deploy(treasuryFunderAddress);
    await yieldController.waitForDeployment();
    const yieldControllerAddress = await yieldController.getAddress();
    console.log("✅ DemoYieldController deployed to:", yieldControllerAddress);
    console.log("   Treasury:", await yieldController.treasuryFunder());
    console.log();

    // ===== 3. DEPLOY HIGH RISK POOL =====
    console.log("📦 Deploying PoolVaultHighRisk...");
    const PoolVaultHighRisk = await ethers.getContractFactory("PoolVaultHighRisk");
    const highRiskPool = await PoolVaultHighRisk.deploy(
        ARC_USDC_ADDRESS,
        USDC_ADDRESS,
        POOL_CAP
    );
    await highRiskPool.waitForDeployment();
    const highRiskPoolAddress = await highRiskPool.getAddress();
    console.log("✅ PoolVaultHighRisk deployed to:", highRiskPoolAddress);
    console.log("   arcUSDC:", await highRiskPool.arcUsdc());
    console.log("   Cap:", ethers.formatUnits(await highRiskPool.cap(), 6), "USDC");
    console.log("   State:", await highRiskPool.state());
    console.log();

    // ===== 4. DEPLOY AGENT PERMISSION MANAGER =====
    console.log("📦 Deploying AgentPermissionManager...");
    const AgentPermissionManager = await ethers.getContractFactory("AgentPermissionManager");
    const agentManager = await AgentPermissionManager.deploy();
    await agentManager.waitForDeployment();
    const agentManagerAddress = await agentManager.getAddress();
    console.log("✅ AgentPermissionManager deployed to:", agentManagerAddress);
    console.log("   Owner:", await agentManager.owner());
    console.log();

    // ===== 5. CONFIGURE TREASURY FUNDER =====
    console.log("⚙️ Configuring TreasuryFunder...");

    // Authorize yield controller to request funds
    console.log("   Authorizing DemoYieldController...");
    await treasuryFunder.authorizePool(yieldControllerAddress, ethers.parseUnits("1000", 6)); // 1000 USDC limit
    console.log("   ✅ DemoYieldController authorized with 1000 USDC limit");

    // Set global funding limit
    console.log("   Setting global funding limit...");
    await treasuryFunder.updateGlobalFundingLimit(ethers.parseUnits("10000", 6)); // 10,000 USDC total
    console.log("   ✅ Global limit set to 10,000 USDC");
    console.log();

    // ===== 6. CONFIGURE DEMO YIELD CONTROLLER =====
    console.log("⚙️ Configuring DemoYieldController...");

    // Register High Risk Pool with variable yield
    console.log("   Registering PoolVaultHighRisk...");
    await yieldController.registerPool(
        highRiskPoolAddress,
        true, // enabled
        1, // yieldModel: percentage-based
        0, // fixedRatePerMinute (not used for percentage model)
        1500, // percentageBps: 15% annualized base
        -2000, // minYieldBps: -20% min
        3000, // maxYieldBps: +30% max
        0 // capPerWithdrawal: unlimited
    );
    console.log("   ✅ PoolVaultHighRisk registered (15% base, -20% to +30% range)");
    console.log();

    // ===== 7. CONFIGURE AGENT PERMISSION MANAGER =====
    console.log("⚙️ Configuring AgentPermissionManager...");

    // Add deployer as first agent operator (for testing)
    console.log("   Adding agent operator...");
    await agentManager.addAgentOperator(deployer.address);
    console.log("   ✅ Agent operator added:", deployer.address);

    // Set max permission duration to 30 days
    console.log("   Setting max permission duration...");
    await agentManager.setMaxPermissionDuration(30 * 24 * 60 * 60); // 30 days
    console.log("   ✅ Max duration set to 30 days");
    console.log();

    // ===== DEPLOYMENT SUMMARY =====
    console.log("=".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log("\n📋 Contract Addresses:\n");
    console.log("TreasuryFunder:          ", treasuryFunderAddress);
    console.log("DemoYieldController:     ", yieldControllerAddress);
    console.log("PoolVaultHighRisk:       ", highRiskPoolAddress);
    console.log("AgentPermissionManager:  ", agentManagerAddress);
    console.log("\n" + "=".repeat(60));

    console.log("\n📝 Next Steps:\n");
    console.log("1. Fund TreasuryFunder with USDC:");
    console.log("   await treasuryFunder.depositTreasury(amount)");
    console.log("\n2. Update frontend with contract addresses");
    console.log("\n3. Verify contracts on Basescan:");
    console.log("   npx hardhat verify --network baseSepolia", treasuryFunderAddress, USDC_ADDRESS);
    console.log("   npx hardhat verify --network baseSepolia", yieldControllerAddress, treasuryFunderAddress);
    console.log("   npx hardhat verify --network baseSepolia", highRiskPoolAddress, ARC_USDC_ADDRESS, USDC_ADDRESS, POOL_CAP.toString());
    console.log("   npx hardhat verify --network baseSepolia", agentManagerAddress);

    console.log("\n4. Test the system:");
    console.log("   - Users deposit to PoolVaultHighRisk");
    console.log("   - When cap reached, pool auto-deploys");
    console.log("   - After 1 minute, withdraw window opens");
    console.log("   - Users can grant agent permissions");
    console.log("   - Agent can auto-withdraw for users");

    // Save deployment info to file
    const deploymentInfo = {
        network: "baseSepolia",
        chainId: 84532,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            treasuryFunder: treasuryFunderAddress,
            demoYieldController: yieldControllerAddress,
            poolVaultHighRisk: highRiskPoolAddress,
            agentPermissionManager: agentManagerAddress,
        },
        configuration: {
            usdcAddress: USDC_ADDRESS,
            arcUsdcAddress: ARC_USDC_ADDRESS,
            poolCap: ethers.formatUnits(POOL_CAP, 6) + " USDC",
            treasuryGlobalLimit: "10,000 USDC",
            maxPermissionDuration: "30 days",
        }
    };

    fs.writeFileSync(
        'deployment-agent-system.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\n💾 Deployment info saved to: deployment-agent-system.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
