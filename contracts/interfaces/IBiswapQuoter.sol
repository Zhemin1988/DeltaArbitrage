pragma solidity >=0.7.5;
pragma abicoder v2;

interface IBiswapQuoter {
    function getAmountsOut(
        uint amountIn,
        address[] memory path
    ) external view returns (uint[] memory amounts);

    function getAmountsIn(
        uint amountOut,
        address[] memory path
    ) external view returns (uint[] memory amounts);

    function getLiquidity(address tokenA, address tokenB) external view returns (
        uint112 reserveA,
        uint112 reserveB,
        uint kLast
    );
}