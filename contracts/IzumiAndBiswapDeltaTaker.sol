// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IiZiSwap.sol";
import "./interfaces/IBiswapRouter02.sol";
import "./IzumiQuoterProxy.sol";
import "./BiswapQuoterProxy.sol";

import "./libraries/SafeCast.sol";
import "./libraries/TransferHelper.sol";

import "hardhat/console.sol";

contract IzumiAndBiswapDeltaTaker is Ownable {
  IiZiSwap public immutable izumiSwap;
  IBiswapRouter02 public immutable biswapRouter02;
  IzumiQuoterProxy public immutable izumiQuoter;
  BiswapQuoterProxy public immutable biswapQuoter;

  using SafeCast for uint256;

  event ArbitrageResult(address tokenA, uint256 amountInA, int256 amountADelta);
  
  constructor (
    address _izumiSwap, 
    address _biswapRouter02, 
    address _izumiQuoter, 
    address _biswapQuoter
  ){
    izumiSwap = IiZiSwap(_izumiSwap);
    biswapRouter02 = IBiswapRouter02(_biswapRouter02);
    izumiQuoter = IzumiQuoterProxy(_izumiQuoter);
    biswapQuoter = BiswapQuoterProxy(_biswapQuoter);
  }

  // swap tokenX for tokenY in izumi
  function swapX2Y(IiZiSwap.SwapParams memory params) internal onlyOwner returns (uint256) {
    address tokenX =  params.tokenX;
    address tokenY = params.tokenY;
    uint256 amount = params.amount;

    require(tokenX < tokenY, "tokenX < tokenY");

    uint256 tokenYBalance0 = IERC20(tokenY).balanceOf(params.recipient);

    // if use native token to swap
    if (tokenX == izumiSwap.WETH9() && address(this).balance >= amount){
        console.log("izumi WBNB swapX2Y");
        izumiSwap.swapX2Y{value: amount}(params);

        // get remaining native token back
        uint256 remainingETH = address(izumiSwap).balance;
        if (remainingETH > 0){
            izumiSwap.refundETH();
            TransferHelper.safeTransferETH(msg.sender, address(this).balance);
        }
    } else {
        console.log("izumi ERC20 swapX2Y");
        TransferHelper.safeTransferFrom(tokenX, msg.sender, address(this), amount);
        TransferHelper.safeApprove(tokenX, address(izumiSwap), amount);
        izumiSwap.swapX2Y(params);

        // get remaining tokenX back
        uint256 remainingTokenX = IERC20(tokenX).balanceOf(address(this));
        if (remainingTokenX > 0){
            IERC20(tokenX).transfer(msg.sender, remainingTokenX);
        }
    }

    uint256 tokenYBalance1 = IERC20(tokenY).balanceOf(params.recipient);
    uint256 amountOut = tokenYBalance1 - tokenYBalance0;
    return amountOut;
  }

  // swap tokenY for tokenX in izumi
  function swapY2X(IiZiSwap.SwapParams memory params) internal onlyOwner returns (uint256) {
    address tokenX =  params.tokenX;
    address tokenY = params.tokenY;
    uint256 amount = params.amount;

    require(tokenX < tokenY, "tokenX < tokenY");

    uint256 tokenXBalance0 = IERC20(tokenX).balanceOf(params.recipient);

    // if use native token to swap
    if (tokenY == izumiSwap.WETH9() && address(this).balance >= amount){
        console.log("izumi WBNB swapY2X");
        izumiSwap.swapY2X{value: amount}(params);

        // get remaining native token back
        uint256 remainingETH = address(izumiSwap).balance;
        if (remainingETH > 0){
            izumiSwap.refundETH();
            TransferHelper.safeTransferETH(msg.sender, address(this).balance);
        }
    } else {
        console.log("izumi ERC20 swapY2X");
        TransferHelper.safeTransferFrom(tokenY, msg.sender, address(this), amount);
        TransferHelper.safeApprove(tokenY, address(izumiSwap), amount);
        izumiSwap.swapY2X(params);

        // get remaining tokenIn back
        uint256 remainingTokenY = IERC20(tokenY).balanceOf(address(this));
        if (remainingTokenY > 0){
            IERC20(tokenY).transfer(msg.sender, remainingTokenY);
        }
    }

    uint256 tokenXBalance1 = IERC20(tokenX).balanceOf(params.recipient);
    uint256 amountOut = tokenXBalance1 - tokenXBalance0;
    return amountOut;
  }

  // swap tokenIn for tokenOut in izumi
  function izumiSwapInForOut (
    address tokenIn,
    address tokenOut,
    uint24 fee,
    address recipient,
    uint256 amountIn,
    uint256 deadline
  ) internal onlyOwner returns (uint256){
    uint256 amountOut;

    if (tokenIn < tokenOut) {
      amountOut = swapX2Y(IiZiSwap.SwapParams({
        tokenX: tokenIn,
        tokenY: tokenOut,
        fee: fee,
        boundaryPt: -800001,
        recipient: recipient,
        amount: uint128(amountIn),
        maxPayed: 0,
        minAcquired: 0,
        deadline: deadline
      }));
    } else {
      amountOut = swapY2X(IiZiSwap.SwapParams({
        tokenX: tokenOut,
        tokenY: tokenIn,
        fee: fee,
        boundaryPt: 800001,
        recipient: recipient,
        amount: uint128(amountIn),
        maxPayed: 0,
        minAcquired: 0,
        deadline: deadline
      }));
    }

    return amountOut;
  }

  // swap tokenIn for tokenOut in biswap
  function biswapSwap (
    uint amountIn,
    uint amountOutMin,
    address[] memory path,
    address to,
    uint deadline
  ) internal onlyOwner returns (uint256){
    uint256[] memory amountOuts;

    // if use native token to swap
    if (path[0] == biswapRouter02.WETH() && address(this).balance >= amountIn){
        console.log("biswap swapExactETHForTokens");
        console.log("amountIn: %s", amountIn);
        console.log("taker contract balance: %s", address(this).balance);
        amountOuts = biswapRouter02.swapExactETHForTokens{value: amountIn}(amountOutMin, path, to, deadline);
    } else {
        console.log("biswap swapExactTokensForTokens");
        TransferHelper.safeTransferFrom(path[0], msg.sender, address(this), amountIn);
        TransferHelper.safeApprove(path[0], address(biswapRouter02), amountIn);
        amountOuts = biswapRouter02.swapExactTokensForTokens(amountIn, amountOutMin,path, to, deadline);
    }

    return amountOuts[amountOuts.length - 1];
  }

  /// @title The delta arbitrage swap params
  /// @param tokenA The token to start with in delta arbitrage
  /// @param tokenB The second (or last) token to swap clockwisely (or anti-clockwisely)
  /// @param tokenC The last (or second) token to swap clockwisely (or anti-clockwisely)
  /// @param dexAB The dex to swap tokenA (tokenB) for tokenB (A) clockwisely (or anti-clockwisely)
  /// @param dexBC The dex to swap tokenB (tokenC) for tokenC (B) clockwisely (or anti-clockwisely)
  /// @param dexCA The dex to swap tokenC (tokenA) for tokenA (C) clockwisely (or anti-clockwisely)
  /// @param feeAB The fee of pool to swap tokenA (tokenB) for tokenB (A) clockwisely (or anti-clockwisely)
  /// @param feeBC The fee of pool to swap tokenB (tokenC) for tokenC (B) clockwisely (or anti-clockwisely)
  /// @param feeCA The fee of pool to swap tokenC (tokenA) for tokenA (C) clockwisely (or anti-clockwisely)
  /// @param recipient The recipient address
  /// @param amountInA The amount of tokenA used for delta arbitrage
  /// @param minReturn The minimum return ratio of tokenA
  /// @param deadline The swap deadline
  /// @param clockWise The swap direction: true, A - B - C - A; false, A - C - B - A
  struct DeltaSwapParams {
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

    // recipient of tokenA
    address recipient;

    // delta swap start from tokenA
    uint256 amountInA;

    // minimum return ratio of tokenA
    int24 minReturn;

    // swap deadline
    uint256 deadline;

    // swap direction: true, A - B - C - A; false, A - C - B - A
    bool clockWise;

    uint256 blockNumber;

  }

  // swap tokenIn for tokenOut in selected dex
  function swapByDex (
    address dex,
    address tokenIn,
    address tokenOut,
    uint24 fee,
    address recipient,
    uint256 amountIn,
    uint256 deadline
  ) internal onlyOwner returns (uint256) {
    uint256 amountOut;

    if (dex == izumiSwap.factory()) {
      amountOut = izumiSwapInForOut(
        tokenIn, 
        tokenOut,
        fee,
        recipient,
        amountIn,
        deadline
      );
    } else if (dex == biswapRouter02.factory()) {
      address[] memory path= new address[](2);
      path[0] = tokenIn;
      path[1] = tokenOut;

      amountOut = biswapSwap(
        amountIn,
        0,
        path,
        recipient,
        deadline
      );
    } else if (dex == address(0)) {
      amountOut = amountIn;
    }

    return amountOut;
  }

  function deltaSwap (DeltaSwapParams memory params) internal onlyOwner returns (uint256) {
    // swap tokenA for tokenB
    uint256 amountOutB = swapByDex(
      params.dexAB,
      params.tokenA,
      params.tokenB,
      params.feeAB,
      params.recipient,
      params.amountInA,
      params.deadline
    );

    // swap tokenB for tokenC
    uint256 amountOutC = swapByDex(
      params.dexBC,
      params.tokenB,
      params.tokenC,
      params.feeBC,
      params.recipient,
      amountOutB,
      params.deadline
    );

    // swap tokenC for tokenA
    uint256 amountOutA = swapByDex(
      params.dexCA,
      params.tokenC,
      params.tokenA,
      params.feeCA,
      params.recipient,
      amountOutC,
      params.deadline
    );

    return amountOutA;
  }
  
  function arbitrage (DeltaSwapParams memory params) public payable onlyOwner returns (int256) {
    require( block.number <= params.blockNumber, "BNE");
    uint256 amountOutA;

    if (params.clockWise) {
      // swap clockwisely
      amountOutA = deltaSwap(params);
    } else {
      // swap anti-clockwisely
      DeltaSwapParams memory params1 = DeltaSwapParams({
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
        recipient: params.recipient,
        amountInA: params.amountInA,
        minReturn: params.minReturn,
        deadline: params.deadline,
        clockWise: params.clockWise,
        blockNumber: params.blockNumber
      });
      amountOutA = deltaSwap(params1);
    }

    int256 amountADelta = amountOutA.toInt256() - params.amountInA.toInt256();
    emit ArbitrageResult(params.tokenA, params.amountInA, amountADelta);
    require(amountADelta >= params.amountInA.toInt256() * params.minReturn / 1e6, "MRE");
    
    return amountADelta;
  }
}