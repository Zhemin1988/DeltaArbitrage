pragma solidity >=0.7.5;
pragma abicoder v2;

import "./interfaces/IBiswapQuoter.sol";
import "./interfaces/IBiswapPair.sol";
import "./interfaces/IBiswapFactory.sol";

import "hardhat/console.sol";

contract BiswapQuoterProxy {
    IBiswapQuoter public immutable quoter;
    IBiswapFactory public immutable factory;

    constructor (address _quoter, address _factory){
        quoter = IBiswapQuoter(_quoter);
        factory = IBiswapFactory(_factory);
    }

    function getAmountsOut(
        uint[] memory amountInList,
        address[] memory path
    ) public view returns (uint[] memory amounts){
        uint[] memory amountOutList = new uint[](amountInList.length);

        for (uint i = 0; i < amountInList.length; i++) {
            amountOutList[i] = quoter.getAmountsOut(amountInList[i], path)[path.length - 1];
        }
        return amountOutList;
    }

    function getAmountsIn(
        uint[] memory amountOutList,
        address[] memory path
    ) public view returns (uint[] memory amounts){
        uint[] memory amountInList = new uint[](amountOutList.length);

        for (uint i = 0; i < amountOutList.length; i++) {
            amountInList[i] = quoter.getAmountsIn(amountOutList[i], path)[0];
        }
        return amountInList;
    }

    function getLiquidity(address tokenA, address tokenB) public view returns (
        uint112,
        uint112,
        uint,
        uint,
        uint,
        bytes32
    ) {
        IBiswapPair pair = IBiswapPair(factory.getPair(tokenA, tokenB));
        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
        (uint112 reserveA, uint112 reserveB) = tokenA < tokenB ? (reserve0, reserve1) : (reserve1, reserve0);
        uint kLast = pair.kLast();

        console.log("check K value");
        console.logBool(uint(reserveA) * uint(reserveB) == kLast);

        return (reserveA, reserveB, kLast, block.timestamp, block.number, blockhash(block.number));
    }
}