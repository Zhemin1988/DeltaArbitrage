// get sheep factory, liquidity manager, swap and quoter address
let sheepFactory = "0x571521f8c16f3c4eD5f2490f19187bA7A5A3CBDf" // bsc
let sheepNFTLiquidity = "0x754ca67EFD5951960C43Dd78063277EC50A86628" // bsc
let sheepRouter = "0xcD87782A717F40542e18C61Ebb7210d3132e17d8" // bsc
let sheepQuoter = "0x6fbe54c589d3aC30DCd8FdD4fcB84C1b43f1F552" // bsc

// get izumi factory, liquidity manager, swap and quoter address
let izumiFactory = "0xd7de110Bd452AAB96608ac3750c3730A17993DE0" // bsc
let izumiLiquidity = "0x93C22Fbeff4448F2fb6e432579b0638838Ff9581" // bsc
let izumiSwap = "0xBd3bd95529e0784aD973FD14928eEDF3678cfad8" // bsc
let izumiQuoter = "0x12a76434182c8cAF7856CE1410cD8abfC5e2639F" // bsc

// get biswap router and factory address
let biswapRouter = "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8" // bsc
let biswapQuoter = "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8" // bsc
let biswapFactory = "0x858E3312ed3A876947EA49d572A7C42DE08af7EE" // bsc

// get izumi quoter proxy address
let izumiQuoterProxy = "0x5a19A3B6111f3417F238c05C02C5e5331Dcb6f3d" // bsc

// get biswap quoter proxy address
let biswapQuoterProxy = "0xD5F3b38b94369A17eAf25e584A69e9770191106d" // bsc

// zero address
let zeroAddress = "0x0000000000000000000000000000000000000000" // bsc

module.exports = {
    sheepFactory: sheepFactory,
    sheepNFTLiquidity: sheepNFTLiquidity,
    sheepRouter: sheepRouter,
    sheepQuoter: sheepQuoter,
    izumiFactory: izumiFactory,
    izumiLiquidity: izumiLiquidity,
    izumiSwap: izumiSwap,
    izumiQuoter: izumiQuoter,
    biswapFactory: biswapFactory,
    biswapQuoter: biswapQuoter,
    biswapRouter: biswapRouter,
    izumiQuoterProxy: izumiQuoterProxy,
    biswapQuoterProxy: biswapQuoterProxy,
    zeroAddress: zeroAddress,
}