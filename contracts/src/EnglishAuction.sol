// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title EnglishAuction — escrowed English auction for a single ERC-721 token
/// @notice The seller escrows their NFT by calling {start}; bidders compete by
///         sending strictly-increasing native-currency bids until `endAt`. Outbid
///         funds become withdrawable at any time (pull-payments). After `endAt`
///         anyone may call {end} to settle: the highest bidder receives the NFT
///         and the seller receives the highest bid (or the NFT returns to the
///         seller when there were no bids).
/// @dev Checks-effects-interactions on {withdraw} and {end}; event signatures are
///      frozen as the frontend's activity-log interface.
contract EnglishAuction {
    /// @notice Default auction length (used by deployment defaults / demo scripts).
    uint256 public constant DEFAULT_AUCTION_DURATION = 7 days;

    /// @notice The ERC-721 contract being auctioned.
    IERC721 public nft;
    /// @notice The token id being auctioned.
    uint256 public nftId;
    /// @notice The seller; receives the highest bid at settlement.
    address payable public seller;
    /// @notice Original starting bid, fixed at deployment (R5 #8).
    uint256 public immutable startingBid;
    /// @notice Auction length in seconds, fixed at deployment (R5 #1).
    uint256 public immutable duration;
    /// @notice Unix timestamp when bidding closes; 0 until {start}.
    uint256 public endAt;
    /// @notice Whether {start} has been called.
    bool public started;
    /// @notice Whether {end} has completed settlement.
    bool public ended;
    /// @notice Current highest bidder (address(0) when no qualifying bid).
    address public highestBidder;
    /// @notice Current highest bid (initialized to {startingBid}).
    uint256 public highestBid;
    /// @notice Withdrawable refund balance per outbid/overbid account.
    mapping(address => uint256) public bids;

    /// @notice Emitted when the seller escrows the NFT and bidding opens.
    event Start();
    /// @notice Emitted on every accepted bid.
    event Bid(address indexed sender, uint256 amount);
    /// @notice Emitted when a bidder reclaims their refundable balance.
    event Withdraw(address indexed bidder, uint256 amount);
    /// @notice Emitted at settlement with the winner and winning amount.
    event End(address winner, uint256 amount);

    /// @notice Create an auction for one NFT.
    /// @param _nft ERC-721 contract address.
    /// @param _nftId Token id being auctioned.
    /// @param _startingBid Minimum first bid (wei); also the initial {highestBid}.
    /// @param _duration Auction length in seconds (see {DEFAULT_AUCTION_DURATION}).
    constructor(address _nft, uint256 _nftId, uint256 _startingBid, uint256 _duration) {
        require(_duration > 0, "duration=0");
        nft = IERC721(_nft);
        nftId = _nftId;
        seller = payable(msg.sender);
        startingBid = _startingBid;
        highestBid = _startingBid;
        duration = _duration;
    }

    /// @notice Escrow the seller's NFT and open bidding for {duration} seconds.
    /// @dev Requires prior ERC-721 approval for this contract; callable once, seller only.
    function start() external {
        require(!started, "started");
        require(msg.sender == seller, "not seller");

        nft.transferFrom(msg.sender, address(this), nftId);
        started = true;
        endAt = block.timestamp + duration;

        emit Start();
    }

    /// @notice Place a bid strictly above the current highest while bidding is open.
    /// @dev The previous highest bid is credited to the previous bidder's {bids} balance.
    function bid() external payable {
        require(started, "not started");
        require(block.timestamp < endAt, "ended");
        require(msg.value > highestBid, "value < highest");

        if (highestBidder != address(0)) {
            bids[highestBidder] += highestBid;
        }

        highestBidder = msg.sender;
        highestBid = msg.value;

        emit Bid(msg.sender, msg.value);
    }

    /// @notice Withdraw the caller's full refundable balance in one action.
    /// @dev Checks-effects-interactions: the balance is zeroed before the transfer,
    ///      so a failed transfer reverts the whole transaction and restores the claim.
    function withdraw() external {
        uint256 bal = bids[msg.sender];
        bids[msg.sender] = 0;
        (bool success,) = payable(msg.sender).call{value: bal}("");
        require(success, "transfer failed");

        emit Withdraw(msg.sender, bal);
    }

    /// @notice Settle the auction after {endAt}: winner takes the NFT, seller takes
    ///         the highest bid; with zero bids the NFT returns to the seller.
    /// @dev Permissionless; terminal — reverts once {ended} is true.
    function end() external {
        require(started, "not started");
        require(block.timestamp >= endAt, "not ended");
        require(!ended, "ended");

        ended = true;
        if (highestBidder != address(0)) {
            nft.safeTransferFrom(address(this), highestBidder, nftId);
            (bool success,) = payable(seller).call{value: highestBid}("");
            require(success, "transfer failed");
        } else {
            nft.safeTransferFrom(address(this), seller, nftId);
        }

        emit End(highestBidder, highestBid);
    }
}
