import { ethers } from "hardhat";
import { BigNumber} from "ethers";
const hre = require("hardhat");
const path = require("path");

async function main() {

  const initialSupply = ethers.utils.parseEther("100");
  const DefiSpot = await ethers.getContractFactory("DefiSpotToken");
  const defiSpot = await DefiSpot.deploy("Spot Token","SPOT", initialSupply);
  await defiSpot.deployed();

  const TokenVesting = await ethers.getContractFactory("TokenVesting");
  const tokenVesting = await TokenVesting.deploy(defiSpot.address);
  await tokenVesting.deployed();

  console.log(defiSpot.address, " Token Vesting address");
  //0xDb3182cB5082268dAd20Cf672586568A6527Ac4e

  console.log(tokenVesting.address, " Token Vesting address");
  // 0xA3eEb65B3Ee6EfE8aE0e3Bd38Be5D38Fcf39f134

  //saveFrontendFiles(DefiSpot);

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



