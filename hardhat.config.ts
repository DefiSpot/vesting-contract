import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage"

require("dotenv").config();
require("./tasks/faucet");
//require('solidity-coverage');

const { SEPOLIA_URL, PRIVATE_KEY, ETHERSCAN_KEY } = process.env;

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  
  networks: {
    hardhat: {
      // We set 1337 to make interacting with MetaMask simpler
      chainId: 1337
    },
    sepolia: {
      url: SEPOLIA_URL || "",
      accounts:
        PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_KEY || ""
    }
  }
};

export default config;
