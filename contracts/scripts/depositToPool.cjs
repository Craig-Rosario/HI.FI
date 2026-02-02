const hre = require("hardhat");

async function main() {
  const [depositor] = await hre.ethers.getSigners();
  
  console.log("💰 Depositing USDC to PoolVault");
  console.log("=====================================");
  console.log("Depositor:", depositor.address);
  
  // Use Fresh pool (no shares yet)
  const POOL_VAULT_ADDRESS = "0xddC39afa01D12911340975eFe6379FF92E22445f";
  const ARC_USDC = "0x3600000000000000000000000000000000000000";
  const DEPOSIT_AMOUNT = hre.ethers.parseUnits("5", 6); // 5 USDC
  
  console.log("PoolVault:", POOL_VAULT_ADDRESS);
  console.log("USDC:", ARC_USDC);
  console.log("Amount:", hre.ethers.formatUnits(DEPOSIT_AMOUNT, 6), "USDC");
  console.log();
  
  // Get contracts
  const usdc = await hre.ethers.getContractAt("IERC20", ARC_USDC);
  const poolVault = await hre.ethers.getContractAt("PoolVault", POOL_VAULT_ADDRESS);
  
  // Check balance
  const balance = await usdc.balanceOf(depositor.address);
  console.log("📊 Current State:");
  console.log("   Your USDC balance:", hre.ethers.formatUnits(balance, 6), "USDC");
  
  if (balance < DEPOSIT_AMOUNT) {
    console.log("❌ Insufficient USDC balance");
    console.log("   Required:", hre.ethers.formatUnits(DEPOSIT_AMOUNT, 6), "USDC");
    console.log("   Available:", hre.ethers.formatUnits(balance, 6), "USDC");
    process.exit(1);
  }
  
  // Check pool state
  const state = await poolVault.state();
  const nav = await poolVault.nav();
  const threshold = await poolVault.threshold();
  
  console.log("   Pool state:", state === 0n ? "Collecting" : "Active");
  console.log("   Pool NAV:", hre.ethers.formatUnits(nav, 6), "USDC");
  console.log("   Threshold:", hre.ethers.formatUnits(threshold, 6), "USDC");
  console.log();
  
  if (state !== 0n) {
    console.log("❌ Pool is not in Collecting state");
    process.exit(1);
  }
  
  // Check allowance
  const allowance = await usdc.allowance(depositor.address, POOL_VAULT_ADDRESS);
  
  if (allowance < DEPOSIT_AMOUNT) {
    console.log("⏳ Approving PoolVault...");
    const approveTx = await usdc.approve(POOL_VAULT_ADDRESS, DEPOSIT_AMOUNT);
    await approveTx.wait();
    console.log("✅ Approved");
  } else {
    console.log("✅ Already approved");
  }
  
  // Deposit
  console.log("⏳ Depositing to PoolVault...");
  const depositTx = await poolVault.deposit(DEPOSIT_AMOUNT);
  console.log("   Tx hash:", depositTx.hash);
  
  const receipt = await depositTx.wait();
  console.log("✅ Deposit successful (Block", receipt.blockNumber + ")");
  
  // Check new state
  const newNav = await poolVault.nav();
  const userShares = await poolVault.shares(depositor.address);
  
  console.log();
  console.log("📊 New State:");
  console.log("   Pool NAV:", hre.ethers.formatUnits(newNav, 6), "USDC");
  console.log("   Your shares:", hre.ethers.formatUnits(userShares, 6));
  console.log("   Progress:", hre.ethers.formatUnits(newNav, 6), "/", hre.ethers.formatUnits(threshold, 6), "USDC");
  
  if (newNav >= threshold) {
    console.log();
    console.log("🎉 Threshold reached! You can now activate the pool:");
    console.log("   npx hardhat console --network arc");
    console.log("   > const pv = await ethers.getContractAt('PoolVault', '" + POOL_VAULT_ADDRESS + "')");
    console.log("   > await pv.activatePool()");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
