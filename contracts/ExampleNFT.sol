// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ExampleNFT is ERC721, Pausable, AccessControl {
    using Counters for Counters.Counter;
    using Strings for uint256;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    Counters.Counter public tokenIdCounter;
    uint256 public mintPrice = 10000000000000000; //0.01 ETH
    uint256 public mintLImit = 100;
    bool public isSaleActive;

    event MintedNFT(address to, uint256 tokenId);

    modifier checkSaleStatus() {
        require(isSaleActive, "Sale not active");
        _;
    }

    modifier checkTokenId() {
        require(tokenIdCounter.current() < mintLImit, "Mint limit achieved");
        _;
    }

    constructor() ERC721("ExampleNFT", "ExNFT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        isSaleActive = false;
    }

    function _baseURI() internal view override returns (string memory) {
        return "ipfs://bafybeih2moiacxehhygdv24mjyuqhwzzai4rwueepf7jvtee2tzj7up5ha/";
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);

        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json")) : "";
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function flipSaleStatus() public onlyRole(ADMIN_ROLE) {
        isSaleActive = !isSaleActive;
    }

    function safeMint(address to)
        public
        whenNotPaused
        onlyRole(MINTER_ROLE)
        checkTokenId
    {
        tokenIdCounter.increment();
        uint256 tokenId = tokenIdCounter.current();
        _safeMint(to, tokenId);
        emit MintedNFT(to, tokenId);
    }

    function payToMint(address to)
        public
        payable
        whenNotPaused
        checkSaleStatus
        checkTokenId
    {
        require(msg.value >= mintPrice, "Send to low ETH to mint NFT");
        tokenIdCounter.increment();
        uint256 tokenId = tokenIdCounter.current();
        _safeMint(to, tokenId);
        emit MintedNFT(to, tokenId);
    }

    function withdraw() public onlyRole(ADMIN_ROLE) {
        (bool success, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(success, "Withdraw not succeed");
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
