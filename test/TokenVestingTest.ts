import { expect } from "chai";
import { ethers} from "hardhat";
import { Contract, BigNumber, utils} from "ethers";
import { token } from "../typechain-types/@openzeppelin/contracts";
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");


async function stakingRewardsFixture() {
        const [owner, beneficiaryOne, beneficiaryTwo, ] = await ethers.getSigners();

        const SpotToken = await ethers.getContractFactory("Token");
        const spotToken = await SpotToken.deploy("Spot Token", "SPOT", 1 * 1e6);
        
        const TokenVesting = await ethers.getContractFactory("MockTokenVesting");
        const tokenVesting = await TokenVesting.deploy(spotToken.address);

        await spotToken.transfer(tokenVesting.address, 1000);

        return { spotToken, tokenVesting, owner, beneficiaryOne, beneficiaryTwo}
}

async function advanceTimeInSeconds(days: number) {
        await ethers.provider.send('evm_increaseTime', [days]);
}

describe("Vesting Contract Testing", () => { 
  describe("Vesting contract functionality", () => {

    it("Should assign the total supply of tokens to the owner", async function () {
      const {owner, spotToken, tokenVesting} = await loadFixture(stakingRewardsFixture);

      const ownerBalance = await spotToken.balanceOf(owner.address);
      const contractBalance = await spotToken.balanceOf(tokenVesting.address);
      
      expect(await spotToken.totalSupply()).to.equal(ownerBalance.add(contractBalance));
    });

    it("should get the same token adddress", async () => {
      const {spotToken, tokenVesting} = await loadFixture(stakingRewardsFixture);
      const tokenAddress = await tokenVesting.getToken();

      expect(tokenAddress).to.eql(spotToken.address);
    });

    it("should send tokens to the contract", async () => {
      const {owner, spotToken, tokenVesting} = await loadFixture(stakingRewardsFixture);

      const initialBalance = await spotToken.balanceOf(tokenVesting.address);
      expect(initialBalance).to.equal(1000);

      await expect(spotToken.transfer(tokenVesting.address, 1000))
      .to.emit(spotToken, "Transfer")
      .withArgs(owner.address, tokenVesting.address, 1000);

      const newBalance = await spotToken.balanceOf(tokenVesting.address);
      expect(newBalance).to.equal(2000);

      const withdrawableAmount = await tokenVesting.getWithdrawableAmount();
      expect(withdrawableAmount).to.equal(2000);
    });

    it("should create a vesting schedule", async () => {
      const {tokenVesting, beneficiaryOne} = await loadFixture(stakingRewardsFixture);

      const baseTime = 1622551248;
      const beneficiary = beneficiaryOne;
      const startTime = baseTime;
      const cliff = 0;
      const duration = 1000;
      const slicePeriodSeconds = 1;
      const revokable = true;
      const amount = 100;

        // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        amount
      );

     expect(await tokenVesting.getVestingSchedulesCount()).to.be.equal(1);
     expect(
          await tokenVesting.getVestingSchedulesCountByBeneficiary(
          beneficiary.address
     )).to.be.equal(1);

     // compute vesting schedule id
     const vestingScheduleId =
     await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
        beneficiary.address,
        0
     );

     expect(
        await tokenVesting.computeReleasableAmount(vestingScheduleId)
     ).to.be.equal(0);

     // set time to half the vesting period
      const halfTime = baseTime + duration / 2;
      await tokenVesting.setCurrentTime(halfTime);

      expect(
        await tokenVesting.computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(50);

      await tokenVesting.setCurrentTime(baseTime + duration);
      
      expect(
        await tokenVesting.computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(100);

     /*console.log(vestingScheduleId);
     var abiCoder = ethers.utils.defaultAbiCoder;
     var data = abiCoder.encode(["address", "uint256"], [beneficiary.address, 0]);

     const hashValue = utils.keccak256(data);
     console.log(hashValue);*/
    });

    it("should revoke a vesting schedule", async () => {
      const {spotToken, tokenVesting, beneficiaryOne} = await loadFixture(stakingRewardsFixture);

      const baseTime = 1622551248;
      const beneficiary = beneficiaryOne;
      const startTime = baseTime;
      const cliff = 0;
      const duration = 1000;
      const slicePeriodSeconds = 1;
      const revokable = true;
      const amount = 100;

        // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        amount
      );

      expect(await tokenVesting.getVestingSchedulesCount()).to.be.equal(1);
      expect(
          await tokenVesting.getVestingSchedulesCountByBeneficiary(
          beneficiary.address
      )).to.be.equal(1);

      // compute vesting schedule id
      const vestingScheduleId =
      await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
        beneficiary.address,
        0
      );

      expect(
        await tokenVesting.computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(0);

      // set time to half the vesting period
      const halfTime = baseTime + duration / 2;
      await tokenVesting.setCurrentTime(halfTime);

      await expect(tokenVesting.revoke(vestingScheduleId))
        .to.emit(spotToken, "Transfer")
        .withArgs(tokenVesting.address, beneficiary.address, 50);

      await expect(tokenVesting.computeReleasableAmount(vestingScheduleId)
        ).to.be.revertedWith("vesting schedule revoked!");

      const balance = await spotToken.balanceOf(beneficiary.address);
      expect(balance).to.equal(50);
    });

    it("should create more than one vesting schedule by beneficiary", async () => {
      const {spotToken, tokenVesting, beneficiaryOne} = await loadFixture(stakingRewardsFixture);

      const baseTime = 1622551248;
      const beneficiary = beneficiaryOne;
      const startTime = baseTime;
      const cliff = 0;
      const slicePeriodSeconds = 1;
      const revokable = true;
      
      // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        1000,
        slicePeriodSeconds,
        revokable,
        100
      );

      // create second vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        500,
        slicePeriodSeconds,
        revokable,
        50
      );

      expect(await tokenVesting.getVestingSchedulesCount()).to.be.equal(2);
      expect(
          await tokenVesting.getVestingSchedulesCountByBeneficiary(
          beneficiary.address
      )).to.be.equal(2);

      expect(await tokenVesting.getVestingSchedulesTotalAmount()).to.equal(150);
      
      const vestingScheduleId = await tokenVesting.getVestingIdAtIndex(1);
      const vestingSchedule = await tokenVesting.getVestingSchedule(vestingScheduleId);

      expect(vestingSchedule.amountTotal).to.equal(50);
      expect(vestingSchedule.beneficiary).to.equal(beneficiary.address);
    });

    it("should be able to withdraw", async () => {
      const {spotToken, tokenVesting, owner, beneficiaryOne} = await loadFixture(stakingRewardsFixture);

      const baseTime = 1622551248;
      const beneficiary = beneficiaryOne;
      const startTime = baseTime;
      const cliff = 0;
      const slicePeriodSeconds = 1;
      const revokable = true;
      
      // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        1000,
        slicePeriodSeconds,
        revokable,
        100
      );
      const initialBalance = await spotToken.balanceOf(owner.address);
      await tokenVesting.withdraw(400);
      const endBalance = await spotToken.balanceOf(owner.address);

      expect(endBalance).to.equal(initialBalance.add(400));
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(500);
    });

    it("should be able to release vesting tokens by the beneficiary", async () => {
      const {spotToken, tokenVesting, beneficiaryOne} = await loadFixture(stakingRewardsFixture);

      const baseTime = 1622551248;
      const beneficiary = beneficiaryOne;
      const startTime = baseTime;
      const cliff = 0;
      const slicePeriodSeconds = 100;
      const revokable = true;
      
      // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        500,
        slicePeriodSeconds,
        revokable,
        1000
      );

      expect(await tokenVesting.getWithdrawableAmount()).to.equal(0);

      const initialBalance = await spotToken.balanceOf(beneficiaryOne.address);

      await tokenVesting.setCurrentTime(startTime + slicePeriodSeconds);

      const vestingScheduleId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(beneficiary.address,0);

      expect(
        await tokenVesting.computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(200);

      await tokenVesting.connect(beneficiaryOne).release(vestingScheduleId, 200);
      let endBalance = await spotToken.balanceOf(beneficiary.address);

      expect(endBalance).to.equal(initialBalance.add(200));
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(0);

      await tokenVesting.setCurrentTime(startTime + (slicePeriodSeconds * 2));
      expect(await tokenVesting.computeReleasableAmount(vestingScheduleId)).to.equal(200);
      
      await tokenVesting.setCurrentTime(startTime + (slicePeriodSeconds * 3));
      expect(await tokenVesting.computeReleasableAmount(vestingScheduleId)).to.equal(400);

      await tokenVesting.setCurrentTime(startTime + (slicePeriodSeconds * 4));
      expect(await tokenVesting.computeReleasableAmount(vestingScheduleId)).to.equal(600);

      await tokenVesting.setCurrentTime(startTime + (slicePeriodSeconds * 5));
      expect(await tokenVesting.computeReleasableAmount(vestingScheduleId)).to.equal(800);

      await tokenVesting.setCurrentTime(startTime + (slicePeriodSeconds * 6));
      expect(await tokenVesting.computeReleasableAmount(vestingScheduleId)).to.equal(800);

      await tokenVesting.connect(beneficiaryOne).release(vestingScheduleId, 800);
      endBalance = await spotToken.balanceOf(beneficiary.address);

      expect(endBalance).to.equal(initialBalance.add(1000));
      expect(await tokenVesting.getWithdrawableAmount()).to.equal(0);
    });

    it("should consider the cliff period", async () => {
      const {spotToken, tokenVesting, owner, beneficiaryOne} = await loadFixture(stakingRewardsFixture);

      const baseTime = 1622551248;
      const beneficiary = beneficiaryOne;
      const startTime = baseTime;
      const cliff = 300;
      const slicePeriodSeconds = 100;
      const revokable = true;
      
      // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        500,
        slicePeriodSeconds,
        revokable,
        1000
      );

      expect(await tokenVesting.getWithdrawableAmount()).to.equal(0);

      const initialBalance = await spotToken.balanceOf(beneficiaryOne.address);

      await tokenVesting.setCurrentTime(startTime + slicePeriodSeconds * 3);

      const vestingScheduleId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(beneficiary.address,0);

      expect(
        await tokenVesting.computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(600);

      await tokenVesting.connect(beneficiaryOne).release(vestingScheduleId, 600);
      let endBalance = await spotToken.balanceOf(beneficiary.address);
      
      expect(endBalance).to.equal(initialBalance.add(600));
      expect(
        await tokenVesting.computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(0);

      expect(await tokenVesting.getWithdrawableAmount()).to.equal(0);
    });

    it("should release a partial amount", async () => {
      const {spotToken, tokenVesting, beneficiaryOne} = await loadFixture(stakingRewardsFixture);

      const baseTime = 1622551248;
      const beneficiary = beneficiaryOne;
      const startTime = baseTime;
      const cliff = 300;
      const slicePeriodSeconds = 100;
      const revokable = true;
      
      // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        500,
        slicePeriodSeconds,
        revokable,
        1000
      );

      expect(await tokenVesting.getWithdrawableAmount()).to.equal(0);

      const initialBalance = await spotToken.balanceOf(beneficiaryOne.address);

      await tokenVesting.setCurrentTime(startTime + slicePeriodSeconds * 3);

      const vestingScheduleId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(beneficiary.address,0);

      expect(
        await tokenVesting.computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(600);

      await tokenVesting.connect(beneficiaryOne).release(vestingScheduleId, 200);

      let endBalance = await spotToken.balanceOf(beneficiary.address);
      
      expect(endBalance).to.equal(initialBalance.add(200));

      expect(
        await tokenVesting.computeReleasableAmount(vestingScheduleId)
      ).to.be.equal(400);

      expect(await tokenVesting.getWithdrawableAmount()).to.equal(0);
    });

    /*
      const baseTime = 1622551248;
      const beneficiary = beneficiaryOne;
      const startTime = baseTime;
      const cliff = 0;
      const duration = 1000;
      const slicePeriodSeconds = 1;
      const revokable = true;
      const amount = 100;

        // create new vesting schedule
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        amount
      );
    */
    it("should release the exact amount of tokens", async () => {
        const {tokenVesting, spotToken, beneficiaryOne, beneficiaryTwo} = await loadFixture(stakingRewardsFixture);

        const time = Date.now();
        const duration = 1000

        await tokenVesting.createVestingSchedule(
              beneficiaryOne.address,
              time,
              5, 1000, 10, false, 1000);

        await tokenVesting.setCurrentTime(time + duration * 1000);

        const vestingScheduleId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(beneficiaryOne.address,0);

        await tokenVesting.connect(beneficiaryOne).release(vestingScheduleId, 1000);

        expect(await tokenVesting.getWithdrawableAmount()).to.equal(0);

        const newBalance = await spotToken.balanceOf(beneficiaryOne.address);
        expect(newBalance).to.equal(1000);
        
    });

    it("should compute vesting schedule index", async () => {
        const {spotToken, tokenVesting, owner, beneficiaryOne} = await loadFixture(stakingRewardsFixture);
        const expectedVestingScheduleId =
        "0xa279197a1d7a4b7398aa0248e95b8fcc6cdfb43220ade05d01add9c5468ea097";
      
        const scheduleID = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
            beneficiaryOne.address,
            0
        );
        expect(scheduleID).to.eql(expectedVestingScheduleId);

        expect(
                await tokenVesting.computeNextVestingScheduleIdForHolder(beneficiaryOne.address)
        ).to.eql(scheduleID);
    });
  });

  describe("Verify parameters", () => { 
    it("should check input parameters for createVestingSchedule method", async function () {
        const {spotToken, tokenVesting, beneficiaryOne} = await loadFixture(stakingRewardsFixture);
        
        const time = Date.now();
        await expect(
                tokenVesting.createVestingSchedule(
                beneficiaryOne.address,
                time,
                0, 0, 1, false, 1)
        ).to.be.revertedWith("duration must be > 0");

        await expect(
                tokenVesting.createVestingSchedule(
                beneficiaryOne.address,
                time,
                0, 1, 0, false, 1)
        ).to.be.revertedWith("slicePeriodSeconds must be >= 1");
      
        await expect(
                tokenVesting.createVestingSchedule(
                beneficiaryOne.address,
                time,
                0, 1, 1, false, 0)
        ).to.be.revertedWith("amount must be > 0");

    });

    it("should check withdrawable funds available", async () => {
        const {spotToken, tokenVesting, beneficiaryOne} = await loadFixture(stakingRewardsFixture);

        const time = Date.now();
        await tokenVesting.createVestingSchedule(
              beneficiaryOne.address,
              time,
              0, 1, 1, false, 1000);

        await expect(
                tokenVesting.withdraw(1)
        ).to.be.revertedWith("not enough withdrawable funds!");
    });

    it("should not be able to revoke schedule", async () => {
        const {spotToken, tokenVesting, beneficiaryOne} = await loadFixture(stakingRewardsFixture);

        const time = Date.now();
        await tokenVesting.createVestingSchedule(
              beneficiaryOne.address,
              time,
              0, 1, 1, false, 1000);
        const vestingScheduleId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(beneficiaryOne.address,0);

        await expect(
                tokenVesting.revoke(vestingScheduleId)
        ).to.be.revertedWith("vesting is not revocable!");
    });

    it("should test the release requirements", async () => {
        const {tokenVesting, beneficiaryOne, beneficiaryTwo} = await loadFixture(stakingRewardsFixture);

        const time = Date.now();

        await tokenVesting.createVestingSchedule(
              beneficiaryOne.address,
              time,
              0, 100, 10, false, 1000);
        const vestingScheduleId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(beneficiaryOne.address,0);
        await tokenVesting.setCurrentTime(time + 10);
        
        await expect(
                tokenVesting.connect(beneficiaryTwo).release(vestingScheduleId, 1)
        ).to.be.revertedWith("only beneficiary and owner!");

        await expect(
                tokenVesting.release(vestingScheduleId, 101)
        ).to.be.revertedWith("cannot release tokens!");

    });
  });
});