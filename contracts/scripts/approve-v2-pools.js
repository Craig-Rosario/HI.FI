import hre from "hardhat";
import { ethers } from "ethers";
import "dotenv/config";

/**
 * Treasury Approval Script
 * 
 * This script makes the treasury wallet approve the 3 new V2 pool contracts
 * to spend its USDC. This is required for the treasury to fund the simulated yields
 * when users withdraw.
 * 
 * Run: npx hardhat run scripts/approve-v2-pools.js --network baseSepolia
 */

async function main() {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const privateKey = process.env.PRIVATE_KEY; // This is the treasury wallet key
  const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  const POOLS = [
    "0xD42b4f8BB9a4f32f38E5677750B4FfFfA11E7A06", // Final EasyPoolV2
    "0x401888f1E90A72D3116021bcaeBAa656C63A0A6F", // Final MediumPoolV2
    "0x7484b1976Cd5469f0BF3E8F3d5534104A57634e6"  // Final HighRiskPool
  ];

  if (!privateKey) throw new Error("PRIVATE_KEY not set");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const treasury = new ethers.Wallet(privateKey, provider);

  console.log("Treasury Wallet:", treasury.address);
  
  const usdcAbi = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function allowance(address owner, address spender) public view returns (uint256)"
  ];
  const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, treasury);

  const APPROVAL_AMOUNT = ethers.MaxUint256;

  for (const pool of POOLS) {
    console.log(`\nApproving Pool: ${pool}`);
    const tx = await usdc.approve(pool, APPROVAL_AMOUNT);
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Approved!`);
  }

  console.log("\nAll pools approved by treasury.");
}

main().catch(console.error);
