import { account, ethereum, base } from "./setup.js";
import { GatewayClient } from "./gateway-client.js";
import { burnIntent, burnIntentTypedData } from "./typed-data.js";
import { getContract } from "viem";
import { erc20Abi } from "viem";

// ================= CONFIG =================

// 2 USDC (6 decimals)
const AMOUNT = 2n * 10n ** 6n;

// arcUSDC deployed on BASE SEPOLIA
const ARC_USDC_ADDRESS = "0x0DD76fB7C83A84C57C81A4353B565f34016aBaf8";

// ==========================================

const gatewayClient = new GatewayClient();

console.log("Using account:", account.address);

// ---------- 1. Check unified balance on ETH ----------
console.log("Checking Gateway balances...");
const { balances } = await gatewayClient.balances("USDC", account.address);

const ethBalance = balances.find(
  (b) => b.domain === ethereum.domain
)?.balance;

if (!ethBalance || BigInt(Math.floor(Number(ethBalance) * 1e6)) < AMOUNT) {
  console.error("❌ Not enough unified USDC on ETH");
  process.exit(1);
}

console.log("✅ Unified ETH balance OK");

// ---------- 2. Build burn intent (ETH → BASE) ----------
console.log("Constructing burn intent...");
const intent = burnIntent({
  account,
  from: ethereum,
  to: base,
  amount: Number(AMOUNT) / 1e6,
  recipient: account.address,
});

// ---------- 3. Sign ----------
console.log("Signing burn intent...");
const typedData = burnIntentTypedData(intent);
const signature = await account.signTypedData(typedData);

// ---------- 4. Request attestation ----------
console.log("Requesting Gateway attestation...");
const response = await gatewayClient.transfer([
  { burnIntent: typedData.message, signature },
]);

// Check for error response
if (response.error || response.message) {
  console.error("❌ Gateway error:", response.message || response.error);
  console.error("Full response:", response);
  process.exit(1);
}

// Validate attestation data
if (!response.attestation || !response.signature) {
  console.error("❌ Missing attestation or signature in response");
  console.error("Full response:", response);
  process.exit(1);
}

console.log("✅ Attestation received");
console.log(`Transfer ID: ${response.transferId}`);
console.log(`Fee: ${response.fees.total} ${response.fees.token}`);

// ---------- 5. Mint native USDC on BASE ----------
console.log("Minting native USDC on Base Sepolia...");
const mintTx = await base.gatewayMinter.write.gatewayMint([
  response.attestation,
  response.signature,
]);

await base.client.waitForTransactionReceipt({ hash: mintTx });
console.log("✅ USDC minted on Base");

// ---------- 6. Check Base USDC balance ----------
console.log("Checking Base USDC balance...");
const baseUsdcBalance = await base.usdc.read.balanceOf([account.address]);
console.log(`Base USDC balance: ${baseUsdcBalance / 10n**6n} USDC`);

if (baseUsdcBalance < AMOUNT) {
  console.error("❌ Insufficient Base USDC for wrapping");
  process.exit(1);
}

// ---------- 7. Wrap Base USDC → arcUSDC ----------

// Base USDC
const usdc = base.usdc;

// arcUSDC with deposit()
const arcUSDC = getContract({
  address: ARC_USDC_ADDRESS,
  abi: [
    ...erc20Abi,
    {
      name: "deposit",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [{ name: "amount", type: "uint256" }],
      outputs: [],
    },
  ],
  client: base.client,
});

// approve
console.log("Approving USDC for arcUSDC...");
const approveTx = await usdc.write.approve([
  ARC_USDC_ADDRESS,
  AMOUNT,
]);
await base.client.waitForTransactionReceipt({ hash: approveTx });

// deposit
console.log("Wrapping into arcUSDC...");
const depositTx = await arcUSDC.write.deposit([AMOUNT]);
await base.client.waitForTransactionReceipt({ hash: depositTx });

console.log("🎉 DONE: ETH USDC → Base arcUSDC");
process.exit(0);
