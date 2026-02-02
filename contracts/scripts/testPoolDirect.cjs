const hre = require("hardhat");

async function main() {
  console.log("🧪 Testing Pool Functionality\n");
  console.log("=".repeat(60));

  const [signer] = await hre.ethers.getSigners();
  console.log("Testing with address:", signer.address);

  // Pool addresses to test
  const pools = [
    { name: "Aave USDC Pool (Fresh)", address: "0xddC39afa01D12911340975eFe6379FF92E22445f" },
    { name: "Aave USDC Pool (Old)", address: "0x2Ab5B38Cc67D3B23677d3e3A6C726baf0dBed65c" },
    { name: "High Yield Pool", address: "0x5BF5868E09D9395968F7C2A989679F4a5b415683" },
  ];

  const POOL_ABI = [
    "function state() view returns (uint8)",
    "function threshold() view returns (uint256)",
    "function nav() view returns (uint256)",
    "function usdc() view returns (address)",
    "function shares(address) view returns (uint256)",
    "function totalShares() view returns (uint256)",
  ];

  const USDC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  console.log("\n📊 Testing All Pools:\n");

  for (const poolInfo of pools) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📦 ${poolInfo.name}`);
    console.log(`   Address: ${poolInfo.address}`);
    console.log("-".repeat(60));

    try {
      const pool = await hre.ethers.getContractAt("PoolVault", poolInfo.address);
      
      // Get pool state
      const state = await pool.state();
      const threshold = await pool.threshold();
      const nav = await pool.nav();
      const usdcAddress = await pool.usdc();
      const totalShares = await pool.totalShares();
      const userShares = await pool.shares(signer.address);

      console.log(`\n📈 Pool Status:`);
      console.log(`   State: ${state === 0n ? "Collecting 🟢" : state === 1n ? "Deployed 🟡" : "Withdrawing 🔴"}`);
      console.log(`   Threshold: ${hre.ethers.formatUnits(threshold, 6)} USDC`);
      console.log(`   Current NAV: ${hre.ethers.formatUnits(nav, 6)} USDC`);
      console.log(`   Progress: ${((Number(nav) / Number(threshold)) * 100).toFixed(2)}%`);
      console.log(`   Total Shares: ${hre.ethers.formatEther(totalShares)}`);
      console.log(`   Your Shares: ${hre.ethers.formatEther(userShares)}`);

      // Check USDC contract
      console.log(`\n💰 USDC Info:`);
      console.log(`   USDC Address: ${usdcAddress}`);
      
      if (usdcAddress === '0x3600000000000000000000000000000000000000') {
        console.log(`   Type: Arc Native System Contract ✅`);
        console.log(`   Note: This is Arc's high-performance native USDC`);
        console.log(`   Decimals: 6 (standard)`);
        
        // For native contracts, we can't call standard ERC20 functions
        // But we can check pool balance via nav()
        console.log(`   Pool Balance (via NAV): ${hre.ethers.formatUnits(nav, 6)} USDC`);
        
        if (nav === 0n) {
          console.log(`   ⚠️  Pool is empty - no deposits yet`);
        } else {
          console.log(`   ✅ Pool has USDC deposited!`);
        }
      } else {
        try {
          const usdc = await hre.ethers.getContractAt("IERC20", usdcAddress);
          const symbol = await usdc.symbol();
          const decimals = await usdc.decimals();
          const poolUsdcBalance = await usdc.balanceOf(poolInfo.address);
          const userUsdcBalance = await usdc.balanceOf(signer.address);

          console.log(`   Symbol: ${symbol}`);
          console.log(`   Decimals: ${decimals}`);
          console.log(`   Pool Balance: ${hre.ethers.formatUnits(poolUsdcBalance, 6)} USDC`);
          console.log(`   Your Balance: ${hre.ethers.formatUnits(userUsdcBalance, 6)} USDC`);

          // Verify NAV matches actual USDC balance
          if (poolUsdcBalance === nav) {
            console.log(`   ✅ NAV matches actual USDC balance`);
          } else {
            console.log(`   ⚠️  NAV mismatch! NAV: ${hre.ethers.formatUnits(nav, 6)}, Actual: ${hre.ethers.formatUnits(poolUsdcBalance, 6)}`);
          }

        } catch (error) {
          console.log(`   ❌ Error reading USDC contract: ${error.message}`);
          console.log(`   This might be an invalid USDC address: ${usdcAddress}`);
        }
      }

    } catch (error) {
      console.log(`\n❌ Error testing pool: ${error.message}`);
      console.log(`   This pool might not be deployed or accessible`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("\n✅ Pool testing complete!\n");

  // Summary
  console.log("\n📝 Summary:");
  console.log("   If you see '0.0 USDC' in pool balances, the pools are deployed but empty.");
  console.log("   If you see USDC address errors, the pools have invalid USDC configuration.");
  console.log("   To deposit, you need USDC on Arc Testnet at address:", signer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
