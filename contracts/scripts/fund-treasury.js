// scripts/fund-treasury.js
// Fund the TreasuryFunder contract with USDC for demo yield payments

import fs from 'fs';

async function main() {
    console.log("💰 Funding TreasuryFunder with USDC...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Funding from account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // ===== CONFIGURATION =====
    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC
    const TREASURY_FUNDER_ADDRESS = "0xYourTreasuryFunderAddress"; // TODO: Update with deployed address
    const FUNDING_AMOUNT = ethers.parseUnits("100", 6); // 100 USDC

    // ===== GET CONTRACTS =====
    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    const treasuryFunder = await ethers.getContractAt("TreasuryFunder", TREASURY_FUNDER_ADDRESS);

    // Check USDC balance
    const balance = await usdc.balanceOf(funder.address);
    console.log("Your USDC balance:", ethers.formatUnits(balance, 6), "USDC");

    if (balance < FUNDING_AMOUNT) {
        console.error("❌ Insufficient USDC balance!");
        console.log("Need:", ethers.formatUnits(FUNDING_AMOUNT, 6), "USDC");
        console.log("Have:", ethers.formatUnits(balance, 6), "USDC");
        console.log("\n💡 Get testnet USDC from Base Sepolia faucet:");
        console.log("   https://faucet.circle.com/");
        return;
    }

    // ===== APPROVE USDC =====
    console.log("📝 Approving USDC...");
    const approveTx = await usdc.approve(TREASURY_FUNDER_ADDRESS, FUNDING_AMOUNT);
    await approveTx.wait();
    console.log("✅ USDC approved");

    // ===== DEPOSIT TO TREASURY =====
    console.log("💸 Depositing to TreasuryFunder...");
    const depositTx = await treasuryFunder.depositTreasury(FUNDING_AMOUNT);
    await depositTx.wait();
    console.log("✅ Deposit successful!");

    // ===== CHECK TREASURY BALANCE =====
    const treasuryBalance = await treasuryFunder.treasuryBalance();
    console.log("\n📊 Treasury Status:");
    console.log("   Balance:", ethers.formatUnits(treasuryBalance, 6), "USDC");

    const globalLimit = await treasuryFunder.globalFundingLimit();
    console.log("   Global Limit:", ethers.formatUnits(globalLimit, 6), "USDC");

    const totalFunded = await treasuryFunder.totalFundingProvided();
    console.log("   Total Provided:", ethers.formatUnits(totalFunded, 6), "USDC");
    console.log("   Remaining Capacity:", ethers.formatUnits(globalLimit - totalFunded, 6), "USDC");

    console.log("\n✅ Treasury funded successfully!");
    console.log("\nThe treasury can now fund demo yields for pools.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
