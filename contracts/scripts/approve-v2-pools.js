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
    "0x9adE576E148Da5237DAaC47618c3AC52049038b2", // Final EasyPoolV2
    "0xB1047324527a2dea86A2009588cdCD265400B8EF", // Final MediumPoolV2
    "0x5e5Aef03a6279302FCD1d1652d579500386959b9"  // Final HighRiskPool
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
    console.log(`\nChecking Pool: ${pool}`);
    const currentAllowance = await usdc.allowance(treasury.address, pool);
    if (currentAllowance > (BigInt(APPROVAL_AMOUNT) / BigInt(2))) {
      console.log(`✅ Already approved (Allowance: ${ethers.formatUnits(currentAllowance, 6)})`);
      continue;
    }

    const tx = await usdc.approve(pool, APPROVAL_AMOUNT);
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait(2);
    console.log(`✅ Approved!`);
    
    // Small delay to let nonce catch up in provider
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("\nAll pools approved by treasury.");
}

main().catch(console.error);
