import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

require("dotenv").config();
require("./tasks/faucet");

const { RINKEBY_URL, PRIVATE_KEY } = process.env;

const config: HardhatUserConfig = {
  solidity: "0.8.16",
  
  networks: {
    hardhat: {
      chainId: 1337 // We set 1337 to make interacting with MetaMask simpler
    },
    sepholia: {
      url: RINKEBY_URL || "",
      accounts:
        PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      rinkeby: "K65MVS5BV4QXWYQEZE78IRRF5SG5TSND7C"
    }
  }
};

export default config;
