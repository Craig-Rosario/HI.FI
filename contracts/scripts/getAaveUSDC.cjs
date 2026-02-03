const { ethers } = require("hardhat");

async function getAaveUSDC() {
  const [signer] = await ethers.getSigners();
  
  console.log("🎯 Getting Aave-compatible USDC on Sepolia\n");
  console.log("Wallet:", signer.address);
  
  const aaveUSDC = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";
  const gatewayUSDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  const usdcABI = [
    "function balanceOf(address) view returns (uint256)",
    "function mint(address to, uint256 amount) external", // Some test tokens have this
    "function faucet(address to, uint256 amount) external",
  ];
  
  const aaveToken = await ethers.getContractAt("IERC20", aaveUSDC);
  const gatewayToken = await ethers.getContractAt("IERC20", gatewayUSDC);
  
  const aaveBalance = await aaveToken.balanceOf(signer.address);
  const gatewayBalance = await gatewayToken.balanceOf(signer.address);
  
  console.log("\n📊 Current Balances:");
  console.log(`   Aave USDC (0x94a9...):    ${ethers.formatUnits(aaveBalance, 6)} USDC`);
  console.log(`   Gateway USDC (0x1c7D...): ${ethers.formatUnits(gatewayBalance, 6)} USDC`);
  
  console.log("\n💡 Options to get Aave USDC:");
  console.log("   1. Visit Aave Faucet: https://staging.aave.com/faucet/");
  console.log("   2. Visit Circle Faucet: https://faucet.circle.com/");
  console.log("   3. Use Sepolia USDC faucet if available");
  console.log("\n   Request USDC to:", signer.address);
  console.log("   Need: 10 USDC of token 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8\n");
}

getAaveUSDC().catch(console.error);
