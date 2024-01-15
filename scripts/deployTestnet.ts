import { ethers } from "hardhat";
import { BigNumber} from "ethers";
const hre = require("hardhat");
const path = require("path");

// 0xc371718C7b44aD8168887f3Ce97aDB765977dfea Rinkeby Testnet

async function main() {

  const TokenVesting = await ethers.getContractFactory("TokenVesting");
  const spotToken = "0xF493BcA6BA0c0088eD1D8257670055DF47878084";
  const tokenVesting = await TokenVesting.deploy(spotToken);
  await tokenVesting.deployed();

  console.log(tokenVesting.address, " Token Vesting address");

  saveFrontendFiles(TokenVesting);

}

function saveFrontendFiles(tokenVesting:any) {
  const fs = require("fs");
  const contractsDir = path.join(__dirname, "..", "dapp", "src", "contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    path.join(contractsDir, "contract-address.json"),
    JSON.stringify({ Token: tokenVesting.address }, undefined, 2)
  );

  const TokenVestingArtifact = hre.artifacts.readArtifactSync("TokenVesting");

  fs.writeFileSync(
    path.join(contractsDir, "TokenVesting.json"),
    JSON.stringify(TokenVestingArtifact, null, 2)
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});



