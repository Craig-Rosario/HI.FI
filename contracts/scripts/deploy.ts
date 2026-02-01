import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";

async function main() {
  const ethers = (hre as any).ethers;

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying contracts with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address))
  );
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC:", usdcAddress);

  const PoolVault = await ethers.getContractFactory("PoolVault");
  const pool = await PoolVault.deploy(usdcAddress);
  await pool.waitForDeployment();

  console.log("PoolVault:", await pool.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
