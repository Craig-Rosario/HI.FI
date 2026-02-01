import { account, ethereum, base } from "./setup.js";
import { GatewayClient } from "./gateway-client.js";
import { burnIntent, burnIntentTypedData } from "./typed-data.js";

// Initialize Gateway API client
const gatewayClient = new GatewayClient();

// Amount of USDC to move
const AMOUNT = 2; // USDC

console.log("Checking Gateway balances...");
const { balances } = await gatewayClient.balances("USDC", account.address);

const ethereumBalance = balances.find(
  (b) => b.domain === ethereum.domain
)?.balance;

console.log(`Ethereum unified balance: ${ethereumBalance} USDC`);

if (!ethereumBalance || parseFloat(ethereumBalance) < AMOUNT) {
  console.error("Not enough unified balance on Ethereum");
  process.exit(1);
}

// Construct burn intent
console.log("Constructing burn intent...");
const intent = burnIntent({
  account,
  from: ethereum,
  to: base,
  amount: AMOUNT,
  recipient: account.address,
});

// Sign burn intent
console.log("Signing burn intent...");
const typedData = burnIntentTypedData(intent);
const signature = await account.signTypedData(typedData);

// Request attestation from Gateway
console.log("Requesting attestation from Gateway API...");
const start = performance.now();
const response = await gatewayClient.transfer([
  { burnIntent: typedData.message, signature },
]);
const end = performance.now();

if (response.success === false) {
  console.error("Gateway API error:", response.message);
  process.exit(1);
}

console.log(
  "Attestation received in",
  (end - start).toFixed(2),
  "ms",
);

// Mint on Base Sepolia
console.log("Minting USDC on Base...");
const mintTx = await base.gatewayMinter.write.gatewayMint([
  response.attestation,
  response.signature,
]);

await base.client.waitForTransactionReceipt({ hash: mintTx });

console.log("✅ Mint complete");
console.log("Mint tx hash:", mintTx);

process.exit(0);
