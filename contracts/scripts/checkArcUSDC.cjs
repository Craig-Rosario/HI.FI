const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  console.log("💰 Checking Arc Native USDC Balance\n");
  console.log("=".repeat(60));
  console.log("Your Address:", signer.address);
  console.log();

  const ARC_USDC = "0x3600000000000000000000000000000000000000";
  const POOL_ADDRESS = "0xddC39afa01D12911340975eFe6379FF92E22445f"; // Fresh pool

  try {
    // Arc native USDC supports ERC20 interface
    const usdc = await hre.ethers.getContractAt("IERC20", ARC_USDC);
    
    const balance = await usdc.balanceOf(signer.address);
    const poolBalance = await usdc.balanceOf(POOL_ADDRESS);
    
    console.log("📊 USDC Balances:");
    console.log(`   Your Balance: ${hre.ethers.formatUnits(balance, 6)} USDC`);
    console.log(`   Pool Balance: ${hre.ethers.formatUnits(poolBalance, 6)} USDC`);
    console.log();

    if (balance > 0n) {
      console.log("✅ You have USDC! Ready to deposit.");
      console.log("\nTo deposit, run:");
      console.log("   npx hardhat run scripts/depositToPool.cjs --network arc");
    } else {
      console.log("❌ You don't have any Arc USDC yet.");
      console.log("\n📝 To get Arc testnet USDC:");
      console.log("   1. Get Arc testnet tokens from faucet");
      console.log("   2. Use Arc's native USDC (it's a system contract)");
      console.log("   3. Or bridge from another testnet");
    }

  } catch (error) {
    console.log("❌ Error checking balance:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
