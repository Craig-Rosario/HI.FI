require("@nomicfoundation/hardhat-ethers");
require("dotenv").config({ path: __dirname + "/.env" });

module.exports = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      forking: {
        url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      }
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: (process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY) ? [process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY] : [],
    },
    sepolia: {
      url: "https://ethereum-sepolia.publicnode.com",
      accounts: (process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY) ? [process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY] : [],
    }
  },
};
