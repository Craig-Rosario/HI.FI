const hre = require("hardhat");

async function main() {
  const [user] = await hre.ethers.getSigners();
  
  console.log("🧪 Testing PoolVault on Arc");
  console.log("============================\n");
  console.log("User:", user.address);

  // Connect to deployed contracts
  const POOL_VAULT_ADDRESS = process.env.ARC_POOL_VAULT;
  const USDC_ADDRESS = process.env.ARC_USDC;

  const poolVault = await hre.ethers.getContractAt("PoolVault", POOL_VAULT_ADDRESS);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS);

  console.log("📋 Contract Addresses:");
  console.log("   PoolVault:", POOL_VAULT_ADDRESS);
  console.log("   USDC:     ", USDC_ADDRESS);
  console.log();

  // Check current state
  console.log("📊 Current Pool State:");
  const state = await poolVault.state();
  const nav = await poolVault.nav();
  const threshold = await poolVault.threshold();
  const totalShares = await poolVault.totalShares();
  
  console.log("   State:       ", state === 0n ? "Collecting" : "Active");
  console.log("   NAV:         ", hre.ethers.formatUnits(nav, 6), "USDC");
  console.log("   Threshold:   ", hre.ethers.formatUnits(threshold, 6), "USDC");
  console.log("   Total Shares:", hre.ethers.formatUnits(totalShares, 18));
  console.log();

  // Check user balance
  console.log("💰 User Balances:");
  const userUSDC = await usdc.balanceOf(user.address);
  const userShares = await poolVault.shares(user.address);
  
  console.log("   USDC:        ", hre.ethers.formatUnits(userUSDC, 6), "USDC");
  console.log("   Pool Shares: ", hre.ethers.formatUnits(userShares, 6));
  console.log();
  
  // Check relayer role
  console.log("🔐 Role Verification:");
  const RELAYER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RELAYER_ROLE"));
  const hasRelayerRole = await poolVault.hasRole(RELAYER_ROLE, user.address);
  console.log("   Relayer has RELAYER_ROLE:", hasRelayerRole ? "✅ YES" : "❌ NO");
  console.log();

  // Check if user has USDC to deposit
  if (userUSDC > 0n) {
    console.log("✅ User has USDC, ready to test deposit!");
    console.log("\nTo test deposit, run:");
    console.log("   node scripts/depositToPool.cjs");
  } else {
    console.log("⚠️  User has no USDC");
    console.log("\nTo get Arc USDC:");
    console.log("   1. Visit Arc testnet faucet or bridge");
    console.log("   2. Get USDC to:", user.address);
  }
  console.log();
}

main().catch(console.error);
