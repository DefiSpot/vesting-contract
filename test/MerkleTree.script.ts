import { expect } from "chai";
import { ethers} from "hardhat";
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

import { MerkleTree } from 'merkletreejs'
//const keccak256 = require('keccak256');

const initialSupply = ethers.utils.parseEther("100");

// [investor account, amount, period (in secodns), cliff (in second)]

const ZERO = 0;
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const THREE_MONTHS = 3 * MONTH;
const FOUR_MONTHS = 4 * MONTH;
const FIVE_MONTHS = 5 * MONTH;
const SIX_MONTHS = 6 * MONTH;
const YEAR = 12 * MONTH;

const ONE_ETHER = ethers.utils.parseEther("1");
const ETHER_10 = ethers.utils.parseEther("10");
const ETHER_100 = ethers.utils.parseEther("100");
const ETHER_200 = ethers.utils.parseEther("200");
const ETHER_500 = ethers.utils.parseEther("500");
const ETHER_1000 = ethers.utils.parseEther("1000");

async function deployContracts() {
    const [owner, leaf, notLeaf] = await ethers.getSigners();

    const chainObj = await ethers.provider.getNetwork();
    const chainId = chainObj.chainId;

    const whitelistAddresses = [
      ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',ETHER_10, MONTH, SIX_MONTHS, chainId, true],
      ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8',ETHER_200, MONTH, FOUR_MONTHS, chainId, false],
      ['0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',ETHER_200, MONTH, THREE_MONTHS, chainId, true],
      ['0x90F79bf6EB2c4f870365E785982E1f101E93b906',ETHER_500, MONTH, FOUR_MONTHS, chainId, false],
      ['0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',ETHER_1000, MONTH, FIVE_MONTHS, chainId, false],
      ['0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',ETHER_100, MONTH, SIX_MONTHS, chainId, false],
      ['0x976EA74026E726554dB657fA54763abd0C3a0aa9',ETHER_100, MONTH, 7 * MONTH, chainId, false],
      ['0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',ETHER_200, MONTH, 8 * MONTH, chainId, false],
      ['0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',ETHER_500, MONTH, 9 * MONTH, chainId, false]
    ]

    const Token = await ethers.getContractFactory("DefispotToken");
    const token = await Token.deploy("Spot Token", "SPOT", initialSupply);

    const Vesting = await ethers.getContractFactory("TokenVesting");
    const vesting = await Vesting.deploy(token.address);

    await token.transfer(vesting.address, initialSupply);

    return { token, vesting, leaf, notLeaf, whitelistAddresses};
}

describe("Vesting Contract Testing", () => {
  describe("Test: Merkle Tree feature",  () => {

    it("Validate whitelist claim", async () => {
      const {vesting, leaf, token, notLeaf, whitelistAddresses} = await loadFixture(deployContracts)

      await expect(token.grantMinterRole(vesting.address)).not.to.be.reverted;

      const abi = ethers.utils.defaultAbiCoder;
      //type User = { id: number; name: string /* and others */ }

      const leafNodes = whitelistAddresses.map((addr: any) => {
          console.log(addr[0].toString());
          console.log(addr[1]);
          console.log(addr[2]);
          console.log(addr[3]);
          console.log(addr[4]);
          console.log(addr[5]);
          let params = abi.encode(
            ["address","uint256","uint256","uint256","uint256", "bool"],
            [addr[0].toString(),addr[1],addr[2],addr[3],addr[4],addr[5]]); 

          return ethers.utils.keccak256(params);            
        }
      ); 

      // Leaf nodes:
      console.log("Leaf nodes: \n", leafNodes);

      const merkleTree = new MerkleTree(leafNodes, ethers.utils.keccak256, {sortPairs: true});
      
      // Merkle tree:
      console.log("Merkle tree root hash: \n", merkleTree.toString());

      const chainObj = await ethers.provider.getNetwork();
      const chainId = chainObj.chainId;

      console.log("leaf address: ", leaf.address);
      let params2 = abi.encode(
            ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
            [leaf.address,ETHER_200,MONTH,FOUR_MONTHS,chainId,false]);
      
      // Leaf hash:
      console.log("Leaf hash: \n", ethers.utils.keccak256(params2));

      const hexProof = merkleTree.getHexProof(
          ethers.utils.keccak256(params2)
      );
      // Hex proof
      console.log("HexProof: ", hexProof);

      await expect(vesting.connect(leaf).whitelistClaim(hexProof,ETHER_200, MONTH, FOUR_MONTHS, false)).not.to.be.reverted;
      await expect(vesting.connect(notLeaf).whitelistClaim(hexProof, ETHER_200, MONTH, FOUR_MONTHS, true)).to.be.reverted;
    })
  });
});