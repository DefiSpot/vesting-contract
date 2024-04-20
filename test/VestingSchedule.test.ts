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
const ETHER_20 = ethers.utils.parseEther("20");
const ETHER_50 = ethers.utils.parseEther("50");
const ETHER_100 = ethers.utils.parseEther("100");
const ETHER_150 = ethers.utils.parseEther("150");
const ETHER_200 = ethers.utils.parseEther("200");
const ETHER_300 = ethers.utils.parseEther("300");
const ETHER_320 = ethers.utils.parseEther("320");
const ETHER_500 = ethers.utils.parseEther("500");
const ETHER_1000 = ethers.utils.parseEther("1000");

const initialSupply = ETHER_100;

const abi = ethers.utils.defaultAbiCoder;

async function deployContracts() {
    const chainObj = await ethers.provider.getNetwork();
    const chainId = chainObj.chainId;
    // [investor account, amount, period (in secodns), cliff (in second), chainId]
    // [investor account, vested_amount, initial_amount, period (in secodns), cliff (in second), chainId,revokable]
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

    // We use the MockTokenVesting contract for testing purposes only.
    const Vesting = await ethers.getContractFactory("MockTokenVesting");
    const vesting = await Vesting.deploy(token.address);

    await expect(token.grantMinterRole(vesting.address)).not.to.be.reverted;

    const leafNodes = whitelistAddresses.map(addr => {
        let params = abi.encode(
            ["address","uint256","uint256","uint256","uint256","uint256","bool"],
            [addr[0].toString(),addr[1],addr[2],addr[3],addr[4],addr[5],addr[6]]
        );

        return ethers.utils.keccak256(params);            
      }
    );

    // Get valid parameters.
    const params = abi.encode(
        ["address","uint256","uint256","uint256","uint256","uint256","bool"], // encode as address array
        [investor.address,ETHER_200,ETHER_20,MONTH,FOUR_MONTHS,chainId,false]
    );
    
    const merkleTree = new MerkleTree(leafNodes, ethers.utils.keccak256, {sortPairs: true});
    
    // Compute merkle tree branch
    const hexProof = merkleTree.getHexProof(
        ethers.utils.keccak256(params)
    );

    await vesting.setCurrentTime(startTime);

    await expect(vesting.connect(investor).whitelistClaim(
          hexProof,ETHER_200,ETHER_20, MONTH,FOUR_MONTHS, false
    )).not.to.be.reverted;

    expect(await vesting.whitelistClaimed(investor.address)).to.be.equal(true);
    
    return { owner, token, vesting, merkleTree, abi, hexProof, investor, notInvestor};
}

