// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;
pragma abicoder v2;

import "./interfaces/ISheepQuoter.sol";

import "hardhat/console.sol";

contract SheepQuoterProxy {
  ISheepQuoter public immutable quoter;
  
  constructor (address _quoter){
    quoter = ISheepQuoter(_quoter);
  }
  
  function quoteExactInputSingle(
      address tokenIn,
      address tokenOut,
      uint24 fee,
      uint256[] memory amountInList,
      uint160 sqrtPriceLimitX96
  ) public returns (uint256[] memory){
    uint256[] memory amountOutList = new uint256[](amountInList.length);

    for (uint256 i = 0; i < amountInList.length; i++) {
      amountOutList[i] = quoter.quoteExactInputSingle(
        tokenIn, tokenOut, fee, amountInList[i], sqrtPriceLimitX96
      );
    }
    return amountOutList;
  }
}