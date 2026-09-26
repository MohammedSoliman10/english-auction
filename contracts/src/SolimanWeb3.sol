// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {
    ERC721URIStorage
} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title SolimanWeb3 ("SW3") — sequential-id collectible with metadata URIs
/// @notice Anyone can mint a token to themselves by supplying an off-chain JSON
///         metadata URI. Ids are assigned sequentially starting at 0 (behavior
///         preserved from the original contract).
/// @dev Uses {_safeMint} (R5 #6) so contract recipients must implement
///      `onERC721Received`; metadata is stored via OZ `ERC721URIStorage`.
contract SolimanWeb3 is ERC721URIStorage {
    uint256 private _tokenId;

    /// @notice Deploy the collection as "Soliman Web3" / "SW3" (R5 #7 name trim).
    constructor() ERC721("Soliman Web3", "SW3") {}

    /// @notice Mint the next token id to the caller with the given metadata URI.
    /// @param jsonUri Off-chain JSON metadata URI (http/ipfs/data).
    /// @return The newly assigned token id (first mint returns 0).
    function mintNFT(string memory jsonUri) public returns (uint256) {
        uint256 newTokenId = _tokenId;
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, jsonUri);
        _tokenId++;
        return newTokenId;
    }
}
