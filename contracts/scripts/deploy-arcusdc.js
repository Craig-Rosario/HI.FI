import hre from "hardhat";
import { ethers } from "ethers";
import "dotenv/config";

async function main() {
  console.log("🚀 Deploying ArcUSDC...\n");

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set in .env file");
  }
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(privateKey, provider);

  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await provider.getBalance(deployer.address)), "ETH\n");

  // USDC on Base Sepolia
  const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  const artifact = await hre.artifacts.readArtifact("ArcUSDC");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  
  const arcUsdc = await factory.deploy(USDC_BASE_SEPOLIA);
  await arcUsdc.waitForDeployment();

  const address = await arcUsdc.getAddress();
  console.log("\n✅ ArcUSDC deployed to:", address);
  console.log("Update your .env with: NEXT_PUBLIC_ARCUSDC_ADDRESS=" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
