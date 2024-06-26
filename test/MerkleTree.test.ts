import { expect } from "chai";
import { ethers} from "hardhat";
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

import { MerkleTree } from 'merkletreejs'

const ZERO = 0;
const MINUTES = 60;
const HOUR = 60 * MINUTES;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const THREE_MONTHS = 3 * MONTH;
const FOUR_MONTHS = 4 * MONTH;
const FIVE_MONTHS = 5 * MONTH;
const SIX_MONTHS = 6 * MONTH;
const YEAR = 12 * MONTH;

const ONE_ETHER = ethers.utils.parseEther("1");
const ETHER_10 = ethers.utils.parseEther("10");
const ETHER_20 = ethers.utils.parseEther("20");
const ETHER_50 = ethers.utils.parseEther("50");
const ETHER_100 = ethers.utils.parseEther("100");
const ETHER_200 = ethers.utils.parseEther("200");
const ETHER_500 = ethers.utils.parseEther("500");
const ETHER_1000 = ethers.utils.parseEther("1000");

const initialSupply = ETHER_100;

const abi = ethers.utils.defaultAbiCoder;

async function deployContracts() {

    const chainObj = await ethers.provider.getNetwork();
    const chainId = chainObj.chainId;

   const whitelistAddresses = [
      ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',ETHER_10,   ONE_ETHER, MONTH, SIX_MONTHS,   chainId, true],
      ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8',ETHER_200,  ETHER_20,  MONTH, FOUR_MONTHS,  chainId, false],
      ['0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',ETHER_200,  ETHER_20,  MONTH, THREE_MONTHS, chainId, true],
      ['0x90F79bf6EB2c4f870365E785982E1f101E93b906',ETHER_500,  ZERO,      MONTH, FOUR_MONTHS,  chainId, false],
      ['0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',ETHER_1000, ETHER_100, MONTH, FIVE_MONTHS,  chainId, false],
      ['0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',ETHER_100,  ETHER_10,  MONTH, SIX_MONTHS,   chainId, false],
      ['0x976EA74026E726554dB657fA54763abd0C3a0aa9',ETHER_100,  ETHER_10,  MONTH, 7 * MONTH,    chainId, false],
      ['0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',ETHER_200,  ETHER_20,  MONTH, 8 * MONTH,    chainId, false],
      ['0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',ETHER_500,  ETHER_50,  MONTH, 9 * MONTH,    chainId, false]
    ]


    
    const [owner, investor, notInvestor] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("DefispotToken");
    const token = await Token.deploy("Spot Token", "SPOT", initialSupply);

    const Vesting = await ethers.getContractFactory("TokenVesting");
    const vesting = await Vesting.deploy(token.address);

    await expect(token.grantMinterRole(vesting.address)).not.to.be.reverted;

    const leafNodes = whitelistAddresses.map(addr => {
        let params = abi.encode(
          ["address","uint256","uint256","uint256","uint256","uint256","bool"],
          [addr[0].toString(),addr[1],addr[2],addr[3],addr[4],addr[5],addr[6]]);

        return ethers.utils.keccak256(params);          
      }
    );

    const merkleTree = new MerkleTree(leafNodes, ethers.utils.keccak256, {sortPairs: true});
    
    return { chainId, token, vesting, leafNodes, merkleTree, abi, owner, investor, notInvestor};
}

