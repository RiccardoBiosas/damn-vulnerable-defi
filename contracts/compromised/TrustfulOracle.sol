pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 *
 * A price oracle with a number of trusted sources that individually report prices for symbols.
 * The oracle's price for a given symbol is the median price of the symbol over all sources.
 */
contract TrustfulOracle is AccessControl {

    bytes32 public constant TRUSTED_SOURCE_ROLE = keccak256("TRUSTED_SOURCE_ROLE");
    bytes32 public constant INITIALIZER_ROLE = keccak256("INITIALIZER_ROLE");

    // Source address => (symbol => price)
    mapping(address => mapping (string => uint256)) private pricesBySource;

    modifier onlyTrustedSource() {
        require(hasRole(TRUSTED_SOURCE_ROLE, msg.sender));
        _;
    }

    modifier onlyInitializer() {
        require(hasRole(INITIALIZER_ROLE, msg.sender));
        _;
    }

    event UpdatedPrice(
        address indexed source,
        string indexed symbol,
        uint256 oldPrice,
        uint256 newPrice
    );

    constructor(address[] memory sources, bool enableInitialization) public {
        require(sources.length > 0);
        for(uint256 i = 0; i < sources.length; i++) {
            _setupRole(TRUSTED_SOURCE_ROLE, sources[i]);
        }

        if (enableInitialization) {
            _setupRole(INITIALIZER_ROLE, msg.sender);
        }
    }

    // A handy utility allowing the deployer to setup initial prices (only once)
    function setupInitialPrices(
        address[] memory sources,
        string[] memory symbols,
        uint256[] memory prices
    ) 
        public
        onlyInitializer
    {
        // Only allow one (symbol, price) per source
        require(sources.length == symbols.length && symbols.length == prices.length);
        for(uint256 i = 0; i < sources.length; i++) {
            _setPrice(sources[i], symbols[i], prices[i]);
        }
        renounceRole(INITIALIZER_ROLE, msg.sender);
    }

    /// @notice wrapper around _setPrice, allows an authorized party to set the price for a given asset
    function postPrice(string calldata symbol, uint256 newPrice) external onlyTrustedSource {
        _setPrice(msg.sender, symbol, newPrice);
    }

    /// @notice wrapper around _computeMedianPrice
    function getMedianPrice(string calldata symbol) external view returns (uint256) {
        return _computeMedianPrice(symbol);
    }

    /// @notice fetches all the prices for a given asset from the trusted sources
    function getAllPricesForSymbol(string memory symbol) public view returns (uint256[] memory) {
        uint256 numberOfSources = getNumberOfSources();
        uint256[] memory prices = new uint256[](numberOfSources);

        for (uint256 i = 0; i < numberOfSources; i++) {
            address source = getRoleMember(TRUSTED_SOURCE_ROLE, i);
            prices[i] = getPriceBySource(symbol, source);
        }

        return prices;
    }

    function getPriceBySource(string memory symbol, address source) public view returns (uint256) {
        return pricesBySource[source][symbol];
    }

    function getNumberOfSources() public view returns (uint256) {
        return getRoleMemberCount(TRUSTED_SOURCE_ROLE);
    }

    function _setPrice(address source, string memory symbol, uint256 newPrice) private {
        uint256 oldPrice = pricesBySource[source][symbol];
        pricesBySource[source][symbol] = newPrice;
        emit UpdatedPrice(source, symbol, oldPrice, newPrice);
    }

    /// @notice it builds an array of prices using the `getAllPricesForSymbol` function - which fetches all the prices for a given asset that have been provided by the trusted oracles- and then sorts the array in ascending order, the median is calculated on the array in ascending order. the median is then calculated on the sorted array, which makes the consumer contracts vulnerable to oracle manipulation 
    function _computeMedianPrice(string memory symbol) private view returns (uint256) {
        uint256[] memory prices = _sort(getAllPricesForSymbol(symbol));

        // calculate median price
        if (prices.length % 2 == 0) {
            uint256 leftPrice = prices[(prices.length / 2) - 1];
            uint256 rightPrice = prices[prices.length / 2];
            return (leftPrice + rightPrice) / 2;
        } else {
            return prices[prices.length / 2];
        }
    }

    /// @notice sorts a given array in ascending order
    function _sort(uint256[] memory arrayOfNumbers) private pure returns (uint256[] memory) {
        for (uint256 i = 0; i < arrayOfNumbers.length; i++) {
            for (uint256 j = i + 1; j < arrayOfNumbers.length; j++) {
                if (arrayOfNumbers[i] > arrayOfNumbers[j]) {
                    uint256 tmp = arrayOfNumbers[i];
                    arrayOfNumbers[i] = arrayOfNumbers[j];
                    arrayOfNumbers[j] = tmp;
                }
            }
        }        
        return arrayOfNumbers;
    }
}