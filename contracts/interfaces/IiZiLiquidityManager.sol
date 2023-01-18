// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

import "hardhat/console.sol";


interface IiZiLiquidityManager {

    // infomation of liquidity provided by miner
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
    }

    /// @notice mapping from nftId to Liquidity info
    function liquidities(uint256) external returns (Liquidity memory);

    struct PoolMeta {
        // tokenX of pool
        address tokenX;
        // tokenY of pool
        address tokenY;
        // fee amount of pool
        uint24 fee;
    }

    /// @notice mapping from poolId to meta info of pool
    function poolMetas(uint128) external returns (PoolMeta memory);

    /// @notice mapping from address to poolId within this contract
    function poolIds(uint128) external returns (address);
}