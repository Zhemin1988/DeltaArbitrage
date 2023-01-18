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

describe("izumi and biswap taker test using self deploying taker contract", function () {
  let WBNB = TokenAddresses.WBNB // bsc
  let USDC = TokenAddresses.USDC // bsc
  let USDT = TokenAddresses.USDT // bsc
  let iZi = TokenAddresses.iZi // bsc
  let BSW = TokenAddresses.BSW // bsc
  let WETH = TokenAddresses.WETH // bsc
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
  let izumiAndBiswapDeltaTaker
  
  it("Should show izumiAndBiswapDeltaTaker taker result", async function () {
    // get owner
    let owner, addrs;
    [owner, ...addrs] = await ethers.getSigners();
    console.log(`Owner address: ${owner.address}`)
    let izumiSwap = ContractAddresses.izumiSwap
    let biswapRouter = ContractAddresses.biswapRouter // bsc
    let izumiProxyAddress = ContractAddresses.izumiQuoterProxy // bsc
    let biswapProxyAddress = ContractAddresses.biswapQuoterProxy
    
    // deploy izumiAndBiswap quoter
    const IzumiAndBiswapDeltaQuoterFactory = await hre.ethers.getContractFactory('IzumiAndBiswapDeltaQuoter');
    izumiAndBiswapDeltaQuoter = await IzumiAndBiswapDeltaQuoterFactory.deploy(izumiProxyAddress, biswapProxyAddress);
    await izumiAndBiswapDeltaQuoter.deployed();
    console.log(`IzumiAndBiswap delta quoter contract address: ${izumiAndBiswapDeltaQuoter.address}`)

    // deploy izumiAndBiswap taker
    const IzumiAndBiswapDeltaTakerFactory = await hre.ethers.getContractFactory('IzumiAndBiswapDeltaTaker');
    izumiAndBiswapDeltaTaker = await IzumiAndBiswapDeltaTakerFactory.deploy(izumiSwap, biswapRouter, izumiProxyAddress, biswapProxyAddress);
    await izumiAndBiswapDeltaTaker.deployed();
    console.log(`IzumiAndBiswap taker contract address: ${izumiAndBiswapDeltaTaker.address}`)

    const privateKey = process.env.PRIVATE_KEY
    let provider = ethers.getDefaultProvider('http://localhost:8545')
    let signer = new ethers.Wallet(privateKey, provider);
    console.log('Using signer address ' + signer.address);
    // transfer ownership
    let takerOwner = await izumiAndBiswapDeltaTaker.owner()
    if (takerOwner != signer.address) {
      await izumiAndBiswapDeltaTaker.transferOwnership(signer.address)
      console.log(`new owner of the izumiAndBiswapDeltaTaker contract: ${await izumiAndBiswapDeltaTaker.owner()}`)
    }
    // use signer to test
    izumiAndBiswapDeltaTaker = izumiAndBiswapDeltaTaker.connect(signer)

    let gasFees = []
    let gases = []
    for (var index = 0; index < 10; index++) {
      // quote and arbitrage
      let pathList = [[WBNB, iUSD, USDT]]
      for (var path of pathList) {
        let tokenA = path[0]
        let tokenB = path[1]
        let tokenC = path[2]
        let feeAB = testPoolFee
        let feeBC = 100
        let feeCA = 1000
        // let amountInList = [0.0001, 0.001, 0.01]
        let amountInAList = [0.01 + index * 0.01]
        for (var i = 0; i < amountInAList.length; i++) {
          amountInAList[i] = new BigNumber.from(Math.ceil(amountInAList[i] * 1e9)).mul(1e9)
        }

        let deltaQuoteParams = {
          // three tokens to be swapped
          tokenA: WBNB,
          tokenB: iUSD,
          tokenC: USDT,
      
          // three dex to be used
          dexAB: izumiFactory,
          dexBC: ContractAddresses.zeroAddress,
          dexCA: biswapFactory,
      
          // three pool fees to be used
          feeAB: feeAB,
          feeBC: feeBC,
          feeCA: feeCA,
      
          // delta swap start from tokenA
          amountInAList: amountInAList
        }

        let ERC20Abi = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"tokens","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"withdrawEther","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"_totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"tokenOwner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeSub","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transfer","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeDiv","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"tokens","type":"uint256"},{"name":"data","type":"bytes"}],"name":"approveAndCall","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeMul","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token.address","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transferAnyERC20Token","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"tokenOwner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeAdd","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_from","type":"address"},{"indexed":true,"name":"_to","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"tokens","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"tokenOwner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"tokens","type":"uint256"}],"name":"Approval","type":"event"}];
        let tokenAContract = await ethers.getContractAt(ERC20Abi, tokenA)
        let tokenBContract = await ethers.getContractAt(ERC20Abi, tokenB)
        let tokenCContract = await ethers.getContractAt(ERC20Abi, tokenC)
        tokenAContract = tokenAContract.connect(signer)
        tokenBContract = tokenBContract.connect(signer)
        tokenCContract = tokenCContract.connect(signer)

        let approveAmount = new BigNumber.from(uint256Max)
        await tokenAContract.approve(izumiAndBiswapDeltaTaker.address, approveAmount)
        await tokenBContract.approve(izumiAndBiswapDeltaTaker.address, approveAmount)
        await tokenCContract.approve(izumiAndBiswapDeltaTaker.address, approveAmount)

        // quote
        let quoteResult = await izumiAndBiswapDeltaQuoter.callStatic.arbitrageQuote(deltaQuoteParams);
        for (var i = 0; i < amountInAList.length; i++) {
          let arbitrageReceipt

          let tokenABalance0 = await tokenAContract.balanceOf(owner.address)
          console.log(`tokenA balance before arbitrage`)
          console.log(BigNumberjs(tokenABalance0).dividedBy(1e9).dividedBy(1e9).toString())

          let clockWiseProfit = quoteResult.amountOutAList[i].sub(amountInAList[i])
          console.log(`clockWise swap Profit`)
          console.log(clockWiseProfit)
          // if arbitrage chance emerges
          if (clockWiseProfit.gt('0')) {
            let deltaSwapParams = {
              // three tokens to be swapped
              tokenA: WBNB,
              tokenB: iUSD,
              tokenC: USDT,
          
              // three dex to be used
              dexAB: izumiFactory,
              dexBC: ContractAddresses.zeroAddress,
              dexCA: biswapFactory,
          
              // three pool fees to be used
              feeAB: feeAB,
              feeBC: feeBC,
              feeCA: feeCA,
              recipient: owner.address,
              amountInA: amountInAList[i],
              minReturn: 0,
              deadline: BigNumberjs("1000000000000").toFixed(0),
          
              // delta swap start from tokenA
              clockWise: true,

              blockNumber: quoteResult.blockNumber + 1
            }

            if (tokenA == WBNB) {
              console.log('-------------------------clockwise WBNB in')
              arbitrageReceipt = await izumiAndBiswapDeltaTaker.arbitrage(deltaSwapParams, {from: signer.address,value: amountInAList[i]})
            } else {
              console.log('-------------------------clockwise ERC20 in')
              arbitrageReceipt = await izumiAndBiswapDeltaTaker.arbitrage(deltaSwapParams)
            }
          }
          let antiClockWiseProfit = quoteResult.amountOutAListReverse[i].sub(amountInAList[i])
          console.log(`antiClockWise swap Profit`)
          console.log(antiClockWiseProfit)
          // if arbitrage chance emerges
          if (antiClockWiseProfit.gt('0')) {
            let deltaSwapParams = {
              // three tokens to be swapped
              tokenA: WBNB,
              tokenB: iUSD,
              tokenC: USDT,
          
              // three dex to be used
              dexAB: izumiFactory,
              dexBC: ContractAddresses.zeroAddress,
              dexCA: biswapFactory,
          
              // three pool fees to be used
              feeAB: feeAB,
              feeBC: feeBC,
              feeCA: feeCA,
              recipient: owner.address,
              amountInA: amountInAList[i],
              minReturn: 0,
              deadline: BigNumberjs("1000000000000").toFixed(0),
          
              // delta swap start from tokenA
              clockWise: false,

              blockNumber: quoteResult.blockNumber + 1
            }
            if (tokenA == WBNB) {
              console.log('-------------------------anti clockwise WBNB in')
              arbitrageReceipt =  await izumiAndBiswapDeltaTaker.arbitrage(deltaSwapParams, {from: signer.address,value: amountInAList[i]})
            } else {
              console.log('-------------------------anti clockwise ERC20 in')
              arbitrageReceipt = await izumiAndBiswapDeltaTaker.arbitrage(deltaSwapParams)
            }
          }

          console.log(arbitrageReceipt)
          let gasFee = arbitrageReceipt.maxFeePerGas.mul(arbitrageReceipt.gasLimit)
          gases.push(arbitrageReceipt.gasLimit)
          gasFees.push(gasFee)

          console.log(`tokenIn balance after arbitrage`)
          let tokenABalance1 = await tokenAContract.balanceOf(owner.address)
          console.log(BigNumberjs(tokenABalance1).dividedBy(1e9).dividedBy(1e9).toString())
          console.log(`tokenA profit`)
          console.log(BigNumberjs(tokenABalance1).minus(tokenABalance0).dividedBy(1e9).dividedBy(1e9).toString())
          console.log(`clockwise swap Profit`)
          console.log(BigNumberjs(clockWiseProfit).dividedBy(1e9).dividedBy(1e9).toString())
          console.log(`antiClockWise swap Profit`)
          console.log(BigNumberjs(antiClockWiseProfit).dividedBy(1e9).dividedBy(1e9).toString())
          
          // expect arbitrage result to be the same as quote result
          if (clockWiseProfit.gt('0')) {
            if (tokenAContract.address == WBNB) {
              console.log(BigNumberjs(tokenABalance1).minus(tokenABalance0).toString())
              expect(BigNumberjs(tokenABalance1).minus(tokenABalance0).minus(amountInAList[i]).eq(clockWiseProfit)).eq(true)
            }
            else {
              expect(BigNumberjs(tokenABalance1).minus(tokenABalance0).eq(clockWiseProfit)).eq(true)
            }
          }
          if (antiClockWiseProfit.gt('0')) {
            if (tokenAContract.address == WBNB) {
              expect(BigNumberjs(tokenABalance1).minus(tokenABalance0).minus(amountInAList[i]).eq(antiClockWiseProfit)).eq(true)
            }
            else {
              expect(BigNumberjs(tokenABalance1).minus(tokenABalance0).eq(antiClockWiseProfit)).eq(true)
            }
          }
        }
      }
    }

    console.log(`gases and gasFees`)
    console.log(ss.max(gases))
    console.log(ss.min(gases))
    let gasSum = new BigNumber.from(0)
    for (var gas of gases) {
      gasSum = gasSum.add(gas)
    }
    console.log(gasSum.div(gases.length))
    console.log(ss.rootMeanSquare(gases))
  });
});
