import { ethers } from "hardhat";
import { BigNumber } from "ethers";

async function main() {

  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy("Token Test", "TKN",  1 * 1e6);
  
  const TokenVesting = await ethers.getContractFactory("TokenVesting");
  const tokenVesting = await TokenVesting.deploy(token.address);

  await tokenVesting.deployed();

  console.log(token.address, " Token address");
  console.log(tokenVesting.address, " Token Vesting address");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
