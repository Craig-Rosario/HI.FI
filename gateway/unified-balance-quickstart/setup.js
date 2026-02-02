import "dotenv/config";
import { createPublicClient, getContract, http, erc20Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import { GatewayClient } from "./gateway-client.js";
import { gatewayWalletAbi, gatewayMinterAbi } from "./abis.js";

// Addresses that are needed across networks
const gatewayWalletAddress = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
const gatewayMinterAddress = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";
const usdcAddresses = {
  sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  avalancheFuji: "0x5425890298aed601595a70ab815c96711a31bc65",
  arc: "0x3600000000000000000000000000000000000000",
};

// Sets up a client and contracts for the given chain and account
function setup(chainName, account) {
  let chain;
  let transport;
  
  // Handle Arc Testnet (custom chain not in viem/chains)
  if (chainName === "arc") {
    chain = {
      id: 5042002,
      name: "Arc Testnet",
      network: "arc-testnet",
      nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
      rpcUrls: {
        default: { http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"] },
        public: { http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"] },
      },
    };
    transport = http(process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network");
  } else {
    chain = chains[chainName];
    // Use the flashblocks-aware RPC for Base Sepolia, otherwise use the default RPC
    transport = chainName === "baseSepolia"
      ? http("https://sepolia-preconf.base.org")
      : http();
  }
  
  const client = createPublicClient({
    chain,
    account,
    transport,
  });

  return {
    client,
    name: chain.name,
    domain: GatewayClient.DOMAINS[chainName],
    currency: chain.nativeCurrency.symbol,
    usdc: getContract({
      address: usdcAddresses[chainName],
      abi: erc20Abi,
      client,
    }),
    gatewayWallet: getContract({
      address: gatewayWalletAddress,
      abi: gatewayWalletAbi,
      client,
    }),
    gatewayMinter: getContract({
      address: gatewayMinterAddress,
      abi: gatewayMinterAbi,
      client,
    }),
  };
}

// Create an account from the private key set in .env
export const account = privateKeyToAccount(process.env.PRIVATE_KEY);
console.log(`Using account: ${account.address}`);

// Set up clients and contracts for each chain
export const ethereum = setup("sepolia", account);
export const base = setup("baseSepolia", account);
export const avalanche = setup("avalancheFuji", account);