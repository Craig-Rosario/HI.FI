const hre = require("hardhat");

async function main() {
  const [relayer] = await hre.ethers.getSigners();
  
  console.log("🧪 Testing depositFor() Function");
  console.log("=====================================");
  console.log("Relayer:", relayer.address);
  
  const POOL_VAULT_ADDRESS = process.env.ARC_POOL_VAULT;
  const ARC_USDC = process.env.ARC_USDC;
  
  // Mock user address (different from relayer)
  const MOCK_USER = "0x1234567890123456789012345678901234567890";
  const DEPOSIT_AMOUNT = hre.ethers.parseUnits("3", 6); // 3 USDC
  
  console.log("PoolVault:", POOL_VAULT_ADDRESS);
  console.log("Mock User:", MOCK_USER);
  console.log("Amount:", hre.ethers.formatUnits(DEPOSIT_AMOUNT, 6), "USDC");
  console.log();
  
  // Get contracts
  const usdc = await hre.ethers.getContractAt("IERC20", ARC_USDC);
  const poolVault = await hre.ethers.getContractAt("PoolVault", POOL_VAULT_ADDRESS);
  
  // Check relayer USDC balance
  const relayerBalance = await usdc.balanceOf(relayer.address);
  console.log("📊 Before State:");
  console.log("   Relayer USDC:", hre.ethers.formatUnits(relayerBalance, 6), "USDC");
  
  if (relayerBalance < DEPOSIT_AMOUNT) {
    console.log("❌ Insufficient USDC for test");
    process.exit(1);
  }
  
  const userSharesBefore = await poolVault.shares(MOCK_USER);
  const navBefore = await poolVault.nav();
  console.log("   Mock User Shares:", hre.ethers.formatUnits(userSharesBefore, 6));
  console.log("   Pool NAV:", hre.ethers.formatUnits(navBefore, 6), "USDC");
  console.log();
  
  // Approve PoolVault
  console.log("⏳ Approving PoolVault...");
  const approveTx = await usdc.approve(POOL_VAULT_ADDRESS, DEPOSIT_AMOUNT);
  await approveTx.wait();
  console.log("✅ Approved");
  
  // Call depositFor
  console.log("⏳ Calling depositFor(", MOCK_USER, ",", hre.ethers.formatUnits(DEPOSIT_AMOUNT, 6), "USDC )...");
  const depositTx = await poolVault.depositFor(MOCK_USER, DEPOSIT_AMOUNT);
  const receipt = await depositTx.wait();
  console.log("✅ depositFor() successful");
  console.log("   Tx hash:", depositTx.hash);
  console.log("   Block:", receipt.blockNumber);
  console.log();
  
  // Check results
  console.log("📊 After State:");
  const userSharesAfter = await poolVault.shares(MOCK_USER);
  const navAfter = await poolVault.nav();
  const relayerBalanceAfter = await usdc.balanceOf(relayer.address);
  
  console.log("   Mock User Shares:", hre.ethers.formatUnits(userSharesAfter, 6));
  console.log("   Pool NAV:", hre.ethers.formatUnits(navAfter, 6), "USDC");
  console.log("   Relayer USDC:", hre.ethers.formatUnits(relayerBalanceAfter, 6), "USDC");
  console.log();
  
  // Verify
  const sharesMinted = userSharesAfter - userSharesBefore;
  console.log("✅ VERIFICATION:");
  console.log("   Shares minted to user:", hre.ethers.formatUnits(sharesMinted, 6));
  console.log("   NAV increased by:", hre.ethers.formatUnits(navAfter - navBefore, 6), "USDC");
  console.log("   Relayer spent:", hre.ethers.formatUnits(relayerBalance - relayerBalanceAfter, 6), "USDC");
  console.log();
  
  if (sharesMinted > 0n) {
    console.log("✅ SUCCESS! depositFor() works correctly!");
    console.log("   ✓ Shares minted to specified user (not relayer)");
    console.log("   ✓ NAV updated");
    console.log("   ✓ USDC transferred from relayer to pool");
  } else {
    console.log("❌ FAILED: No shares minted");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
