import "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

export default {
  solidity: "0.8.28",
  networks: {
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545"
    },
    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.SEPOLIA_PRIVATE_KEY
        ? [process.env.SEPOLIA_PRIVATE_KEY]
        : []
    }
  }
};