describe("Vesting Contract Create Vesting Schedule Testing", () => {
    it("Should update the total supply of tokens", async function () {
        const {vesting, token, owner} = await loadFixture(deployContracts)

        const ownerBalance = await token.balanceOf(owner.address);
        expect(ownerBalance).to.be.equal(ETHER_100);
        expect(await token.balanceOf(vesting.address)).to.be.equal(ETHER_200);

        expect(await token.totalSupply()).to.be.equal(ETHER_320);
    });

    it("should get the same token adddress", async () => {
      const {vesting, token, owner} = await loadFixture(deployContracts)

      const tokenAddress = await vesting.getToken();
      expect(tokenAddress).to.eql(token.address);
    });

    it("should allow only the owner to create a vesting schedule ", async () => {
        const {vesting, investor} = await loadFixture(deployContracts);
        const accounts = await ethers.getSigners();

        const beneficiary = accounts[10].address;
        const cliff = MONTH;
        const duration = FOUR_MONTHS;
        const slicePeriodSeconds = DAY;
        const revokable = true;
        const amount = ETHER_100;

        // create new vesting schedule
        await expect(vesting.connect(investor).createVestingSchedule(
            beneficiary,
            cliff,
            duration,
            slicePeriodSeconds,
            revokable,
            amount
        )).to.be.revertedWithCustomError(vesting,`OwnableUnauthorizedAccount`);
    });

    it("should allow to create a second vesting schedule for an investor", async () => {
        const {vesting, investor} = await loadFixture(deployContracts);
        
        const beneficiary = investor.address;
        const cliff = MONTH;
        const duration = FOUR_MONTHS;
        const slicePeriodSeconds = DAY;
        const revokable = true;
        const amount = ETHER_300;

        // create new vesting schedule
        await expect(vesting.createVestingSchedule(
            beneficiary,
            cliff,
            duration,
            slicePeriodSeconds,
            revokable,
            amount
        )).not.to.be.reverted;

        
        expect(await vesting.getVestingSchedulesCount()).to.be.equal(2);
        expect(await vesting.getVestingSchedulesTotalAmount()).to.be.equal(ETHER_500);
        expect(await vesting.getVestingSchedulesCountByBeneficiary(investor.address)).to.be.equal(2);
    });

    it("should allow to create a second schedule for immediate release", async () => {
        const {vesting, investor,token} = await loadFixture(deployContracts);
        
        const beneficiary = investor.address;
        const cliff = 0;
        const duration = 1;
        const slicePeriodSeconds = 1;
        const revokable = true;
        const amount = ETHER_300;

        // create new vesting schedule
        await expect(vesting.createVestingSchedule(
            beneficiary,
            cliff,
            duration,
            slicePeriodSeconds,
            revokable,
            amount
        )).not.to.be.reverted;

        
        expect(await vesting.getVestingSchedulesCount()).to.be.equal(2);
        expect(await vesting.getVestingSchedulesTotalAmount()).to.be.equal(ETHER_500);
        expect(await vesting.getVestingSchedulesCountByBeneficiary(investor.address)).to.be.equal(2);

        await vesting.setCurrentTime(startTime + 1);

        const vestingScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
            investor.address,
            1
        );

        await expect(vesting.connect(investor).release(vestingScheduleId))
                .to.changeTokenBalances(
                    token,
                    [investor],
                    [ETHER_300]
                )

        expect(await token.balanceOf(investor.address)).to.be.equal(ETHER_320);
    });

    it("should validate that period is equal or greater than cliff", async () => {
        const {vesting, investor} = await loadFixture(deployContracts);
        
        const beneficiary = investor.address;
        const cliff = FOUR_MONTHS;
        const duration = MONTH;
        const slicePeriodSeconds = DAY;
        const revokable = true;
        const amount = ETHER_300;

        // create new vesting schedule
        await expect(vesting.createVestingSchedule(
            beneficiary,
            cliff,
            duration,
            slicePeriodSeconds,
            revokable,
            amount
        )).to.be.revertedWith("duration is not valid!")
        
        expect(await vesting.getVestingSchedulesCount()).to.be.equal(1);
        expect(await vesting.getVestingSchedulesTotalAmount()).to.be.equal(ETHER_200);
        expect(await vesting.getVestingSchedulesCountByBeneficiary(investor.address)).to.be.equal(1);
    });

    it("Should release vested tokens if second schedule is revoked", async function () {
        const {vesting, investor, token} = await loadFixture(deployContracts);
        
        const beneficiary = investor.address;
        const cliff = MONTH;
        const duration = FOUR_MONTHS;
        const slicePeriodSeconds = DAY;
        const revokable = true;
        const amount = ETHER_200;

        // create new vesting schedule
        await expect(vesting.createVestingSchedule(
            beneficiary,
            cliff,
            duration,
            slicePeriodSeconds,
            revokable,
            amount
        )).not.to.be.reverted;

        const vestingScheduleId = await vesting.getVestingIdAtIndex(1);
        
        // set time to half the vesting period
        const halfTime = duration / 2;
        await vesting.setCurrentTime(halfTime +startTime);

        await expect(vesting.revoke(vestingScheduleId))
            .to.changeTokenBalances(
                token,
                [investor],
                [ETHER_100]
            );

        expect(await vesting.getVestingSchedulesCount()).to.be.equal(2);
        expect(await vesting.getVestingSchedulesTotalAmount()).to.be.equal(ETHER_200);
        expect(await vesting.getVestingSchedulesCountByBeneficiary(investor.address)).to.be.equal(2);

    });

    it("Should not be able to revoke if vesting schedule is not revokable", async function () {
        const {vesting, investor, token} = await loadFixture(deployContracts);
        
        const beneficiary = investor.address;
        const cliff = MONTH;
        const duration = FOUR_MONTHS;
        const slicePeriodSeconds = DAY;
        const revokable = false;
        const amount = ETHER_200;

        // create new vesting schedule
        await expect(vesting.createVestingSchedule(
            beneficiary,
            cliff,
            duration,
            slicePeriodSeconds,
            revokable,
            amount
        )).not.to.be.reverted;

        const vestingScheduleId = await vesting.getVestingIdAtIndex(1);
        
        // set time to half the vesting period
        await vesting.setCurrentTime(MONTH + startTime);

        await expect(vesting.revoke(vestingScheduleId))
            .to.be.revertedWith("vesting is not revocable!");
    });

    it("Should be able to verify event parameters", async () => {
        const {vesting, owner, investor, token} = await loadFixture(deployContracts);
        
        const beneficiary = investor.address;
        const cliff = MONTH;
        const duration = FOUR_MONTHS;
        const slicePeriodSeconds = DAY;
        const revokable = false;
        const amount = ETHER_200;

        // create new vesting schedule
        const vestingScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
            investor.address,
            1
          );

        await expect(vesting.createVestingSchedule(
            beneficiary,
            cliff,
            duration,
            slicePeriodSeconds,
            revokable,
            amount
        )).to.emit(vesting, "LogNewVestingSchedule")
        .withArgs(owner.address, investor.address, vestingScheduleId, 2);
    });
    
});