describe("Vesting Contract Testing", () => {
  describe("Test: Merkle Tree feature",  () => {

    it("Should validate correct whitelist claim", async () => {
      const {chainId, vesting, leafNodes, merkleTree, abi, owner, investor, notInvestor} = await loadFixture(deployContracts)
      
      // Get valid parameters.
      const params = abi.encode(
            ["address","uint256","uint256","uint256","uint256","uint256","bool"], // encode as address array
            [investor.address,ETHER_200,ETHER_20,MONTH,FOUR_MONTHS,chainId,false]);
      
      // Compute merkle tree branch
      const hexProof = merkleTree.getHexProof(
          ethers.utils.keccak256(params)
      );
      // Validate correct information
      await expect(vesting.connect(investor).whitelistClaim(
          hexProof,ETHER_200,ETHER_20, MONTH,FOUR_MONTHS, false
      )).not.to.be.reverted;

      expect(await vesting.whitelistClaimed(investor.address)).to.be.equal(true);
    });

    it("Should validate incorrect chain Id", async () => {
      const {chainId, vesting, leafNodes, merkleTree, abi, owner, investor, notInvestor} = await loadFixture(deployContracts)
      
      const invalidChainId = 456789;

      // Get valid parameters.
      const params = abi.encode(
            ["address","uint256","uint256","uint256","uint256","uint256","bool"], // encode as address array
            [investor.address,ETHER_200,ETHER_20,MONTH,FOUR_MONTHS,invalidChainId,false]);
      
      // Compute merkle tree branch
      const hexProof = merkleTree.getHexProof(
          ethers.utils.keccak256(params)
      );
      // Validate correct information
      await expect(vesting.connect(investor).whitelistClaim(
          hexProof,ETHER_200,ETHER_20, MONTH,FOUR_MONTHS, false
      )).to.be.revertedWith("invalid proof");

      expect(await vesting.whitelistClaimed(investor.address)).to.be.equal(false);
    });

    it("Should validate correct event parameters", async () => {
      const {chainId, vesting, leafNodes, merkleTree, abi, owner, investor, notInvestor} = await loadFixture(deployContracts)
      
      // Get valid parameters.
      const params = abi.encode(
            ["address","uint256","uint256","uint256","uint256","uint256","bool"], // encode as address array
            [investor.address,ETHER_200,ETHER_20,MONTH,FOUR_MONTHS,chainId,false]);
      
      // Compute merkle tree branch
      const hexProof = merkleTree.getHexProof(
          ethers.utils.keccak256(params)
      );

      const vestingScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
          investor.address,
          0
        );

      // Validate correct information
      await expect(vesting.connect(investor).whitelistClaim(
          hexProof,ETHER_200, ETHER_20,MONTH,FOUR_MONTHS, false
      )).to.emit(vesting, "LogNewVestingSchedule")
        .withArgs(investor.address, investor.address, vestingScheduleId, 1);

      expect(await vesting.whitelistClaimed(investor.address)).to.be.equal(true);
    });

    it("Should validate that the correct amount has been minted", async () => {
      const {chainId,vesting, token, leafNodes, merkleTree, abi, owner, investor, notInvestor} = await loadFixture(deployContracts)
      
      const params = abi.encode(
            ["address","uint256","uint256","uint256","uint256","uint256","bool"], // encode as address array
            [investor.address,ETHER_200,ETHER_20,MONTH,FOUR_MONTHS,chainId,false]);
      
      const hexProof = merkleTree.getHexProof(
          ethers.utils.keccak256(params)
      );
      
      await vesting.connect(investor).whitelistClaim(
          hexProof,ETHER_200,ETHER_20,MONTH,FOUR_MONTHS,false
      );

      expect(await token.balanceOf(vesting.address)).to.be.equal(ETHER_200);
    });
    
    it("Should prevent incorrect user whitelist claim", async () => {
      const {chainId, vesting,merkleTree, abi, owner, investor, notInvestor} = await loadFixture(deployContracts)
      
      // get parameters from a valid investor. 
      const params = abi.encode(
            ["address","uint256","uint256","uint256","uint256","uint256","bool"], // encode as address array
            [investor.address,ETHER_200,ETHER_20,MONTH,FOUR_MONTHS,chainId,false]);
      
      // Compute merkle tree branch
      const hexProof = merkleTree.getHexProof(
          ethers.utils.keccak256(params)
      );

      // Incorrect user claim
      await expect(vesting.connect(notInvestor).whitelistClaim(
          hexProof, ETHER_200, ETHER_20, MONTH, FOUR_MONTHS, false)).to.be.reverted;

      expect(await vesting.whitelistClaimed(notInvestor.address)).to.be.equal(false);
    });

    it("Should prevent incorrect user parameters whitelist claim", async () => {
      const {chainId,vesting, merkleTree, abi, investor} = await loadFixture(deployContracts)
      
      // incorrect amount to claim
      const params = abi.encode(
            ["address","uint256", "uint256","uint256","uint256","uint256","bool"], // encode as address array
            [investor.address,ETHER_1000, ETHER_100, MONTH,FOUR_MONTHS,chainId,false]);
      
      // Compute merkle tree branch
      const hexProof = merkleTree.getHexProof(
          ethers.utils.keccak256(params)
      );

      // Incorrect user claim
      await expect(vesting.connect(investor).whitelistClaim(
          hexProof, ETHER_200, ETHER_20, MONTH, SIX_MONTHS, false
      )).to.be.reverted;

      expect(await vesting.whitelistClaimed(investor.address)).to.be.equal(false);
    });

    it("Should prevent to claim the tokens more than once", async () => {
      const {chainId,vesting, merkleTree, abi, investor} = await loadFixture(deployContracts)
      
      // correct amount to claim
      const params = abi.encode(
            ["address","uint256","uint256","uint256","uint256","uint256","bool"], // encode as address array
            [investor.address,ETHER_200,ETHER_20,MONTH,FOUR_MONTHS,chainId,false]);
      
      // Compute merkle tree branch
      const hexProof = merkleTree.getHexProof(
          ethers.utils.keccak256(params)
      );

      // Correct user claim
      await expect(vesting.connect(investor).whitelistClaim(
          hexProof, ETHER_200, ETHER_20, MONTH, FOUR_MONTHS, false
      )).not.to.be.reverted;

      // Second claim should fail.
      await expect(vesting.connect(investor).whitelistClaim(
          hexProof, ETHER_200, ETHER_20, MONTH, FOUR_MONTHS, false
      )).to.be.revertedWith("Address already claimed!");

      expect(await vesting.whitelistClaimed(investor.address)).to.be.equal(true);
    });

    it("Should prevent to claim tokens if _createVestingSchedule() fails!", async () => {
      const {chainId, vesting, merkleTree, abi, investor} = await loadFixture(deployContracts)
      
      // correct amount to claim
      const params = abi.encode(
            ["address","uint256","uint256", "uint256", "uint256","uint256","bool"], // encode as address array
            [investor.address,ETHER_200,ETHER_20,MONTH,FOUR_MONTHS,chainId,false]);
      
      // Compute merkle tree branch
      const hexProof = merkleTree.getHexProof(
          ethers.utils.keccak256(params)
      );

      expect(await vesting.whitelistClaimed(investor.address)).to.be.equal(false);

      // Correct execution
      await expect(vesting.connect(investor).whitelistClaim(
          hexProof, ETHER_200, ETHER_20,MONTH, FOUR_MONTHS, false
      )).not.to.be.reverted;

      expect(await vesting.whitelistClaimed(investor.address)).to.be.equal(true);
    });
    
    it("Should allow multiple investors to claim their tokens", async () => {
        const {chainId, vesting, token, merkleTree, abi} = await loadFixture(deployContracts)
        const [owner, investor0, investor1, investor2, investor3, investor4] = await ethers.getSigners();
        
        // correct amount to claim
        const params1 = abi.encode(
                ["address","uint256","uint256","uint256","uint256","uint256","bool"], // encode as address array
                [investor1.address,ETHER_200, ETHER_20, MONTH,THREE_MONTHS,chainId,true]);

        const params2 = abi.encode(
                ["address","uint256","uint256","uint256","uint256","uint256","bool"], // encode as address array
                [investor2.address,ETHER_500, ZERO, MONTH,FOUR_MONTHS,chainId,false]);

        const params3 = abi.encode(
                ["address","uint256","uint256","uint256","uint256","uint256","bool"], // encode as address array
                [investor3.address,ETHER_1000, ETHER_100, MONTH,FIVE_MONTHS,chainId,false]);

        const params4 = abi.encode(
                ["address","uint256","uint256","uint256","uint256","uint256","bool"], // encode as address array
                [investor4.address,ETHER_100, ETHER_10, MONTH,SIX_MONTHS,chainId,false]);
      
        // Compute merkle tree branch for all investors
        const hexProof1 = merkleTree.getHexProof(
            ethers.utils.keccak256(params1)
        );

        const hexProof2 = merkleTree.getHexProof(
            ethers.utils.keccak256(params2)
        );

        const hexProof3 = merkleTree.getHexProof(
            ethers.utils.keccak256(params3)
        );

        const hexProof4 = merkleTree.getHexProof(
            ethers.utils.keccak256(params4)
        );

        // Claiming tokens for several investors
        await expect(vesting.connect(investor1).whitelistClaim(
            hexProof1, ETHER_200, ETHER_20, MONTH, THREE_MONTHS, true
        )).not.to.be.reverted;

        await expect(vesting.connect(investor2).whitelistClaim(
            hexProof2, ETHER_500, ZERO, MONTH, FOUR_MONTHS, false
        )).not.to.be.reverted;

        await expect(vesting.connect(investor3).whitelistClaim(
            hexProof3, ETHER_1000, ETHER_100, MONTH, FIVE_MONTHS, false
        )).not.to.be.reverted;

        await expect(vesting.connect(investor4).whitelistClaim(
            hexProof4, ETHER_100, ETHER_10, MONTH, SIX_MONTHS, false
        )).not.to.be.reverted;

        expect(await vesting.whitelistClaimed(investor1.address)).to.be.equal(true);
        expect(await vesting.whitelistClaimed(investor2.address)).to.be.equal(true);
        expect(await vesting.whitelistClaimed(investor3.address)).to.be.equal(true);
        expect(await vesting.whitelistClaimed(investor4.address)).to.be.equal(true);

        // Validate that the total amount of tokens were minted and deposited in the 
        // vesting contract. 
        const totalTokens = ethers.utils.parseEther("1800");
        expect(await token.balanceOf(vesting.address)).to.be.equal(totalTokens);
    });
  });
});