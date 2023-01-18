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
const ABIs = require("../utils/ABIs")

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

describe("charge test account", function () {
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
  let izumiSwapAddress = ContractAddresses.izumiSwap
  let izumiQuoter = ContractAddresses.izumiQuoter

  // get biswap router and factory address
  let biswapRouter = ContractAddresses.biswapRouter // bsc
  let biswapQuoter = ContractAddresses.biswapRouter // bsc
  let biswapFactory = ContractAddresses.biswapFactory // bsc
  
  let nflm
  let izumiProxy
  let biswapProxy
  let izumiAndBiswapQuoter
  let izumiAndBiswapTaker
  
  it("Should charge test account", async function () {
    // get owner
    let owner, addrs;
    [owner, ...addrs] = await ethers.getSigners();
    console.log(`Owner address: ${owner.address}`)
    let payer = addrs[addrs.length - 1]

    // get signer
    let provider = ethers.getDefaultProvider('http://localhost:8545')
    const privateKey = process.env.PRIVATE_KEY
    let signer = new ethers.Wallet(privateKey, provider);
    console.log('Using signer address ' + signer.address);

    // get biswap router02
    let biswapRouterAbi = ABIs.biswapRouter
    let router02 = await ethers.getContractAt(biswapRouterAbi, biswapRouter);
    router02 = router02.connect(payer)

    // get biswap router02
    let izumiSwapAbi = ABIs.izumiSwap
    let izumiSwap = await ethers.getContractAt(izumiSwapAbi, izumiSwapAddress);
    izumiSwap = izumiSwap.connect(payer)

    // let pathList = [[WBNB, USDT], [WBNB, BSW], [WBNB, WETH]]
    let pathList = [[WBNB, USDT]]

    for (var i = 0; i < pathList.length; i++) {
      let path = pathList[i]
      let ERC20Abi = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"tokens","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"withdrawEther","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"_totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"tokenOwner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeSub","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transfer","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeDiv","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"tokens","type":"uint256"},{"name":"data","type":"bytes"}],"name":"approveAndCall","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeMul","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token.address","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transferAnyERC20Token","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"tokenOwner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeAdd","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_from","type":"address"},{"indexed":true,"name":"_to","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"tokens","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"tokenOwner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"tokens","type":"uint256"}],"name":"Approval","type":"event"}];
      let swapToken = await ethers.getContractAt(ERC20Abi, path[1])
      swapToken = swapToken.connect(payer)
      let deadline = '0x' + (Math.round(Date.now()/1000)+ 60 * 20).toString(16)
      
      // swap 10 BNB for ERC20 tokens in biswap
      let amountIn = 10
      amountIn = new BigNumber.from(amountIn).mul(1e9).mul(1e9)

      console.log(`charge native token begin`)
      let signerBalance0 = await web3.eth.getBalance(signer.address)
      // charge signer native token
      await web3.eth.sendTransaction({from: payer.address, value: amountIn, to: signer.address})
      let signerBalance1 = await web3.eth.getBalance(signer.address)
      console.log(`charge native token end`)

      console.log(`charge token ${path[1]} begin`)
      // swap exact eth for tokens
      await router02.swapExactETHForTokens(0, path, signer.address, deadline, {from: payer.address, value: amountIn});
      console.log(`charge token ${path[1]} end`)

      let signerSwapTokenBalance = await swapToken.balanceOf(signer.address)

      // expect signer received right amount of native token and swapped token
      expect(BigNumberjs(signerBalance1).minus(signerBalance0).eq(amountIn)).eq(true)
      expect(signerSwapTokenBalance.gt(0)).eq(true)
    }

    let pathList1 = [[WBNB, iUSD]]
    for (var i = 0; i < pathList1.length; i++) {
      let path = pathList1[i]
      let ERC20Abi = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"tokens","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"withdrawEther","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"_totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"tokenOwner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeSub","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transfer","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeDiv","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"tokens","type":"uint256"},{"name":"data","type":"bytes"}],"name":"approveAndCall","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeMul","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token.address","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transferAnyERC20Token","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"tokenOwner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"}],"name":"safeAdd","outputs":[{"name":"c","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_from","type":"address"},{"indexed":true,"name":"_to","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"tokens","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"tokenOwner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"tokens","type":"uint256"}],"name":"Approval","type":"event"}];
      let swapToken = await ethers.getContractAt(ERC20Abi, path[1])
      swapToken = swapToken.connect(payer)
      let deadline = '0x' + (Math.round(Date.now()/1000)+ 60 * 20).toString(16)
      
      // swap 10 BNB for ERC20 tokens in biswap
      let amountIn = 10
      amountIn = new BigNumber.from(amountIn).mul(1e9).mul(1e9)

      console.log(`charge native token begin`)
      let signerBalance0 = await web3.eth.getBalance(signer.address)
      // charge signer native token
      await web3.eth.sendTransaction({from: payer.address, value: amountIn, to: signer.address})
      let signerBalance1 = await web3.eth.getBalance(signer.address)
      console.log(`charge native token end`)

      console.log(`charge token ${path[1]} begin`)
      // swap exact eth for tokens
      path[0].toLowerCase() < path[1].toLowerCase() ? 
        await izumiSwap.swapX2Y(
          {
            tokenX: path[0],
            tokenY: path[1],
            fee: 400,
            boundaryPt: -800001,
            recipient: signer.address,
            amount: amountIn,
            maxPayed: new BigNumber.from(0),
            minAcquired: new BigNumber.from(0),
            deadline: deadline
          }, {from: payer.address, value: amountIn}) :
          await izumiSwap.swapY2X(
            {
              tokenX: path[1],
              tokenY: path[0],
              fee: 400,
              boundaryPt: 800001,
              recipient: signer.address,
              amount: amountIn,
              maxPayed: new BigNumber.from(0),
              minAcquired: new BigNumber.from(0),
              deadline: deadline
            }, {from: payer.address, value: amountIn})
      
      console.log(`charge token ${path[1]} end`)

      let signerSwapTokenBalance = await swapToken.balanceOf(signer.address)

      // expect signer received right amount of native token and swapped token
      expect(BigNumberjs(signerBalance1).minus(signerBalance0).eq(amountIn)).eq(true)
      expect(signerSwapTokenBalance.gt(0)).eq(true)
    }
  });
});
