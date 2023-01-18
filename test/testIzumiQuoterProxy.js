const { expect } = require("chai");
const { ethers, web3 } = require("hardhat");
const { BigNumber } = require("ethers");
const BigNumberjs = require('bignumber.js');
const { getAbi, uint256Max } = require("../utils/Toolkit")
// const Web3 = require("web3");
const dotenv = require('dotenv');
dotenv.config('./env');
const ContractAddresses = require("../utils/ContractAddresses")
const TokenAddresses = require("../utils/TokenAddresses")

let testPoolFee = Number(process.env.TEST_POOL_FEE)

function ceil(b) {
  return BigNumberjs(b.toFixed(0, 2));
}

function floor(b) {
  return BigNumberjs(b.toFixed(0, 3));
}

function getAmountYNoRound(l, r, rate, liquidity) {
  var amountY = BigNumberjs('0');
  var price = rate.pow(l);
  for (var idx = l; idx < r; idx ++) {
    amountY = amountY.plus(liquidity.times(price.sqrt()));
    price = price.times(rate);
  }
  return amountY;
}
function getAmountXNoRound(l, r, rate, liquidity) {
  amountX = BigNumberjs('0');
  price = rate.pow(l);
  for (var idx = l; idx < r; idx ++) {
    amountX = amountX.plus(liquidity.div(price.sqrt()));
    price = price.times(rate);
  }
  return amountX;
}

function getAmountY(l, r, rate, liquidity, up) {
  var amountY = BigNumberjs('0');
  var price = rate.pow(l);
  for (var idx = l; idx < r; idx ++) {
    amountY = amountY.plus(liquidity.times(price.sqrt()));
    price = price.times(rate);
  }
  if (up) {
      return ceil(amountY);
  }
  return floor(amountY);
}
function getAmountX(l, r, rate, liquidity, up) {
  amountX = BigNumberjs('0');
  price = rate.pow(l);
  for (var idx = l; idx < r; idx ++) {
    amountX = amountX.plus(liquidity.div(price.sqrt()));
    price = price.times(rate);
  }
  if (up) {
      return ceil(amountX);
  }
  return floor(amountX);
}
function depositYAtPrice(p, rate, liquidity) {
  var price = rate.pow(p);
  var amountY = liquidity.times(price.sqrt());
  return amountY;
}

function depositXY(l, r, p, rate, liquidity) {
  expect(l).to.lessThanOrEqual(p);
  expect(r).to.greaterThan(p);
  var amountY = getAmountYNoRound(l, p, rate, liquidity);
  var amountX = getAmountXNoRound(p + 1, r, rate, liquidity);
  amountY = amountY.plus(depositYAtPrice(p, rate, liquidity));
  return [amountX, amountY];
}

async function mint(nflm, miner, tokenX, tokenY, fee, pl, pr, amountX, amountY) {
  if (amountX.gt('0')) {
      await tokenX.connect(miner).approve(nflm.address, amountX.toFixed(0));
      console.log("approve x: " + await tokenX.allowance(miner.address, nflm.address));
  }
  if (amountY.gt('0')) {
      await tokenY.connect(miner).approve(nflm.address, amountY.toFixed(0));
      console.log("approve y: " + await tokenY.allowance(miner.address, nflm.address));
  }

  await nflm.connect(miner).mint(
      {
          miner: miner.address,
          tokenX: tokenX.address,
          tokenY: tokenY.address,
          fee: fee,
          pl: pl,
          pr: pr,
          xLim: amountX.toFixed(0),
          yLim: amountY.toFixed(0),
          amountXMin: 0,
          amountYMin: 0,
          deadline: BigNumberjs("1000000000000").toFixed(0)
      }
  );
  console.log('after mint');
}

