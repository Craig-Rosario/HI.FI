import "@nomicfoundation/hardhat-ethers";
import hre from "hardhat";

const MOCK_USDC_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const POOL_VAULT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

async function main() {
  const ethers = (hre as any).ethers;

  
  const [user] = await ethers.getSigners();
  console.log("User address:", user.address);

  const mockUSDC = await ethers.getContractAt("MockUSDC", MOCK_USDC_ADDRESS);
  const poolVault = await ethers.getContractAt("PoolVault", POOL_VAULT_ADDRESS);

  const amount = ethers.parseUnits("1000", 6);
  console.log("Working with amount:", ethers.formatUnits(amount, 6), "USDC");

  const initialUserBalance = await mockUSDC.balanceOf(user.address);
  console.log("\n=== Initial State ===");
  console.log("User USDC balance:", ethers.formatUnits(initialUserBalance, 6));

  console.log("\n=== Minting USDC ===");
  const mintTx = await mockUSDC.mint(user.address, amount);
  await mintTx.wait();
  console.log("✅ Minted 1,000 USDC to user");

  const balanceAfterMint = await mockUSDC.balanceOf(user.address);
  console.log("User USDC balance after mint:", ethers.formatUnits(balanceAfterMint, 6));

  console.log("\n=== Approving PoolVault ===");
  const approveTx = await mockUSDC.approve(POOL_VAULT_ADDRESS, amount);
  await approveTx.wait();
  console.log("✅ Approved PoolVault to spend 1,000 USDC");

  const allowance = await mockUSDC.allowance(user.address, POOL_VAULT_ADDRESS);
  console.log("Allowance:", ethers.formatUnits(allowance, 6));

  console.log("\n=== Depositing to PoolVault ===");
  const depositTx = await poolVault.deposit(amount);
  await depositTx.wait();
  console.log("✅ Deposited 1,000 USDC to PoolVault");

  console.log("\n=== Final Balances ===");
  
  const userBalanceAfterDeposit = await mockUSDC.balanceOf(user.address);
  console.log("User USDC balance after deposit:", ethers.formatUnits(userBalanceAfterDeposit, 6));

  const poolVaultBalance = await mockUSDC.balanceOf(POOL_VAULT_ADDRESS);
  console.log("PoolVault USDC balance:", ethers.formatUnits(poolVaultBalance, 6));

  const userInternalBalance = await poolVault.balances(user.address);
  console.log("User internal balance in PoolVault:", ethers.formatUnits(userInternalBalance, 6));

  const totalDeposits = await poolVault.totalDeposits();
  console.log("Total deposits in PoolVault:", ethers.formatUnits(totalDeposits, 6));

  console.log("\n✅ Flow completed successfully!");
}

main()
  .then(() => {
    console.log("\n🎉 Script execution completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script execution failed:");
    console.error(error);
    process.exitCode = 1;
  });