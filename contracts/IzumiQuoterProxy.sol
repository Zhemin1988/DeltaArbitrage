// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;
pragma abicoder v2;

import "./interfaces/IiZiQuoter.sol";
import "./interfaces/IiZiLiquidityManager.sol";
import "./interfaces/IiZiSwapFactory.sol";
import "./interfaces/IiZiSwapPool.sol";

import "./libraries/AmountMath.sol";
import "./libraries/LogPowMath.sol";

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

import "hardhat/console.sol";

contract IzumiQuoterProxy {
  IiZiQuoter public immutable quoter;
  IiZiLiquidityManager public immutable manager;
  IiZiSwapFactory public immutable factory;
  
  constructor (address _quoter, address _factory, address _manager){
    quoter = IiZiQuoter(_quoter);
    factory = IiZiSwapFactory(_factory);
    manager = IiZiLiquidityManager(_manager);
  }
  
  function swapX2Y(
      address tokenX,
      address tokenY,
      uint24 fee,
      uint128[] memory amountInList,
      int24 lowPt
  ) public returns (uint256[] memory){
    uint256[] memory amountOutList = new uint256[](amountInList.length);
    uint256 amountOut;
    int24 pt;
    for (uint256 i = 0; i < amountInList.length; i++) {
        (amountOut, pt) = quoter.swapX2Y(
          tokenX, tokenY, fee, amountInList[i], lowPt
        );
      amountOutList[i] = amountOut;
    }
    return amountOutList;
  }

  function swapY2X(
      address tokenX,
      address tokenY,
      uint24 fee,
      uint128[] memory amountInList,
      int24 highPt
  ) public returns (uint256[] memory){
    uint256[] memory amountOutList = new uint256[](amountInList.length);
    uint256 amountOut;
    int24 pt;
    for (uint256 i = 0; i < amountInList.length; i++) {
        (amountOut, pt) = quoter.swapY2X(
          tokenX, tokenY, fee, amountInList[i], highPt
        );
      amountOutList[i] = amountOut;
    }
    return amountOutList;
  }



  struct Liquidity {
    // left point of liquidity-token, the range is [leftPt, rightPt)
        int24 leftPt;
        // right point of liquidity-token, the range is [leftPt, rightPt)
        int24 rightPt;
        // amount of liquidity on each point in [leftPt, rightPt)
        uint128 liquidity;
        // a 128-fixpoint number, as integral of { fee(pt, t)/L(pt, t) }. 
        // here fee(pt, t) denotes fee generated on point pt at time t
        // L(pt, t) denotes liquidity on point pt at time t
        // pt varies in [leftPt, rightPt)
        // t moves from pool created until miner last modify this liquidity-token (mint/addLiquidity/decreaseLiquidity/create)
        uint256 lastFeeScaleX_128;
        uint256 lastFeeScaleY_128;
        // remained tokenX miner can collect, including fee and withdrawed token
        uint256 remainTokenX;
        uint256 remainTokenY;
        // id of pool in which this liquidity is added
        uint128 poolId;
        // current point
        int24 currentPoint;

        address tokenX;
        address tokenY;

        uint256 amountX;
        uint256 amountY;

        uint24 fee;
  }

  function quoteLiquidity (uint256 lid) public returns (Liquidity memory){
        IiZiLiquidityManager.Liquidity memory liquidity = manager.liquidities(lid);
        uint128 poolId = liquidity.poolId;
        IiZiLiquidityManager.PoolMeta memory poolMeta = manager.poolMetas(poolId);
        address poolAddr = factory.pool(poolMeta.tokenX, poolMeta.tokenY, poolMeta.fee);
        IiZiSwapPool pool = IiZiSwapPool(poolAddr);
        (, int24 currentPoint, , , , , ,) = pool.state();

        Liquidity memory liquidity1;
        liquidity1.leftPt = liquidity.leftPt;
        liquidity1.rightPt = liquidity.rightPt;
        liquidity1.liquidity = liquidity.liquidity;
        liquidity1.lastFeeScaleX_128 = liquidity.lastFeeScaleX_128;
        liquidity1.lastFeeScaleY_128 = liquidity.lastFeeScaleY_128;
        liquidity1.remainTokenX = liquidity.remainTokenX;
        liquidity1.remainTokenY = liquidity.remainTokenY;
        liquidity1.poolId = liquidity.poolId;
        liquidity1.currentPoint = currentPoint;
        liquidity1.tokenX = poolMeta.tokenX;
        liquidity1.tokenY = poolMeta.tokenY;

        (uint256 amountX, uint256 amountY) = getAmounts(liquidity1);
        liquidity1.amountX = amountX;
        liquidity1.amountY = amountY;

        liquidity1.fee = poolMeta.fee;

        return liquidity1;
  }

  function getAmounts (Liquidity memory liquidity) public pure returns (uint256, uint256){
    uint160 sqrtRate_96 = LogPowMath.getSqrtPrice(1);

    uint256 x = 0;
    uint256 y = 0;
    uint256 yc = 0;

    uint256 amountY = 0;
    int24 pc = liquidity.currentPoint;
    uint160 sqrtPrice_96 = LogPowMath.getSqrtPrice(pc);
    int24 leftPoint = liquidity.leftPt;
    int24 rightPoint = liquidity.rightPt;
    uint128 liquidDelta = liquidity.liquidity;

    uint160 sqrtPriceR_96 = LogPowMath.getSqrtPrice(rightPoint);
    uint160 _sqrtRate_96 = sqrtRate_96;
    if (leftPoint < pc) {
        uint160 sqrtPriceL_96 = LogPowMath.getSqrtPrice(leftPoint);
        uint256 yl;
        if (rightPoint < pc) {
            yl = AmountMath.getAmountY(liquidDelta, sqrtPriceL_96, sqrtPriceR_96, _sqrtRate_96, true);
        } else {
            yl = AmountMath.getAmountY(liquidDelta, sqrtPriceL_96, sqrtPrice_96, _sqrtRate_96, true);
        }
        amountY += yl;
    }
    if (rightPoint > pc) {
        // we need compute XR
        int24 xrLeft = (leftPoint > pc) ? leftPoint : pc + 1;
        uint256 xr = AmountMath.getAmountX(
            liquidDelta,
            xrLeft,
            rightPoint,
            sqrtPriceR_96,
            _sqrtRate_96,
            true
        );
        x = uint128(xr);
        require(x == xr, "XOFL");
    }
    if (leftPoint <= pc && rightPoint > pc) {
        // we need compute yc at point of current price
        yc = _computeDepositYc(
            liquidDelta,
            sqrtPrice_96
        );
        amountY += yc;
    } else {
        yc = 0;
    }
    y = uint128(amountY);
    require(y == amountY, "YOFL");
    return (x, y);
  }

  function _computeDepositYc(
        uint128 liquidDelta,
        uint160 sqrtPrice_96
  ) private pure returns (uint128 y) {
      // to simplify computation, 
      // minter is required to deposit only token y in point of current price
      uint256 amount = MulDivMath.mulDivCeil(
          liquidDelta,
          sqrtPrice_96,
          TwoPower.Pow96
      );
      y = uint128(amount);
      require (y == amount, "YC OFL");
  }

  function getCurrentPoint (address tokenX, address tokenY, uint24 fee) public view returns (int24){
    address poolAddr = factory.pool(tokenX, tokenY, fee);
        IiZiSwapPool pool = IiZiSwapPool(poolAddr);
        (, int24 currentPoint, , , , , ,) = pool.state();
        return currentPoint;
  }

  function getLids (address owner) public view returns (uint256[] memory){
    IERC721Enumerable liquidityNFT = IERC721Enumerable(address(manager));
    uint256 lidBalance = liquidityNFT.balanceOf(owner) ;
    uint256[] memory lids = new uint256[](lidBalance);

    for (uint256 i = 0; i <lidBalance; i++) {
      lids[i] = liquidityNFT.tokenOfOwnerByIndex(owner, i);
    }
    return lids;
  }
}