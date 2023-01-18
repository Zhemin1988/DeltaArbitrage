# dex-arbitrage

## Set up Environment

install node.js(12.X) and npm

## set up .env file
please set up .env file as follows:

```
ROPSTEN_URL=https://eth-ropsten.alchemyapi.io/v2/<YOUR ALCHEMY KEY>
BSC_URL=https://bsc-dataseed.binance.org/ 
POLYGON_URL=https://polygon-rpc.com

ETH_ARCHIVE_0=https://speedy-nodes-nyc.moralis.io/64fb2027c9febed416c49acc/eth/mainnet/archive
ETH_ARCHIVE_1=https://speedy-nodes-nyc.moralis.io/14845a22f3cf08ba28b604b8/eth/mainnet/archive
BSC_ARCHIVE_0=https://speedy-nodes-nyc.moralis.io/64fb2027c9febed416c49acc/bsc/mainnet/archive
BSC_ARCHIVE_1=https://speedy-nodes-nyc.moralis.io/14845a22f3cf08ba28b604b8/bsc/mainnet/archive
POLYGON_ARCHIVE_0=https://speedy-nodes-nyc.moralis.io/64fb2027c9febed416c49acc/polygon/mainnet/archive
POLYGON_ARCHIVE_1=https://speedy-nodes-nyc.moralis.io/14845a22f3cf08ba28b604b8/polygon/mainnet/archive

ETH_BLOCK_NUMBER=
BSC_BLOCK_NUMBER=18048062
POLYGON_BLOCK_NUMBER=

ETH_CHAIN_ID=1
BSC_CHAIN_ID=56
POLYGON_CHAIN_ID=137

TEST_POOL_FEE=400

PRIVATE_KEY=<place the test account 0x7271b723F864d77Db16C20dDf0eC8b78Df05aeb2 private key here> 
```


## Compile from source

##### 1. clone repo from github

```
$ git clone ssh://git@gogs.asymmfund.com:1111/zmz/DeltaArbitrage.git
```

suppose the root dir of the project is `${DEX_ARBITRAGE}`

##### 2. checkout the branch
cd to the dir `${DEX_ARBITRAGE}` and checkout to the branch you want

##### 3. install denpendencies
install the package listed in the `package.json` via npm

##### 4. compile
compile via following command

```
$ npx hardhat compile
```

##### 5. compiled json file
after compile, the abi and code of the contracts can be found in files `artifacts/*.sol/*.json`

## Run test cases

##### 2. charge test account
run
```
$ npx hardhat test test/testChargeAccount.js
```
to charge test account with BNB, iUSD and USDT


##### 3. run test case
run
```
$ npx hardhat test test/testIzumiAndBiswapDeltaQuoter.js
```
to quote 

run
```
$ npx hardhat test test/testIzumiAndBiswapDeltaTaker.js
```
to test delta arbitrage

Please note that if the local node does not respond in time to raise timeout error while executing the above commands. Please rerun the failed command due to timeout till success.


## Info

```solidity
/*
    There is one quoteExactInputSingle function in SheepQuoterProxy, which is used to query a list of amounts.
*/

/*
    There are three functions in BiswapQuoterProxy for different queries.
    - getAmountsIn: get amounts input given amounts output and token in and token out
    - getAmountsOut: get amounts output given amounts input and token in and token out 
    - getLiquidity: get reserve input, reserve output and K value given token in and token out
*/

/*
    There are four functions in IzumiQuoterProxy for different queries.
    - swapX2Y: get output amounts of tokenY given input amounts of tokenX, swap fee and low point
    - swapY2X: get output amounts of tokenX given input amounts of tokenY, swap fee and heigh point
    - quoteLiquidity: get liquidity info given NFT id 
    - getCurrentPoint: get current point given tokenX address, tokenY address and swap fee
*/

/*
    There are five functions in IzumiAndBiswapDeltaQuoter for different queries.
    - quoteIzumi: get output amounts of tokenOut from izumi given input amounts of tokenIn, swap fee
    - quoteBiswap: get output amounts of tokenOut from biswap given input amounts of tokenIn, swap fee which can be omitted since biswap has default swap fee
    - quoteByDex: get output amounts of tokenOut given input amounts of tokenIn, swap fee and selected dex
    - quoteByDex: get output amounts of tokenOut given input amounts of tokenIn, swap fee and selected dex
    - deltaQuote: get output amounts of tokenA given input amounts of tokenA and the delta swapping path along the delta arbitrage
    - arbitrageQuote: get output amounts of tokenA in both clockwise and anticlockwise delta swap
*/

/*
    There are seven functions in IzumiAndBiswapDeltaTaker for different swaps.
    - swapX2Y: swap exact input amounts of tokenX for tokenY in izumi
    - swapY2X: swap exact input amounts of tokenY for tokenX in izumi
    - izumiSwapInForOut: swap exact input amounts of tokenIn for tokenOut in izumi
    - biswapSwap: swap exact input amounts of the first token for the last token along the given path in biswap
    - swapByDex: swap exact input amounts of tokenIn for tokenOut in selected dex
    - deltaSwap: swap exact input amounts of tokenA given the delta swapping path along the delta arbitrage
    - arbitrage: arbitrage with given amount of tokenA, minimum return, swap direction and the delta swapping path, the arbitrage will revert if the returned amount of tokenIn is out of slippage tolerance
*/
```
