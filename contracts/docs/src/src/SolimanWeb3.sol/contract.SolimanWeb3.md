# SolimanWeb3
**Inherits:**
ERC721URIStorage

**Title:**
SolimanWeb3 ("SW3") — sequential-id collectible with metadata URIs

Anyone can mint a token to themselves by supplying an off-chain JSON
metadata URI. Ids are assigned sequentially starting at 0 (behavior
preserved from the original contract).

Uses {_safeMint} (R5 #6) so contract recipients must implement
`onERC721Received`; metadata is stored via OZ `ERC721URIStorage`.


## State Variables
### _tokenId

```solidity
uint256 private _tokenId
```


## Functions
### constructor

Deploy the collection as "Soliman Web3" / "SW3" (R5 #7 name trim).


```solidity
constructor() ERC721("Soliman Web3", "SW3");
```

### mintNFT

Mint the next token id to the caller with the given metadata URI.


```solidity
function mintNFT(string memory jsonUri) public returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`jsonUri`|`string`|Off-chain JSON metadata URI (http/ipfs/data).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The newly assigned token id (first mint returns 0).|


