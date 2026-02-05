import "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

export default {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
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
    },
    "base-sepolia": {
      type: "http",
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
<<<<<<< Updated upstream
        : process.env.BASE_SEPOLIA_PRIVATE_KEY
          ? [process.env.BASE_SEPOLIA_PRIVATE_KEY]
          : []
=======
        : []
>>>>>>> Stashed changes
    }
  }
};
