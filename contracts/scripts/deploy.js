const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error("No deployer account found. Please check your contracts/.env file and ensure PRIVATE_KEY or SEPOLIA_PRIVATE_KEY is set.");
  }

  console.log("Deploying contracts with the account:", deployer.address);

  // Constants for Sepolia (Testnet)
  // Source: Circle Docs & Uniswap V4 Docs
  const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC (Circle/Chainlink)
  const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543"; // Uniswap V4 PoolManager
  const CCTP_MESSENGER = "0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A"; // Circle CCTP TokenMessenger
  const LOCAL_DOMAIN = 0; // Ethereum Sepolia Domain ID (0 for Eth)

  // 1. Deploy Agent Registry
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  console.log("AgentRegistry deployed to:", registry.target);

  // 2. Deploy DepositRouter
  const DepositRouter = await hre.ethers.getContractFactory("DepositRouter");
  const router = await DepositRouter.deploy(
    USDC_ADDRESS,
    POOL_MANAGER,
    CCTP_MESSENGER,
    LOCAL_DOMAIN
  );
  await router.waitForDeployment();
  console.log("DepositRouter deployed to:", router.target);

  // 3. Deploy Vault (USDC)
  const Vault = await hre.ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(
    USDC_ADDRESS,
    "HI.FI USDC Vault",
    "hUSDC",
    registry.target
  );
  await vault.waitForDeployment();
  console.log("Vault deployed to:", vault.target);

  // 4. Deploy Strategy (Uniswap V4)
  // Need a pool key. Providing dummy for now or specific one.
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const poolKey = {
    currency0: zeroAddress,
    currency1: zeroAddress,
    fee: 3000,
    tickSpacing: 60,
    hooks: zeroAddress
  };

  const UniswapV4Strategy = await hre.ethers.getContractFactory("UniswapV4Strategy");
  const strategy = await UniswapV4Strategy.deploy(
    vault.target,
    USDC_ADDRESS,
    POOL_MANAGER,
    poolKey
  );
  await strategy.waitForDeployment();
  console.log("UniswapV4Strategy deployed to:", strategy.target);

  // 5. Setup Permissions
  // Add deployer as agent for testing
  await registry.addAgent(deployer.address);
  console.log("Added deployer as Agent");

  // Whitelist Strategy in Vault
  await vault.setStrategyWhitelist(strategy.target, true);
  console.log("Whitelisted Strategy in Vault");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
