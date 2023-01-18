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

    let izumiQuoter = ContractAddresses.izumiQuoter // bsc
    let izumiFactory = ContractAddresses.izumiFactory // bsc
    let izumiLiquidity = ContractAddresses.izumiLiquidity // bsc

    // load izumiQuoter
    let izumiQuoterAbi = [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "_factory",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "_weth",
            "type": "address"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
      },
      {
        "inputs": [],
        "name": "WETH9",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "factory",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bytes[]",
            "name": "data",
            "type": "bytes[]"
          }
        ],
        "name": "multicall",
        "outputs": [
          {
            "internalType": "bytes[]",
            "name": "results",
            "type": "bytes[]"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "tokenX",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "tokenY",
            "type": "address"
          },
          {
            "internalType": "uint24",
            "name": "fee",
            "type": "uint24"
          }
        ],
        "name": "pool",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "refundETH",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint128",
            "name": "amount",
            "type": "uint128"
          },
          {
            "internalType": "bytes",
            "name": "path",
            "type": "bytes"
          }
        ],
        "name": "swapAmount",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "acquire",
            "type": "uint256"
          },
          {
            "internalType": "int24[]",
            "name": "pointAfterList",
            "type": "int24[]"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint128",
            "name": "desire",
            "type": "uint128"
          },
          {
            "internalType": "bytes",
            "name": "path",
            "type": "bytes"
          }
        ],
        "name": "swapDesire",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "cost",
            "type": "uint256"
          },
          {
            "internalType": "int24[]",
            "name": "pointAfterList",
            "type": "int24[]"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "tokenX",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "tokenY",
            "type": "address"
          },
          {
            "internalType": "uint24",
            "name": "fee",
            "type": "uint24"
          },
          {
            "internalType": "uint128",
            "name": "amount",
            "type": "uint128"
          },
          {
            "internalType": "int24",
            "name": "lowPt",
            "type": "int24"
          }
        ],
        "name": "swapX2Y",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "amountY",
            "type": "uint256"
          },
          {
            "internalType": "int24",
            "name": "finalPoint",
            "type": "int24"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "x",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "y",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "path",
            "type": "bytes"
          }
        ],
        "name": "swapX2YCallback",
        "outputs": [],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "tokenX",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "tokenY",
            "type": "address"
          },
          {
            "internalType": "uint24",
            "name": "fee",
            "type": "uint24"
          },
          {
            "internalType": "uint128",
            "name": "desireY",
            "type": "uint128"
          },
          {
            "internalType": "int24",
            "name": "lowPt",
            "type": "int24"
          }
        ],
        "name": "swapX2YDesireY",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "amountX",
            "type": "uint256"
          },
          {
            "internalType": "int24",
            "name": "finalPoint",
            "type": "int24"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "tokenX",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "tokenY",
            "type": "address"
          },
          {
            "internalType": "uint24",
            "name": "fee",
            "type": "uint24"
          },
          {
            "internalType": "uint128",
            "name": "amount",
            "type": "uint128"
          },
          {
            "internalType": "int24",
            "name": "highPt",
            "type": "int24"
          }
        ],
        "name": "swapY2X",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "amountX",
            "type": "uint256"
          },
          {
            "internalType": "int24",
            "name": "finalPoint",
            "type": "int24"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "x",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "y",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "path",
            "type": "bytes"
          }
        ],
        "name": "swapY2XCallback",
        "outputs": [],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "tokenX",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "tokenY",
            "type": "address"
          },
          {
            "internalType": "uint24",
            "name": "fee",
            "type": "uint24"
          },
          {
            "internalType": "uint128",
            "name": "desireX",
            "type": "uint128"
          },
          {
            "internalType": "int24",
            "name": "highPt",
            "type": "int24"
          }
        ],
        "name": "swapY2XDesireX",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "amountY",
            "type": "uint256"
          },
          {
            "internalType": "int24",
            "name": "finalPoint",
            "type": "int24"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "minAmount",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "recipient",
            "type": "address"
          }
        ],
        "name": "sweepToken",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "minAmount",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "recipient",
            "type": "address"
          }
        ],
        "name": "unwrapWETH9",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ]
    let izumiQuoterAddress = izumiQuoter
    let izumiQuoterContract = await ethers.getContractAt(izumiQuoterAbi, izumiQuoterAddress)

    let fee = 400
    let amountInAList = [0.001]
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

    let quoterResultY2X = await izumiQuoterContract.callStatic.swapY2X(
      quoteParams.tokenX,
      quoteParams.tokenY,
      quoteParams.fee,
      quoteParams.amountInAList[0],
      800001
    );
    console.log('quoterResultY2X')
    console.log(quoterResultY2X)

    let quoterResultX2Y = await izumiQuoterContract.callStatic.swapX2Y(
      quoteParams.tokenX,
      quoteParams.tokenY,
      quoteParams.fee,
      quoteParams.amountInAList[0],
      quoteParams.lowPt
    );
    console.log('quoterResultX2Y')
    console.log(quoterResultX2Y)

  });
});