async function mintByLiquid(nflm, tokenX, tokenY, miner, l, r, p, rate, liquidity) {
  var amountX1 = BigNumberjs("0");
  var amountY1 = BigNumberjs("0");
  if (l <= p && r > p) {
      [amountX1, amountY1] = depositXY(l, r, p, rate, BigNumberjs("1"));
  } else {
      if (l <= p) {
          amountY1 = getAmountYNoRound(l, r, rate, BigNumberjs("1"));
      }
      if (r > p) {
          amountX1 = getAmountXNoRound(l, r, rate, BigNumberjs("1"));
      }
  }
    var amountXLim = ceil(amountX1.times(liquidity));
    var amountYLim = ceil(amountY1.times(liquidity));
    await mint(nflm, miner, tokenX, tokenY, testPoolFee, l, r, amountXLim, amountYLim);
}

describe("izumi and biswap delta quoter test using self deploying quoter contract", function () {
  let WBNB = TokenAddresses.WBNB // bsc
  let USDC = TokenAddresses.USDC // bsc
  let USDT = TokenAddresses.USDT // bsc
  let iZi = TokenAddresses.iZi // bsc
  let BSW = TokenAddresses.BSW // bsc
  let WETH = TokenAddresses.WETH // bsc
  let BUSD = TokenAddresses.BUSD // bsc
  let iUSD = TokenAddresses.iUSD // bsc

  // get izumi factory, liquidity, router address
  let izumiFactory = ContractAddresses.izumiFactory
  let izumiLiquidity = ContractAddresses.izumiLiquidity
  let izumiSwap = ContractAddresses.izumiSwap
  let izumiQuoter = ContractAddresses.izumiQuoter

  // get biswap router and factory address
  let biswapRouter = ContractAddresses.biswapRouter // bsc
  let biswapQuoter = ContractAddresses.biswapRouter // bsc
  let biswapFactory = ContractAddresses.biswapFactory // bsc
  
  let nflm
  let izumiProxy
  let biswapProxy
  let izumiAndBiswapDeltaQuoter
  
  it("Should show izumiAndBiswapDeltaQuoter quoter result", async function () {
    // get owner
    let owner, addrs;
    [owner, ...addrs] = await ethers.getSigners();
    console.log(`Owner address: ${owner.address}`)

    const privateKey = process.env.PRIVATE_KEY
    let provider = ethers.getDefaultProvider('http://localhost:8545')
    let signer = new ethers.Wallet(privateKey, provider);
    console.log('Using signer address ' + signer.address);

    // load izumiQuoter
    let izumiQuoterProxyAbi = getAbi("IzumiQuoterProxy")
    let izumiQuoterProxyAddress = ContractAddresses.izumiQuoterProxy
    let izumiQuoterProxy = await ethers.getContractAt(izumiQuoterProxyAbi, izumiQuoterProxyAddress)
    
    // // deploy izumiAndBiswap quoter
    // const IzumiQuoterProxyFactory = await hre.ethers.getContractFactory('IzumiQuoterProxy');
    // let izumiQuoterProxy = await IzumiQuoterProxyFactory.deploy(izumiQuoter, izumiFactory, izumiLiquidity);
    // await izumiQuoterProxy.deployed();
    // console.log(`izumiQuoterProxy contract address: ${izumiQuoterProxy.address}`)

    let fee = 100
    let amountInAList = [4000]
    for (var i = 0; i < amountInAList.length; i++) {
      amountInAList[i] = new BigNumber.from(amountInAList[i] * 1e9).mul(1e9)
    }

    let quoteParams = {
      tokenX: iUSD,
      tokenY: BUSD,
      fee: fee,
      amountInAList: amountInAList,
      lowPt: -800001
    }

    let quoterResult = await izumiQuoterProxy.callStatic.swapX2Y(
      quoteParams.tokenX,
      quoteParams.tokenY,
      quoteParams.fee,
      quoteParams.amountInAList,
      quoteParams.lowPt
    );
    console.log('quoterResult')
    console.log(quoterResult)

    let quoterResult1 = await izumiQuoterProxy.callStatic.swapY2X(
      quoteParams.tokenX,
      quoteParams.tokenY,
      quoteParams.fee,
      quoteParams.amountInAList,
      800001
    );
    console.log('quoterResult1')
    console.log(quoterResult1)
    
  });
});
