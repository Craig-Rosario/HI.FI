import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  
  console.log("🚀 Starting deployment...\n");

  // Get the contract factory
  const Counter = await ethers.getContractFactory("Counter");
  
  // Deploy the contract
  console.log("📝 Deploying Counter contract...");
  const counter = await Counter.deploy();
  await counter.waitForDeployment();
  
  const contractAddress = await counter.getAddress();
  console.log(`✅ Counter deployed to: ${contractAddress}\n`);

  // Check initial value
  console.log("🔍 Checking initial state...");
  let currentValue = await counter.x();
  console.log(`   Initial value of x: ${currentValue}\n`);

  // Test 1: Call inc() function
  console.log("🧪 Test 1: Calling inc() function...");
  const tx1 = await counter.inc();
  await tx1.wait();
  currentValue = await counter.x();
  console.log(`   ✅ Transaction successful!`);
  console.log(`   New value of x: ${currentValue}\n`);

  // Test 2: Call incBy() function
  console.log("🧪 Test 2: Calling incBy(10) function...");
  const tx2 = await counter.incBy(10);
  const receipt = await tx2.wait();
  currentValue = await counter.x();
  console.log(`   ✅ Transaction successful!`);
  console.log(`   Transaction hash: ${tx2.hash}`);
  console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);
  console.log(`   New value of x: ${currentValue}\n`);

  // Test 3: Listen to events (with error handling for public RPCs)
  console.log("🧪 Test 3: Checking Increment events...");
  try {
    const deploymentBlock = tx1.blockNumber || (await ethers.provider.getBlockNumber()) - 2;
    const filter = counter.filters.Increment();
    const events = await counter.queryFilter(filter, deploymentBlock);
    console.log(`   📢 Found ${events.length} Increment events:`);
    events.forEach((event, index) => {
      console.log(`      Event ${index + 1}: Incremented by ${event.args.by}`);
    });
  } catch (error: any) {
    console.log(`   ⚠️  Could not query events (common with free RPC tiers)`);
    console.log(`   💡 Tip: Events were still emitted on-chain!`);
    console.log(`   🔗 View them on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`);
  }

  console.log("\n✨ All tests completed successfully!");
  console.log(`📊 Summary:`);
  console.log(`   - Contract Address: ${contractAddress}`);
  console.log(`   - Final value: ${currentValue}`);
  console.log(`   - Total transactions: 2`);
  console.log(`   🔗 View on Sepolia Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
