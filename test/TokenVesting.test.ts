import { expect } from "chai";
import { ethers} from "hardhat";
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

import { MerkleTree } from 'merkletreejs'

const ZERO = 0;
const MINUTE = 60; // Check this
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const THREE_MONTHS = 3 * MONTH;
const FOUR_MONTHS = 4 * MONTH;
const FIVE_MONTHS = 5 * MONTH;
const SIX_MONTHS = 6 * MONTH;
const YEAR = 12 * MONTH;
const startTime = 150;

const ONE_ETHER = ethers.utils.parseEther("1");
const ETHER_10 = ethers.utils.parseEther("10");
const ETHER_50 = ethers.utils.parseEther("50");
const ETHER_100 = ethers.utils.parseEther("100");
const ETHER_150 = ethers.utils.parseEther("150");
const ETHER_200 = ethers.utils.parseEther("200");
const ETHER_350 = ethers.utils.parseEther("350");
const ETHER_400 = ethers.utils.parseEther("400");
const ETHER_500 = ethers.utils.parseEther("500");
const ETHER_1000 = ethers.utils.parseEther("1000");

const initialSupply = ETHER_100;

const abi = ethers.utils.defaultAbiCoder;

async function deployContracts() {
    const chainObj = await ethers.provider.getNetwork();
    const chainId = chainObj.chainId;
    // [investor account, amount, period (in secodns), cliff (in second), chainId,revokable]
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
    
    const [owner, investor, investorRevokable] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("DefispotToken");
    const token = await Token.deploy("Spot Token", "SPOT", initialSupply);

    // We use the MockTokenVesting contract for testing purposes only.
    const Vesting = await ethers.getContractFactory("MockTokenVesting");
    const vesting = await Vesting.deploy(token.address);

    await expect(token.grantMinterRole(vesting.address)).not.to.be.reverted;

    const leafNodes = whitelistAddresses.map(addr => {
        let params = abi.encode(
          ["address","uint256","uint256","uint256","uint256","bool"],
          [addr[0].toString(),addr[1],addr[2],addr[3],addr[4],addr[5]]);

        return ethers.utils.keccak256(params);            
      }
    );

    // Get valid parameters.
    const params = abi.encode(
        ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
        [investor.address,ETHER_200,MONTH,FOUR_MONTHS,chainId,false]);
    
    const merkleTree = new MerkleTree(leafNodes, ethers.utils.keccak256, {sortPairs: true});
    
    // Compute merkle tree branch
    const hexProof = merkleTree.getHexProof(
        ethers.utils.keccak256(params)
    );

    await vesting.setCurrentTime(startTime);

    // Validate correct information
      await expect(vesting.connect(investor).whitelistClaim(
          hexProof,ETHER_200, MONTH,FOUR_MONTHS, false
      )).not.to.be.reverted;   

    expect(await vesting.whitelistClaimed(investor.address)).to.be.equal(true);

    //*********

    
    const params2 = abi.encode(
                ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
                [investorRevokable.address,ETHER_200,MONTH,THREE_MONTHS,chainId,true]);
    
    // Compute merkle tree branch
    const hexProof2 = merkleTree.getHexProof(
        ethers.utils.keccak256(params2)
    );
    
    await expect(vesting.connect(investorRevokable).whitelistClaim(
            hexProof2, ETHER_200, MONTH,THREE_MONTHS, true
        )).not.to.be.reverted;

    await vesting.setCurrentTime(startTime);

    expect(await vesting.whitelistClaimed(investorRevokable.address)).to.be.equal(true);
    
    return { owner, token, vesting, merkleTree, abi,chainId, leafNodes, hexProof, investor, investorRevokable};
}

