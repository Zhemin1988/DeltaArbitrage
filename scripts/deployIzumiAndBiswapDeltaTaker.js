// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you"ll find the Hardhat
// Runtime Environment"s members available in the global scope.
const hre = require("hardhat");
const { expect } = require("chai");
const { ethers, web3 } = require("hardhat");
const { BigNumber } = require("ethers");
const BigNumberjs = require('bignumber.js');
const { getAbi, uint256Max } = require("../utils/Toolkit")
const ss = require('simple-statistics')
// const Web3 = require("web3");
const dotenv = require('dotenv');
dotenv.config('./env');
const ContractAddresses = require("../utils/ContractAddresses")
const TokenAddresses = require("../utils/TokenAddresses")

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run("compile");

  // get owner
  let owner, addrs;
  [owner, ...addrs] = await ethers.getSigners();
  console.log(`Owner address: ${owner.address}`)
  let izumiSwap = ContractAddresses.izumiSwap
  let biswapRouter = ContractAddresses.biswapRouter // bsc
  let izumiProxyAddress = ContractAddresses.izumiQuoterProxy // bsc
  let biswapProxyAddress = ContractAddresses.biswapQuoterProxy
  
  // deploy izumiAndBiswap taker
  const IzumiAndBiswapDeltaTakerFactory = await hre.ethers.getContractFactory('IzumiAndBiswapDeltaTaker');
  izumiAndBiswapDeltaTaker = await IzumiAndBiswapDeltaTakerFactory.deploy(izumiSwap, biswapRouter, izumiProxyAddress, biswapProxyAddress);
  await izumiAndBiswapDeltaTaker.deployed();
  console.log(`IzumiAndBiswap taker contract address: ${izumiAndBiswapDeltaTaker.address}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
