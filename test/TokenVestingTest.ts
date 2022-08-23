import { expect } from "chai";
import { ethers} from "hardhat";
import { Contract, BigNumber } from "ethers";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

async function stakingRewardsFixture() {
        const [owner, stakerOne, stakerTwo, stakerThree] = await ethers.getSigners();

        const SpotToken = await ethers.getContractFactory("Token");
        const spotToken = await SpotToken.deploy("Spot Token", "SPOT", 1 * 1e6);

        const TokenVesting = await ethers.getContractFactory("TokenVesting");
        const tokenVesting = await TokenVesting.deploy(spotToken.address);


        return { spotToken, tokenVesting, owner, stakerOne, stakerTwo, stakerThree}
}

async function advanceTimeInSeconds(days: number) {
        await ethers.provider.send('evm_increaseTime', [days]);
}


describe("Staking Rewards Contract", () => { 
        describe("Staking Rewards Functionality", () => {
            it("", async () => {
                const {tokenVesting} = await loadFixture(stakingRewardsFixture);
            });
            
        });
});