describe("Vesting Contract Testing", () => {
   describe("Test: Token vesting features using whitelist",  () => {
        it("Should validate the contract owner ", async () => {
            const {vesting, owner} = await loadFixture(deployContracts)

            expect(await vesting.owner()).to.be.equal(owner.address);
        });

        it("Should validate the token address", async () => {
            const {vesting, token, investor} = await loadFixture(deployContracts)

            expect(await vesting.getToken()).to.be.equal(token.address);
        });

        it("Should validate a correct vested amount", async () => {
            const {vesting, token, investor} = await loadFixture(deployContracts)
            
            expect(await vesting.getVestingSchedulesTotalAmount()).to.be.equal(ETHER_400);
            expect(await token.balanceOf(vesting.address));
        });

        it("Should validate the total amount of vesting schedules count", async () => {
            const {vesting} = await loadFixture(deployContracts)

            expect(await vesting.getVestingSchedulesCount()).to.be.equal(2);
        });

        it("Should validate the total amount of vesting schedules by beneficiary", async () => {
            const {vesting, investor} = await loadFixture(deployContracts)

            expect(await vesting.getVestingSchedulesCountByBeneficiary(investor.address)).to.be.equal(1);
        });

        it("Should validate that withdrawable amount is equal to zero after scheduling", async () => {
            const {vesting, investor} = await loadFixture(deployContracts)

            expect(await vesting.getWithdrawableAmount()).to.be.equal(ZERO);
        });

        it("Should validate the new vesting schedule log", async () => {
            const {vesting, token, merkleTree, abi} = await loadFixture(deployContracts)
            const [owner, investor, investor1, investor2] = await ethers.getSigners();

            const chainObj = await ethers.provider.getNetwork();
            const chainId = chainObj.chainId;
            
            const params2 = abi.encode(
                    ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
                    [investor2.address,ETHER_500,MONTH,FOUR_MONTHS,chainId,false]);
                        
            const hexProof2 = merkleTree.getHexProof(
                ethers.utils.keccak256(params2)
            );

            expect(await vesting.getVestingSchedulesCount()).to.be.equal(2);
            expect(await vesting.getVestingSchedulesTotalAmount()).to.be.equal(ETHER_400);
            expect(await vesting.getVestingSchedulesCountByBeneficiary(investor2.address)).to.be.equal(ZERO);

            let nextId = await vesting.computeNextVestingScheduleIdForHolder(investor2.address)
            await expect(vesting.connect(investor2).whitelistClaim(
                    hexProof2, ETHER_500, MONTH, FOUR_MONTHS, false
                ))
                .to.emit(vesting, "LogNewVestingSchedule")
                .withArgs(investor2.address, investor2.address, nextId, 1);

             expect(await vesting.getVestingSchedulesCount()).to.be.equal(3);
            expect(await vesting.getVestingSchedulesTotalAmount()).to.be.equal(ethers.utils.parseEther("900"));
            expect(await vesting.getVestingSchedulesCountByBeneficiary(investor2.address)).to.be.equal(1);
            
            expect(await vesting.whitelistClaimed(investor2.address)).to.be.equal(true);
            
            expect(await vesting.getWithdrawableAmount()).to.be.equal(ZERO);

        });

        it("Should validate multiple amounts from several investors", async () => {
            const {vesting, token, merkleTree, abi} = await loadFixture(deployContracts)
            const [owner, investor, investor1, investor2, investor3, investor4] = await ethers.getSigners();
            
            const chainObj = await ethers.provider.getNetwork();
            const chainId = chainObj.chainId;
            // correct amount to claim
            /*const params1 = abi.encode(
                    ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
                    [investor1.address,ETHER_200,MONTH,THREE_MONTHS,chainId,true]); */

            const params2 = abi.encode(
                    ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
                    [investor2.address,ETHER_500,MONTH,FOUR_MONTHS,chainId,false]);

            const params3 = abi.encode(
                    ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
                    [investor3.address,ETHER_1000,MONTH,FIVE_MONTHS,chainId,false]);

            const params4 = abi.encode(
                    ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
                    [investor4.address,ETHER_100,MONTH,SIX_MONTHS,chainId,false]);
        
            // Compute merkle tree branch for all investors
            /*const hexProof1 = merkleTree.getHexProof(
                ethers.utils.keccak256(params1)
            ); */

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
            /*await expect(vesting.connect(investor1).whitelistClaim(
                hexProof1, ETHER_200, MONTH, THREE_MONTHS, true
            )).not.to.be.reverted; */

            expect(await vesting.getVestingSchedulesCount()).to.be.equal(2);
            expect(await vesting.getVestingSchedulesTotalAmount()).to.be.equal(ethers.utils.parseEther("400"));
            expect(await vesting.getVestingSchedulesCountByBeneficiary(investor1.address)).to.be.equal(1);

            await expect(vesting.connect(investor2).whitelistClaim(
                hexProof2, ETHER_500, MONTH, FOUR_MONTHS, false
            )).not.to.be.reverted;

            expect(await vesting.getVestingSchedulesCount()).to.be.equal(3);
            expect(await vesting.getVestingSchedulesTotalAmount()).to.be.equal(ethers.utils.parseEther("900"));
            expect(await vesting.getVestingSchedulesCountByBeneficiary(investor2.address)).to.be.equal(1);

            await expect(vesting.connect(investor3).whitelistClaim(
                hexProof3, ETHER_1000, MONTH, FIVE_MONTHS, false
            )).not.to.be.reverted;

            expect(await vesting.getVestingSchedulesCount()).to.be.equal(4);
            expect(await vesting.getVestingSchedulesTotalAmount()).to.be.equal(ethers.utils.parseEther("1900"));
            expect(await vesting.getVestingSchedulesCountByBeneficiary(investor3.address)).to.be.equal(1);

            await expect(vesting.connect(investor4).whitelistClaim(
                hexProof4, ETHER_100, MONTH, SIX_MONTHS, false
            )).not.to.be.reverted;

            expect(await vesting.getVestingSchedulesCount()).to.be.equal(5);
            expect(await vesting.getVestingSchedulesTotalAmount()).to.be.equal(ethers.utils.parseEther("2000"));
            expect(await vesting.getVestingSchedulesCountByBeneficiary(investor4.address)).to.be.equal(1);

            expect(await vesting.whitelistClaimed(investor1.address)).to.be.equal(true);
            expect(await vesting.whitelistClaimed(investor2.address)).to.be.equal(true);        
            expect(await vesting.whitelistClaimed(investor3.address)).to.be.equal(true);
            expect(await vesting.whitelistClaimed(investor4.address)).to.be.equal(true);

            expect(await vesting.getWithdrawableAmount()).to.be.equal(ZERO);
            
        }); 

        it("Should validate the vesting schedule Id computation", async () => {
            const {vesting, investor} = await loadFixture(deployContracts)
            
            const vestingScheduleForAddressAtIndex = await vesting.computeVestingScheduleIdForAddressAndIndex(investor.address, 0);
            const vestingScheduleAtIndex = await vesting.getVestingIdAtIndex(0);

            expect(vestingScheduleForAddressAtIndex).to.be.equal(vestingScheduleAtIndex);
    
        });

            //getVestingSchedule
        it("Should validate the vesting schedule properties", async () => {
            const {vesting, investor} = await loadFixture(deployContracts)

            const vestingSchedule = await vesting.getVestingIdAtIndex(0);
            const vestingStruct = await vesting.getVestingSchedule(vestingSchedule);

            const cliffTime = MONTH + startTime;

            expect(vestingStruct.beneficiary).to.be.equal(investor.address);
            expect(vestingStruct.cliff).to.be.equal(cliffTime);
            expect(vestingStruct.start).to.be.equal(startTime);
            expect(vestingStruct.duration).to.be.equal(FOUR_MONTHS);
            expect(vestingStruct.slicePeriodSeconds).to.be.equal(DAY);
            expect(vestingStruct.amountTotal).to.be.equal(ETHER_200);
            expect(vestingStruct.released).to.be.equal(ZERO);
            expect(vestingStruct.initialized).to.be.equal(true);
            expect(vestingStruct.revocable).to.be.equal(false);
            expect(vestingStruct.revoked).to.be.equal(false);
        });

        it("Should validate the cliff considering the starting time", async () => {
            const {vesting, investor} = await loadFixture(deployContracts)

            const vestingSchedule = await vesting.getVestingIdAtIndex(0);
            const vestingStruct = await vesting.getVestingSchedule(vestingSchedule);
            
            const cliffTime = MONTH + startTime;
            expect(vestingStruct.cliff).to.be.equal(cliffTime);
        });

        it("Should validate that only the owner can revoke a vesting schedule", async () => {
            const {vesting, investor} = await loadFixture(deployContracts)

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            
            await expect(vesting.connect(investor).revoke(vestingScheduleId))
            .to.be.revertedWithCustomError(vesting,`OwnableUnauthorizedAccount`);
        });

        it("Should allow the owner to revoke a vesting schedule", async () => {
            const {vesting, investorRevokable,leafNodes, chainId} = await loadFixture(deployContracts)

            const vestingScheduleId = await vesting.getVestingIdAtIndex(1);
            
            await expect(vesting.revoke(vestingScheduleId)).not.to.be.reverted;

            const newVestingStruct = await vesting.getVestingSchedule(vestingScheduleId);
            expect(newVestingStruct.revoked).to.be.equal(true);
        });

        it("Should validate the amount vested after revoking a vesting schedule", async () => {
            const {vesting, investor} = await loadFixture(deployContracts)

            const vestingScheduleId = await vesting.getVestingIdAtIndex(1);

            const vestedAmountBefore = await vesting.getVestingSchedulesTotalAmount();
            expect(vestedAmountBefore).to.be.equal(ETHER_400);

            await expect(vesting.revoke(vestingScheduleId)).not.to.be.reverted;

            const vestedAmountAfter = await vesting.getVestingSchedulesTotalAmount();
            expect(vestedAmountAfter).to.be.equal(ETHER_200);
        });

        it("Should validate the withdrawable amount after revoking a vesting schedule", async () => {
            const {vesting, investor} = await loadFixture(deployContracts)

            const vestingScheduleId = await vesting.getVestingIdAtIndex(1);

            const amountBefore = await vesting.getWithdrawableAmount();
            expect(amountBefore).to.be.equal(0);

            await expect(vesting.revoke(vestingScheduleId)).not.to.be.reverted;

            const amountAfter = await vesting.getWithdrawableAmount();
            expect(amountAfter).to.be.equal(ETHER_200);
        });

        it("Should allow the contract owner to withdraw the withdrawable amount", async () => {
            const {owner, vesting, token, investor} = await loadFixture(deployContracts)

            const vestingScheduleId = await vesting.getVestingIdAtIndex(1);

            await expect(vesting.revoke(vestingScheduleId)).not.to.be.reverted;

            await expect(vesting.connect(owner).withdraw(ETHER_200))
                .to.changeTokenBalance(token, owner, ETHER_200);
        });

        it("Should allow to withdraw a portion of the withdrawable amount after revoking", async () => {
            const {owner, vesting, token, investor} = await loadFixture(deployContracts)

            const vestingScheduleId = await vesting.getVestingIdAtIndex(1);

            await expect(vesting.revoke(vestingScheduleId)).not.to.be.reverted;

            await expect(vesting.connect(owner).withdraw(ETHER_10))
                .to.changeTokenBalance(token, owner, ETHER_10);

            const amountAfter = await vesting.getWithdrawableAmount();
            expect(amountAfter).to.be.equal(ethers.utils.parseEther('190'));
        });
    });

    describe("Test: Validate vesting schedule release funds when period ends",  () => { 
        it("Should validate the releasable amount when period ends", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + FOUR_MONTHS);

            const amount = await vesting.computeReleasableAmount(vestingScheduleId);

            expect(amount).to.be.equal(ETHER_200);

        });

        it("Should allow to claim all tokens when period ends", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);

            await vesting.setCurrentTime(startTime + FOUR_MONTHS);

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_200))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_200]
                )

            expect(await token.balanceOf(investor.address)).to.be.equal(ETHER_200);
        });

        it("Should allow the contract owner to claim all tokens on behalf the investor", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);

            await vesting.setCurrentTime(startTime + FOUR_MONTHS);

            await expect(vesting.connect(owner).release(vestingScheduleId, ETHER_200))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_200]
                )

            expect(await token.balanceOf(investor.address)).to.be.equal(ETHER_200);
        });

        it("Should not allow other accouts to claim all tokens on behalf the investor", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);
            const accounts = await ethers.getSigners();

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);

            await vesting.setCurrentTime(startTime + FOUR_MONTHS);

            await expect(vesting.connect(accounts[10]).release(vestingScheduleId, ETHER_100))
                .to.be.revertedWith("only beneficiary and owner!");

            expect(await token.balanceOf(investor.address)).to.be.equal(ZERO);
        });

        it("Should allow the investor to release part of the tokens", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);
            const accounts = await ethers.getSigners();

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + FOUR_MONTHS);

            await expect(vesting.connect(owner).release(vestingScheduleId, ETHER_10))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_10]
                );

            expect(await token.balanceOf(investor.address)).to.be.equal(ETHER_10);
            expect(await token.balanceOf(vesting.address)).to.be.equal(ethers.utils.parseEther('390'));
        });

        it("Should not be able to release more than once", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + FOUR_MONTHS);

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_200))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_200]
                );

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_200))
                .to.be.rejectedWith("cannot release tokens!");

            await expect(vesting.connect(investor).release(vestingScheduleId, 1))
                .to.be.rejectedWith("cannot release tokens!");
        });

        it("Should not be able to release more than vested even in parts", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + FOUR_MONTHS);

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_100))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_100]
                );

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_200))
                .to.be.rejectedWith("cannot release tokens!");

            expect(await vesting.computeReleasableAmount(vestingScheduleId)).to.be.equal(ETHER_100);
        });

        // Should not be able to release if revoked even after period ends.
        it("Should not be able to release if revoked even after period ends.", async () => {
            const {owner, vesting, investor, investorRevokable, token} = await loadFixture(deployContracts);
            
            const vestingScheduleId = await vesting.getVestingIdAtIndex(1);
            await expect(vesting.revoke(vestingScheduleId)).not.to.be.reverted;

            await vesting.setCurrentTime(startTime + FOUR_MONTHS);

            await expect(vesting.connect(owner).release(vestingScheduleId, ETHER_200))
                .to.be.revertedWith("vesting schedule revoked!");

            expect(await token.balanceOf(investorRevokable.address)).to.be.equal(ZERO);
            expect(await token.balanceOf(vesting.address)).to.be.equal(ETHER_400);
        });

        it("Should allow several investors to release their tokens after period ends", async () => {
            const {vesting, merkleTree, investor, token} = await loadFixture(deployContracts);
            const [owner, investor0, investor1, investor2, investor3, investor4] = await ethers.getSigners();

            const chainObj = await ethers.provider.getNetwork();
            const chainId = chainObj.chainId;

            // correct amount to claim
            /*const params1 = abi.encode(
                    ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
                    [investor1.address,ETHER_200,MONTH,THREE_MONTHS,chainId,false]);*/

            const params2 = abi.encode(
                    ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
                    [investor2.address,ETHER_500,MONTH,FOUR_MONTHS,chainId,false]);

            const params3 = abi.encode(
                    ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
                    [investor3.address,ETHER_1000,MONTH,FIVE_MONTHS,chainId,false]);

            const params4 = abi.encode(
                    ["address","uint256","uint256","uint256","uint256","bool"], // encode as address array
                    [investor4.address,ETHER_100,MONTH,SIX_MONTHS,chainId,false]);
        
            // Compute merkle tree branch for all investors
            /*const hexProof1 = merkleTree.getHexProof(
                ethers.utils.keccak256(params1)
            );*/

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
            /*await expect(vesting.connect(investor1).whitelistClaim(
                hexProof1, ETHER_200, MONTH, THREE_MONTHS, false
            )).not.to.be.reverted;*/

            await expect(vesting.connect(investor2).whitelistClaim(
                hexProof2, ETHER_500, MONTH, FOUR_MONTHS, false
            )).not.to.be.reverted;

            await expect(vesting.connect(investor3).whitelistClaim(
                hexProof3, ETHER_1000, MONTH, FIVE_MONTHS, false
            )).not.to.be.reverted;


            await expect(vesting.connect(investor4).whitelistClaim(
                hexProof4, ETHER_100, MONTH, SIX_MONTHS, false
            )).not.to.be.reverted;


            const vestingScheduleId_1 = await vesting.getVestingIdAtIndex(1);
            await vesting.setCurrentTime(startTime + THREE_MONTHS);

            await expect(vesting.connect(investor1).release(vestingScheduleId_1, ETHER_200))
                .to.changeTokenBalances(
                    token,
                    [investor1],
                    [ETHER_200]
                );
                

            const vestingScheduleId_2 = await vesting.getVestingIdAtIndex(2);
            await vesting.setCurrentTime(startTime + FOUR_MONTHS);

            await expect(vesting.connect(investor2).release(vestingScheduleId_2, ETHER_500))
                .to.changeTokenBalances(
                    token,
                    [investor2],
                    [ETHER_500]
                );

            const vestingScheduleId_3 = await vesting.getVestingIdAtIndex(3);
            await vesting.setCurrentTime(startTime + FIVE_MONTHS);

             await expect(vesting.connect(investor3).release(vestingScheduleId_3, ETHER_1000))
                .to.changeTokenBalances(
                    token,
                    [investor3],
                    [ETHER_1000]
                );

            const vestingScheduleId_4 = await vesting.getVestingIdAtIndex(4);
            await vesting.setCurrentTime(startTime + SIX_MONTHS);

             await expect(vesting.connect(investor4).release(vestingScheduleId_4, ETHER_100))
                .to.changeTokenBalances(
                    token,
                    [investor4],
                    [ETHER_100]
                );
            
            expect(await vesting.getWithdrawableAmount()).to.be.equal(ZERO);
        })

    });

    describe("Test: Validate vesting schedule release funds when CLIFF ends",  () => { 
        it("Should validate the releasable amount when cliff ends", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + MONTH);
            const amount = await vesting.computeReleasableAmount(vestingScheduleId);

            expect(amount).to.be.equal(ETHER_50);
        });

        it("Should not allow to release tokens before cliff ends", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + MONTH - 1);
            
            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_50))
                .to.be.revertedWith("cannot release tokens!");
                
            expect(await token.balanceOf(investor.address)).to.be.equal(ZERO);
            expect(await token.balanceOf(vesting.address)).to.be.equal(ETHER_400);
        });

        it("Should validate releasable amount of tokens equal zero before cliff ends", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + MONTH - 1);
            const amount = await vesting.computeReleasableAmount(vestingScheduleId);

            expect(amount).to.be.equal(ZERO);
        });

        it("Should allow to claim a portion of tokens when cliff ends", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);

            await vesting.setCurrentTime(startTime + MONTH);

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_50))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_50]
                )

            expect(await token.balanceOf(investor.address)).to.be.equal(ETHER_50);
            expect(await token.balanceOf(vesting.address)).to.be.equal(ETHER_350);
        });

         it("Should allow the contract owner to claim a portion tokens on behalf the investor", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);

            await vesting.setCurrentTime(startTime + MONTH);

            await expect(vesting.connect(owner).release(vestingScheduleId, ETHER_50))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_50]
                )

            expect(await token.balanceOf(investor.address)).to.be.equal(ETHER_50);
            expect(await token.balanceOf(vesting.address)).to.be.equal(ETHER_350);
        });

        it("Should allow the investor to release part of the tokens", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);
            const accounts = await ethers.getSigners();

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + MONTH);

            await expect(vesting.connect(owner).release(vestingScheduleId, ETHER_10))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_10]
                );

            expect(await token.balanceOf(investor.address)).to.be.equal(ETHER_10);
            expect(await token.balanceOf(vesting.address)).to.be.equal(ethers.utils.parseEther('390'));
        });

        it("Should not be able to release more than once after cliff ends", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + MONTH);

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_50))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_50]
                );

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_50))
                .to.be.rejectedWith("cannot release tokens!");

            await expect(vesting.connect(investor).release(vestingScheduleId, 1))
                .to.be.rejectedWith("cannot release tokens!");
        });

        it("Should not allow other accouts to claim a portion of tokens on behalf the investor", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);
            const accounts = await ethers.getSigners();

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);

            await vesting.setCurrentTime(startTime + MONTH);

            await expect(vesting.connect(accounts[10]).release(vestingScheduleId, ETHER_50))
                .to.be.revertedWith("only beneficiary and owner!");

            expect(await token.balanceOf(investor.address)).to.be.equal(ZERO);
            expect(await token.balanceOf(vesting.address)).to.be.equal(ETHER_400);
        });

        it("Should not be able to release more than vested even when cliff ends", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);

            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + MONTH);

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_10))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_10]
                );

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_50))
                .to.be.rejectedWith("cannot release tokens!");

            expect(await vesting.computeReleasableAmount(vestingScheduleId))
                .to.be.equal(ethers.utils.parseEther('40'));

            expect(await token.balanceOf(investor.address)).to.be.equal(ETHER_10);
            expect(await token.balanceOf(vesting.address)).to.be.equal(ethers.utils.parseEther('390'));
        });

        it("Should not be able to release if revoked even after cliff ends.", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);
            
            const vestingScheduleId = await vesting.getVestingIdAtIndex(1);
            await expect(vesting.revoke(vestingScheduleId)).not.to.be.reverted;

            await vesting.setCurrentTime(startTime + MONTH);

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_50))
                .to.be.revertedWith("vesting schedule revoked!");

            expect(await token.balanceOf(investor.address)).to.be.equal(ZERO);
            expect(await token.balanceOf(vesting.address)).to.be.equal(ETHER_400);
        });

        it("Should release the amount during cliff even if after the schedule is revoked.", async () => {
            const {owner, vesting, investor, investorRevokable, token} = await loadFixture(deployContracts);
            
            const vestingScheduleId = await vesting.getVestingIdAtIndex(1);
            

            const amount = ethers.BigNumber.from(ETHER_200).mul(MONTH).div(THREE_MONTHS);

            await vesting.setCurrentTime(startTime + MONTH);

            await expect(vesting.revoke(vestingScheduleId))
                .to.changeTokenBalances(
                    token,
                    [investorRevokable],
                    [amount]
                );

            expect(await token.balanceOf(investorRevokable.address)).to.be.equal(amount);
            expect(await token.balanceOf(vesting.address)).to.be.equal(ETHER_400.sub(amount));
        });
    });

    describe("Test: Validate vested amount between cliff and period ends",  () => { 
        it("Should release all amount one day after cliff ends", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);
            
            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + MONTH + DAY);

            const amount = ethers.BigNumber.from(ETHER_200).mul(MONTH + DAY).div(FOUR_MONTHS);
            
             await expect(vesting.connect(investor).release(vestingScheduleId, amount))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [amount]
                );

            expect(await token.balanceOf(investor.address)).to.be.equal(amount);
            const remainVestedAmount = ethers.BigNumber.from(ETHER_400).sub(amount);
            expect(await token.balanceOf(vesting.address)).to.be.equal(remainVestedAmount);

        }); 
        it("Should allow to release one day after cliff ends", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);
            
            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);
            await vesting.setCurrentTime(startTime + MONTH);

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_50))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_50]
                );


            const amount = ethers.BigNumber.from(ETHER_200).mul(DAY).div(FOUR_MONTHS);
            
            await vesting.setCurrentTime(startTime + MONTH + DAY);
            await expect(vesting.connect(investor).release(vestingScheduleId, amount))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [amount]
                );
            const totalAmount = ethers.BigNumber.from(ETHER_50).add(amount)
            expect(await token.balanceOf(investor.address)).to.be.equal(totalAmount);

            const remainVestedAmount = ethers.BigNumber.from(ETHER_400).sub(totalAmount);
            expect(await token.balanceOf(vesting.address)).to.be.equal(remainVestedAmount);
        }); 

        it("Should allow to release everyday until period ends", async () => {
            const {owner, vesting, investor, token} = await loadFixture(deployContracts);
            
            const vestingScheduleId = await vesting.getVestingIdAtIndex(0);

            await vesting.setCurrentTime(startTime + MONTH);

            await expect(vesting.connect(investor).release(vestingScheduleId, ETHER_50))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_50]
                );

            const totalDays = (FOUR_MONTHS - MONTH) / DAY;
            
            for(let i = 1; i <= totalDays; i++)
            {
                await vesting.setCurrentTime(startTime + MONTH + i * DAY);
                const dailyAmount = await vesting.computeReleasableAmount(vestingScheduleId);

                await expect(vesting.connect(investor).release(vestingScheduleId, dailyAmount))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [dailyAmount]
                );
            }
            
            expect(await token.balanceOf(investor.address)).to.be.equal(ETHER_200);
            expect(await token.balanceOf(vesting.address)).to.be.equal(ETHER_200);
        });
    });

});