pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./TrustfulOracle.sol";

/// @notice it deploys the TrustfulOracle contract and it's assigned the INITIALIZER_ROLE upon deployment
contract TrustfulOracleInitializer {

    event NewTrustfulOracle(address oracleAddress);

    TrustfulOracle public oracle;

    constructor(
        address[] memory sources,
        string[] memory symbols,
        uint256[] memory initialPrices
    ) public
    {
        oracle = new TrustfulOracle(sources, true);
        oracle.setupInitialPrices(sources, symbols, initialPrices);
        emit NewTrustfulOracle(address(oracle));
    }
}