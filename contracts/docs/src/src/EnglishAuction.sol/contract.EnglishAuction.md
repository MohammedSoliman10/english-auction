# EnglishAuction
**Title:**
EnglishAuction — escrowed English auction for a single ERC-721 token

The seller escrows their NFT by calling [start](/src/EnglishAuction.sol/contract.EnglishAuction.md#start); bidders compete by
sending strictly-increasing native-currency bids until `endAt`. Outbid
funds become withdrawable at any time (pull-payments). After `endAt`
anyone may call [end](/src/EnglishAuction.sol/contract.EnglishAuction.md#end) to settle: the highest bidder receives the NFT
and the seller receives the highest bid (or the NFT returns to the
seller when there were no bids).

Checks-effects-interactions on [withdraw](/src/EnglishAuction.sol/contract.EnglishAuction.md#withdraw) and [end](/src/EnglishAuction.sol/contract.EnglishAuction.md#end); event signatures are
frozen as the frontend's activity-log interface.


## Constants
### DEFAULT_AUCTION_DURATION
Default auction length (used by deployment defaults / demo scripts).


```solidity
uint256 public constant DEFAULT_AUCTION_DURATION = 7 days
```


### startingBid
Original starting bid, fixed at deployment (R5 #8).


```solidity
uint256 public immutable startingBid
```


### duration
Auction length in seconds, fixed at deployment (R5 #1).


```solidity
uint256 public immutable duration
```


## State Variables
### nft
The ERC-721 contract being auctioned.


```solidity
IERC721 public nft
```


### nftId
The token id being auctioned.


```solidity
uint256 public nftId
```


### seller
The seller; receives the highest bid at settlement.


```solidity
address payable public seller
```


### endAt
Unix timestamp when bidding closes; 0 until [start](/src/EnglishAuction.sol/contract.EnglishAuction.md#start).


```solidity
uint256 public endAt
```


### started
Whether [start](/src/EnglishAuction.sol/contract.EnglishAuction.md#start) has been called.


```solidity
bool public started
```


### ended
Whether [end](/src/EnglishAuction.sol/contract.EnglishAuction.md#end) has completed settlement.


```solidity
bool public ended
```


### highestBidder
Current highest bidder (address(0) when no qualifying bid).


```solidity
address public highestBidder
```


### highestBid
Current highest bid (initialized to {startingBid}).


```solidity
uint256 public highestBid
```


### bids
Withdrawable refund balance per outbid/overbid account.


```solidity
mapping(address => uint256) public bids
```


## Functions
### constructor

Create an auction for one NFT.


```solidity
constructor(address _nft, uint256 _nftId, uint256 _startingBid, uint256 _duration) ;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_nft`|`address`|ERC-721 contract address.|
|`_nftId`|`uint256`|Token id being auctioned.|
|`_startingBid`|`uint256`|Minimum first bid (wei); also the initial {highestBid}.|
|`_duration`|`uint256`|Auction length in seconds (see {DEFAULT_AUCTION_DURATION}).|


### start

Escrow the seller's NFT and open bidding for {duration} seconds.

Requires prior ERC-721 approval for this contract; callable once, seller only.


```solidity
function start() external;
```

### bid

Place a bid strictly above the current highest while bidding is open.

The previous highest bid is credited to the previous bidder's {bids} balance.


```solidity
function bid() external payable;
```

### withdraw

Withdraw the caller's full refundable balance in one action.

Checks-effects-interactions: the balance is zeroed before the transfer,
so a failed transfer reverts the whole transaction and restores the claim.


```solidity
function withdraw() external;
```

### end

Settle the auction after {endAt}: winner takes the NFT, seller takes
the highest bid; with zero bids the NFT returns to the seller.

Permissionless; terminal — reverts once {ended} is true.


```solidity
function end() external;
```

## Events
### Start
Emitted when the seller escrows the NFT and bidding opens.


```solidity
event Start();
```

### Bid
Emitted on every accepted bid.


```solidity
event Bid(address indexed sender, uint256 amount);
```

### Withdraw
Emitted when a bidder reclaims their refundable balance.


```solidity
event Withdraw(address indexed bidder, uint256 amount);
```

### End
Emitted at settlement with the winner and winning amount.


```solidity
event End(address winner, uint256 amount);
```

