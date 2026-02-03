import { account, base } from "./setup.js";
import { getContract, erc20Abi } from "viem";

const ARC_USDC_ADDRESS = "0x0DD76fB7C83A84C57C81A4353B565f34016aBaf8";

const arcUSDC = getContract({
  address: ARC_USDC_ADDRESS,
  abi: erc20Abi,
  client: base.client,
});

console.log(`Checking arcUSDC balance for: ${account.address}`);

const balance = await arcUSDC.read.balanceOf([account.address]);
const formattedBalance = Number(balance) / 1e6;

console.log(`\nBase Sepolia:`);
console.log(`- arcUSDC: ${formattedBalance} arcUSDC`);
console.log(`- Native USDC: ${Number(await base.usdc.read.balanceOf([account.address])) / 1e6} USDC`);
