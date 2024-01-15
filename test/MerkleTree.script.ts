import { expect } from "chai";
import { ethers} from "hardhat";
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

import { MerkleTree } from 'merkletreejs'
const keccak256 = require('keccak256');

const initialSupply = ethers.utils.parseEther("1000000");

// [investor account, amount, period (in secodns), cliff (in second)]

const ZERO = 0;
const SECONDS = 60;
const MINUTES = 60 * SECONDS;
const HOUR = 60 * MINUTES;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const THREE_MONTHS = 3 * MONTH;
const SIX_MONTHS = 6 * MONTH;
const YEAR = 12 * MONTH;

const ONE_ETHER = ethers.utils.parseEther("1");
const ETHER_10 = ethers.utils.parseEther("10");
const ETHER_100 = ethers.utils.parseEther("100");
const ETHER_200 = ethers.utils.parseEther("200");
const ETHER_500 = ethers.utils.parseEther("500");
const ETHER_1000 = ethers.utils.parseEther("1000");

// [ investor account, investment, _cliff, _duration ]
const whitelistAddresses = [
    ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',ETHER_10, MONTH, SIX_MONTHS],
    ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8',ETHER_100, MONTH, 2 * MONTH],
    ['0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',ETHER_200, MONTH, 3 * MONTH],
    ['0x90F79bf6EB2c4f870365E785982E1f101E93b906',ETHER_500, MONTH, 4 * MONTH],
    ['0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',ETHER_1000, MONTH, 5 * MONTH],
    ['0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',ETHER_100, MONTH, 6 * MONTH],
    ['0x976EA74026E726554dB657fA54763abd0C3a0aa9',ETHER_100, MONTH, 7 * MONTH],
    ['0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',ETHER_200, MONTH, 8 * MONTH],
    ['0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',ETHER_500, MONTH, 9 * MONTH]
]

async function deployContracts() {
    
    const [caller, notLeaf] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy("Spot Token", "SPOT", initialSupply);

    const Vesting = await ethers.getContractFactory("TokenVesting");
    const vesting = await Vesting.deploy(token.address);

    await token.transfer(vesting.address, initialSupply);

    return { token, vesting, caller, notLeaf};
}

describe("Vesting Contract Testing", () => {
  describe("Test: Merkle Tree feature",  () => {

    it("Validate whitelist claim", async () => {
      const {vesting, caller, notLeaf} = await loadFixture(deployContracts)
      const abi = ethers.utils.defaultAbiCoder;
      
      const leafNodes = whitelistAddresses.map(addr => {
          console.log(addr[0].toString());
          console.log(addr[1]);
          console.log(addr[2]);
          console.log(addr[3]);
          let params = abi.encode(
            ["address","uint256","uint256","uint256"],
            [addr[0].toString(),addr[1],addr[2],addr[3]]); 

          return keccak256(params);            
        }
      ); 

      // Leaf nodes:
      console.log("Leaf nodes: \n", leafNodes);

      const merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true});
      
      // Merkle tree:
      console.log("Merkle tree root hash: \n", merkleTree.toString());

      let params2 = abi.encode(
            ["address","uint256","uint256","uint256"], // encode as address array
            [caller.address,ETHER_10,MONTH,SIX_MONTHS]);
      
      // Leaf hash:
      console.log("Leaf hash: \n", keccak256(params2));

      const hexProof = merkleTree.getHexProof(
          keccak256(params2)
      );
      // Hex proof
      console.log("HexProof: ", hexProof);

      await expect(vesting.whitelistClaim(hexProof,ETHER_10, MONTH, SIX_MONTHS, DAY, true)).not.to.be.reverted;
      await expect(vesting.connect(notLeaf).whitelistClaim(hexProof, ETHER_10, MONTH, SIX_MONTHS, DAY, true)).to.be.reverted;
    })
  });
});