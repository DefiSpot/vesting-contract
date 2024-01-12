import { expect } from "chai";
import { ethers} from "hardhat";
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

import { MerkleTree } from 'merkletreejs'
const keccak256 = require('keccak256');

const initialSupply = ethers.utils.parseEther("100");

const whitelistAddresses = [
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
    '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f'
]

async function deployContracts() {
    
    const [caller, notLeaf] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy("Spot Token", "SPOT", initialSupply);

    const Vesting = await ethers.getContractFactory("TokenVesting");
    const vesting = await Vesting.deploy(token.address);

    return { token, vesting, caller, notLeaf};
}

describe("Vesting Contract Testing", () => {
  describe("Test: Merkle Tree feature",  () => {
    it("Should set the right unlockTime", async () => {
      const { token, vesting, owner } = await loadFixture(deployContracts);

      expect(await token.symbol()).to.equal("SPOT");
    });

    it("Validate whitelist claim", async () => {
      const {vesting, caller, notLeaf} = await loadFixture(deployContracts)

      const leafNodes = whitelistAddresses.map(addr => keccak256(addr));
      
      const merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true});
      
      const hexProof = merkleTree.getHexProof(keccak256(caller.address));

      await expect(vesting.whitelistClaim(hexProof)).not.to.be.reverted;
      await expect(vesting.connect(notLeaf).whitelistClaim(hexProof)).to.be.reverted;
    })
  });
});