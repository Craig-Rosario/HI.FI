import { account } from "./setup.js";
import { GatewayClient } from "./gateway-client.js";

const client = new GatewayClient();

console.log(`Checking Gateway balance for: ${account.address}`);

const response = await client.balances("USDC", account.address);

console.log("Gateway balances:");
for (const b of response.balances) {
  console.log(`- Domain ${b.domain}: ${b.balance} USDC`);
}
