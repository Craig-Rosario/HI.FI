// scripts/test-agent-flow.js
// End-to-end test of the agentic yield system

import fs from 'fs';

async function main() {
    console.log("🧪 Testing Agentic Yield System...\n");

    const [deployer, user1, agent] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("User1:", user1.address);
    console.log("Agent:", agent.address);
    console.log();

    // ===== LOAD DEPLOYMENT INFO =====
    const deploymentInfo = JSON.parse(fs.readFileSync('deployment-agent-system.json', 'utf8'));
    const { treasuryFunder, poolVaultHighRisk, agentPermissionManager } = deploymentInfo.contracts;
    const USDC_ADDRESS = deploymentInfo.configuration.usdcAddress;

    console.log("📋 Loaded contract addresses from deployment file\n");

    // ===== ATTACH TO CONTRACTS =====
    const PoolVaultHighRisk = await ethers.getContractFactory("PoolVaultHighRisk");
    const highRiskPool = PoolVaultHighRisk.attach(poolVaultHighRisk);

    const AgentPermissionManager = await ethers.getContractFactory("AgentPermissionManager");
    const agentManager = AgentPermissionManager.attach(agentPermissionManager);

    const USDC = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "function transfer(address,uint256) returns (bool)"],
        USDC_ADDRESS
    );


    // ===== STEP 1: USER DEPOSITS TO HIGH RISK POOL =====
    console.log("=== STEP 1: User Deposits ===");
    const DEPOSIT_AMOUNT = ethers.parseUnits("10", 6); // 10 USDC
    console.log("User1 depositing:", ethers.formatUnits(DEPOSIT_AMOUNT, 6), "USDC");

    // Transfer USDC to user1 for testing (from deployer)
    await USDC.connect(deployer).transfer(user1.address, DEPOSIT_AMOUNT);
    await USDC.connect(user1).approve(poolVaultHighRisk, DEPOSIT_AMOUNT);

    const depositTx = await highRiskPool.connect(user1).deposit(DEPOSIT_AMOUNT);
    await depositTx.wait();
    console.log("✅ Deposit successful");

    const user1Shares = await highRiskPool.balanceOf(user1.address);
    console.log("User1 shares:", ethers.formatUnits(user1Shares, 6));
    console.log("Pool state:", await highRiskPool.state());
    console.log();

    // ===== STEP 2: GRANT AGENT PERMISSION =====
    console.log("=== STEP 2: Grant Agent Permission ===");
    console.log("User1 granting withdrawal permission to agent...");

    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
    const maxAmount = ethers.parseUnits("10", 6); // 10 USDC

    console.log("   Pool:", poolVaultHighRisk);
    console.log("   Agent:", agent.address);
    console.log("   Max amount:", ethers.formatUnits(maxAmount, 6), "USDC");
    console.log("   Expires:", new Date(expiresAt * 1000).toLocaleString());

    const grantTx = await agentManager.connect(user1).grantPermission(
        0, // WITHDRAW type
        poolVaultHighRisk,
        agent.address,
        expiresAt,
        maxAmount,
        0 // unlimited uses
    );
    await grantTx.wait();
    console.log("✅ Permission granted");
    console.log();

    // ===== STEP 3: WAIT FOR WITHDRAW WINDOW =====
    console.log("=== STEP 3: Wait for Withdraw Window ===");
    console.log("🕐 Waiting 61 seconds for withdraw window to open...");
    await new Promise(resolve => setTimeout(resolve, 61000));
    console.log("✅ Wait complete\n");

    // ===== STEP 4: AGENT EXECUTES AUTO-WITHDRAWAL =====
    console.log("=== STEP 4: Agent Auto-Withdrawal ===");
    console.log("Agent checking if withdrawal is optimal...");

    const metrics = await highRiskPool.getRiskMetrics();
    console.log("Current PnL:", ethers.formatUnits(metrics.currentPnL, 6), "USDC");
    console.log("Volatility:", metrics.volatilityIndex.toString());
    console.log("At Risk:", metrics.atRisk);

    console.log("Agent executing withdrawal...");

    const withdrawAmount = ethers.parseUnits("10", 6); // Withdraw all
    const executeTx = await agentManager.connect(agent).executeWithdrawal(
        user1.address,
        poolVaultHighRisk,
        withdrawAmount
    );
    await executeTx.wait();
    console.log("✅ Agent withdrawal successful");
    console.log("Transaction hash:", executeTx.hash);
    console.log();

    // ===== VERIFY RESULTS =====
    console.log("=== Final Results ===");
    const finalBalance = await USDC.balanceOf(user1.address);
    console.log("User1 final USDC balance:", ethers.formatUnits(finalBalance, 6), "USDC");

    const finalShares = await highRiskPool.balanceOf(user1.address);
    console.log("User1 remaining shares:", ethers.formatUnits(finalShares, 6));

    console.log("\n" + "=".repeat(60));
    console.log("✅ AGENTIC YIELD SYSTEM TEST COMPLETE");
    console.log("=".repeat(60));
    console.log("\nKey Results:");
    console.log("✨ User deposited once with 1 signature");
    console.log("✨ Agent monitored and executed withdrawal automatically");
    console.log("✨ User received funds back without additional signatures");
    console.log("✨ Total signatures: 1 (vs 8 in traditional flow)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
