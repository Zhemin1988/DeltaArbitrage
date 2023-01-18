// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;
pragma abicoder v2;

import "./IzumiQuoterProxy.sol";
import "./BiswapQuoterProxy.sol";

import "hardhat/console.sol";

contract IzumiAndBiswapDeltaQuoter {
  IzumiQuoterProxy public immutable izumiQuoter;
  BiswapQuoterProxy public immutable biswapQuoter;
  
  constructor (address _izumiQuoter, address _biswapQuoter){
    izumiQuoter = IzumiQuoterProxy(_izumiQuoter);
    biswapQuoter = BiswapQuoterProxy(_biswapQuoter);
  }

  struct QuoteParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    uint256[] amountInList;
  }

  function quoteIzumi(QuoteParams memory quoteParams) public returns (uint256[] memory) {
    // convert uint256 to uint128
    uint128[] memory amountInList128 = new uint128[](quoteParams.amountInList.length);
    for (uint256 i = 0; i < quoteParams.amountInList.length; i++) {
      amountInList128[i] = uint128(quoteParams.amountInList[i]);
    }

    // get amount out list
    uint256[] memory amountOutList = new uint256[](quoteParams.amountInList.length);
    if (quoteParams.tokenIn < quoteParams.tokenOut) {
      amountOutList = izumiQuoter.swapX2Y(
        quoteParams.tokenIn, 
        quoteParams.tokenOut, 
        quoteParams.fee,
        amountInList128,
        -800001
      );
    } else {
      amountOutList = izumiQuoter.swapY2X(
        quoteParams.tokenOut, 
        quoteParams.tokenIn, 
        quoteParams.fee,
        amountInList128,
        800001
      );
    }

    return amountOutList;
  }

  function quoteBiswap(QuoteParams memory quoteParams) public view returns (uint256[] memory) {
    address[] memory path = new address[](2);
    path[0] = quoteParams.tokenIn;
    path[1] = quoteParams.tokenOut;
    uint256[] memory amountOutList = biswapQuoter.getAmountsOut(quoteParams.amountInList, path);
    return amountOutList;
  }

  function quoteByDex (address dex, QuoteParams memory quoteParams) public returns (uint256[] memory) {
    if (dex == address(izumiQuoter.factory())) {
      return quoteIzumi(quoteParams);
    } else if (dex == address(biswapQuoter.factory())) {
      return quoteBiswap(quoteParams);
    } else if (dex == address(0)) {
      return quoteParams.amountInList;
    }
  }

  /// @title The delta arbitrage quote params
  /// @param tokenA The token to start with in delta arbitrage
  /// @param tokenB The second (or last) token to swap clockwisely (or anti-clockwisely)
  /// @param tokenC The last (or second) token to swap clockwisely (or anti-clockwisely)
  /// @param dexAB The dex to swap tokenA (tokenB) for tokenB (A) clockwisely (or anti-clockwisely)
  /// @param dexBC The dex to swap tokenB (tokenC) for tokenC (B) clockwisely (or anti-clockwisely)
  /// @param dexCA The dex to swap tokenC (tokenA) for tokenA (C) clockwisely (or anti-clockwisely)
  /// @param feeAB The fee of pool to swap tokenA (tokenB) for tokenB (A) clockwisely (or anti-clockwisely)
  /// @param feeBC The fee of pool to swap tokenB (tokenC) for tokenC (B) clockwisely (or anti-clockwisely)
  /// @param feeCA The fee of pool to swap tokenC (tokenA) for tokenA (C) clockwisely (or anti-clockwisely)
  /// @param amountInA The amount of tokenA used for delta arbitrage
  struct DeltaQuoteParams {
    // three tokens to be swapped
    address tokenA;
    address tokenB;
    address tokenC;

    // three dex to be used
    address dexAB;
    address dexBC;
    address dexCA;

    // three pool fees to be used
    uint24 feeAB;
    uint24 feeBC;
    uint24 feeCA;

    // delta swap start from tokenA
    uint256[] amountInAList;
  }

  function deltaQuote(DeltaQuoteParams memory deltaQuoteParams) public returns (uint256[] memory, uint256[] memory) { 
    uint256[] memory amountInOffChainList;
    
    QuoteParams memory quoteParamsAB = QuoteParams({
      tokenIn: deltaQuoteParams.tokenA,
      tokenOut: deltaQuoteParams.tokenB,
      fee: deltaQuoteParams.feeAB,
      amountInList: deltaQuoteParams.amountInAList
    });

    uint256[] memory amountOutBList = quoteByDex(deltaQuoteParams.dexAB, quoteParamsAB);

    QuoteParams memory quoteParamsBC = QuoteParams ({
      tokenIn: deltaQuoteParams.tokenB,
      tokenOut: deltaQuoteParams.tokenC,
      fee: deltaQuoteParams.feeBC,
      amountInList: amountOutBList
    });

    uint256[] memory amountOutCList = quoteByDex(deltaQuoteParams.dexBC, quoteParamsBC);

    QuoteParams memory quoteParamsCA = QuoteParams ({
      tokenIn: deltaQuoteParams.tokenC,
      tokenOut: deltaQuoteParams.tokenA,
      fee: deltaQuoteParams.feeCA,
      amountInList: amountOutCList
    });

    uint256[] memory amountOutAList = quoteByDex(deltaQuoteParams.dexCA, quoteParamsCA);

    if (deltaQuoteParams.dexAB == address(0)) {
      amountInOffChainList = amountOutBList;
    } else if (deltaQuoteParams.dexBC == address(0)) {
      amountInOffChainList = amountOutCList;
    } else if (deltaQuoteParams.dexCA == address(0)) {
      amountInOffChainList = amountOutAList;
    }

    return (amountOutAList, amountInOffChainList);
  }

  struct QuoteResult {
    uint256[] amountOutAList;
    uint256[] amountInOffChainList;
    uint256[] amountOutAListReverse;
    uint256[] amountInOffChainListReverse;
    uint256 blockNumber;
    uint256 blockTime;
    bytes32 parentBlockHash;
  }

  function arbitrageQuote(DeltaQuoteParams calldata params) public returns (QuoteResult memory) { 
    // clockwise swap
    QuoteResult memory quoteResult;
    (uint256[] memory amountOutAList, uint256[] memory amountInOffChainList) = deltaQuote(params);

    // anti-clockwise swap
    DeltaQuoteParams memory params1 = DeltaQuoteParams({
      // three tokens to be swapped
      tokenA: params.tokenA,
      tokenB: params.tokenC,
      tokenC: params.tokenB,
      dexAB: params.dexCA,
      dexBC: params.dexBC,
      dexCA: params.dexAB,
      feeAB: params.feeCA,
      feeBC: params.feeBC,
      feeCA: params.feeAB,
      amountInAList: params.amountInAList
    });
    (uint256[] memory amountOutAListReverse, uint256[] memory amountInOffChainListReverse) = deltaQuote(params1);
    
    quoteResult.amountOutAList = amountOutAList;
    quoteResult.amountInOffChainList = amountInOffChainList;
    quoteResult.amountOutAListReverse = amountOutAListReverse;
    quoteResult.amountInOffChainListReverse = amountInOffChainListReverse;

    quoteResult.blockNumber = block.number;
    quoteResult.blockTime = block.timestamp;
    quoteResult.parentBlockHash = blockhash(quoteResult.blockNumber - 1);

    return quoteResult;
  }
}