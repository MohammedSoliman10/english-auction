// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {EnglishAuction} from "../src/EnglishAuction.sol";
import {MockERC721} from "./utils/MockERC721.sol";

/// @notice Fuzz suites — T029 (US1): bid sequences conserve funds while live.
contract EnglishAuctionFuzzTest is Test {
    EnglishAuction internal auction;
    MockERC721 internal nft;

    address internal seller = makeAddr("seller");
    address internal bidder1 = makeAddr("bidder1");
    address internal bidder2 = makeAddr("bidder2");
    address internal bidder3 = makeAddr("bidder3");

    uint256 internal constant TOKEN_ID = 1;
    uint256 internal constant START_BID = 0.1 ether;
    uint256 internal constant DURATION = 7 days;

    function setUp() public {
        nft = new MockERC721();
        vm.prank(seller);
        nft.mint(seller, TOKEN_ID);
        vm.prank(seller);
        auction = new EnglishAuction(address(nft), TOKEN_ID, START_BID, DURATION);

        vm.startPrank(seller);
        nft.approve(address(auction), TOKEN_ID);
        auction.start();
        vm.stopPrank();
    }

    /// @dev Sum of every tracked refundable balance (memory array, no mappings in memory). */
    function _sumTrackedBids(address[] memory who) internal view returns (uint256 total) {
        for (uint256 i = 0; i < who.length; i++) {
            total += auction.bids(who[i]);
        }
    }

    /// @notice Random sequences of increasing bids must conserve ETH:
    ///         contract balance == Σ refundable balances + highestBid (every step).
    function testFuzz_BidSequenceConservesFunds(uint8 bidCount, uint256 seed) public {
        address[] memory who = new address[](3);
        who[0] = bidder1;
        who[1] = bidder2;
        who[2] = bidder3;
        for (uint256 i = 0; i < who.length; i++) {
            vm.deal(who[i], type(uint128).max);
        }

        uint256 count = bound(bidCount, 1, 12);
        for (uint256 i = 0; i < count; i++) {
            address bidder = who[bound(uint256(keccak256(abi.encode(seed, i))), 0, 2)];
            uint256 amount = auction.highestBid()
                + bound(uint256(keccak256(abi.encode(seed, "amount", i))), 1, 500 ether);

            vm.prank(bidder);
            auction.bid{value: amount}();

            assertEq(
                address(auction).balance,
                _sumTrackedBids(who) + auction.highestBid(),
                "conservation: escrow == refundables + highest"
            );
        }

        // Every accepted bid strictly increased the high-water mark above startingBid.
        assertGt(auction.highestBid(), START_BID, "highest advanced past startingBid");
        assertEq(auction.highestBidder(), _lastBidder(who, bidCount, seed), "bidder recorded");
    }

    /// @dev Recompute which bidder placed the final (count-th) bid — mirrors the picker. */
    function _lastBidder(address[] memory who, uint8 bidCount, uint256 seed)
        internal
        pure
        returns (address)
    {
        uint256 count = bound(bidCount, 1, 12);
        return who[bound(uint256(keccak256(abi.encode(seed, count - 1))), 0, 2)];
    }
}
