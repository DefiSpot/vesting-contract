import { ethers } from "hardhat";
import { BigNumber} from "ethers";
const hre = require("hardhat");
const path = require("path");

async function main() {

  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy("Token Test", "TKN",  1 * 1e6);
  await token.deployed();

  const TokenVesting = await ethers.getContractFactory("TokenVesting");
  const tokenVesting = await TokenVesting.deploy(token.address);
  await tokenVesting.deployed();

  console.log(token.address, " Token address");
  console.log(tokenVesting.address, " Token Vesting address");

  saveFrontendFiles(token);

}

function saveFrontendFiles(token:any) {
  const fs = require("fs");
  const contractsDir = path.join(__dirname, "..", "dapp", "src", "contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    path.join(contractsDir, "contract-address.json"),
    JSON.stringify({ Token: token.address }, undefined, 2)
  );

  const TokenArtifact = hre.artifacts.readArtifactSync("Token");

  fs.writeFileSync(
    path.join(contractsDir, "Token.json"),
    JSON.stringify(TokenArtifact, null, 2)
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});



