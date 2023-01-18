pragma solidity >=0.7.5;
pragma abicoder v2;

interface IiZiQuoter {
    /// @notice estimate amount of tokenX acquired when user wants to buy tokenX
    ///    given max amount of tokenY user willing to pay
    ///    calling this function will not generate any real exchanges in the pool
    /// @param tokenX tokenX of swap pool
    /// @param tokenY tokenY of swap pool
    /// @param fee fee amount of swap pool
    /// @param amount max-amount of tokenY user willing to pay
    /// @param highPt highest point during exchange
    /// @return amountX estimated amount of tokenX user would acquire
    /// @return finalPoint estimated point of pool after swap
    function swapY2X(
        address tokenX,
        address tokenY,
        uint24 fee,
        uint128 amount,
        int24 highPt
    ) external returns (uint256 amountX, int24 finalPoint);

    /// @notice estimate amount of tokenY required when user wants to buy tokenX
    ///    given amount of tokenX user wants to buy
    ///    calling this function will not generate any real exchanges in the pool
    /// @param tokenX tokenX of swap pool
    /// @param tokenY tokenY of swap pool
    /// @param fee fee amount of swap pool
    /// @param desireX amount of tokenX user wants to buy
    /// @param highPt highest point during exchange
    /// @return amountY estimated amount of tokenY user need to pay
    /// @return finalPoint estimated point of pool after swap
    function swapY2XDesireX(
        address tokenX,
        address tokenY,
        uint24 fee,
        uint128 desireX,
        int24 highPt
    ) external returns (uint256 amountY, int24 finalPoint);

    /// @notice estimate amount of tokenY acquired when user wants to buy tokenY
    ///    given max amount of tokenX user willing to pay
    ///    calling this function will not generate any real exchanges in the pool
    /// @param tokenX tokenX of swap pool
    /// @param tokenY tokenY of swap pool
    /// @param fee fee amount of swap pool
    /// @param amount max-amount of tokenX user willing to pay
    /// @param lowPt lowest point during exchange
    /// @return amountY estimated amount of tokenY user would acquire
    /// @return finalPoint estimated point of pool after swap
    function swapX2Y(
        address tokenX,
        address tokenY,
        uint24 fee,
        uint128 amount,
        int24 lowPt
    ) external returns (uint256 amountY, int24 finalPoint);

    /// @notice estimate amount of tokenX required when user wants to buy tokenY
    ///    given amount of tokenX user wants to buy
    ///    calling this function will not generate any real exchanges in the pool
    /// @param tokenX tokenX of swap pool
    /// @param tokenY tokenY of swap pool
    /// @param fee fee amount of swap pool
    /// @param desireY amount of tokenY user wants to buy
    /// @param lowPt highest point during exchange
    /// @return amountX estimated amount of tokenX user need to pay
    /// @return finalPoint estimated point of pool after swap
    function swapX2YDesireY(
        address tokenX,
        address tokenY,
        uint24 fee,
        uint128 desireY,
        int24 lowPt
    ) external returns (uint256 amountX, int24 finalPoint);
}