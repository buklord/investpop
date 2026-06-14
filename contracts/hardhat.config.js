require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env.local" });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // BSC Mainnet
    bsc: {
      url: "https://bsc-dataseed1.binance.org/",
      chainId: 56,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    // BSC Testnet (for testing before mainnet)
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
    },
  },
};
