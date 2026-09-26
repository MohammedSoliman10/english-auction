// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {EnglishAuction} from "../src/EnglishAuction.sol";
import {MockERC721} from "./utils/MockERC721.sol";

/// @notice Unit tests — T011 modernization suite (RED before T012 implementation).
/// Story-specific suites (bid/start/withdraw/end, fuzz, invariants) append here per tasks.md.
contract EnglishAuctionTest is Test {
    EnglishAuction internal auction;
    MockERC721 internal nft;

    address internal seller = makeAddr("seller");
    uint256 internal constant TOKEN_ID = 1;
    uint256 internal constant START_BID = 0.1 ether;
    uint256 internal constant DURATION = 7 days;

    function setUp() public {
        nft = new MockERC721();
        vm.prank(seller);
        nft.mint(seller, TOKEN_ID);
        vm.prank(seller);
        auction = new EnglishAuction(address(nft), TOKEN_ID, START_BID, DURATION);
    }

    // ── T011: modernization assertions ──────────────────────────────────────

    function test_ConstructorStoresDuration() public view {
        assertEq(auction.duration(), DURATION, "duration getter");
    }

    function test_ConstructorStoresStartingBid() public view {
        assertEq(auction.startingBid(), START_BID, "startingBid immutable (R5 #8)");
    }

    function test_DefaultAuctionDurationIsSevenDays() public view {
        assertEq(auction.DEFAULT_AUCTION_DURATION(), 7 days, "default duration constant");
    }

    function test_ConstructorStoresCoreState() public view {
        assertEq(address(auction.nft()), address(nft), "nft getter");
        assertEq(auction.nftId(), TOKEN_ID, "nftId getter");
        assertEq(auction.seller(), seller, "seller is deployer");
        assertEq(auction.highestBid(), START_BID, "highestBid initialized to starting bid");
        assertEq(auction.highestBidder(), address(0), "no bidder before bids");
        assertEq(auction.endAt(), 0, "endAt unset before start");
        assertFalse(auction.started(), "not started initially");
        assertFalse(auction.ended(), "not ended initially");
    }

    function test_RevertWhen_DeployWithZeroDuration() public {
        vm.expectRevert("duration=0");
        new EnglishAuction(address(nft), TOKEN_ID, START_BID, 0);
    }

    // ── T028 (US1): bid() ───────────────────────────────────────────────────

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    /// @dev Seller escrows the NFT and opens bidding (helper for bid suites). */
    function _startAuction() internal {
        vm.startPrank(seller);
        nft.approve(address(auction), TOKEN_ID);
        auction.start();
        vm.stopPrank();
    }

    function test_RevertWhen_BidBeforeStart() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert("not started");
        auction.bid{value: 1 ether}();
    }

    function test_RevertWhen_BidAtOrAfterEnd() public {
        _startAuction();
        vm.deal(alice, 10 ether);

        vm.warp(auction.endAt()); // exactly at endAt → closed
        vm.prank(alice);
        vm.expectRevert("ended");
        auction.bid{value: 2 ether}();

        vm.warp(auction.endAt() + 1);
        vm.prank(alice);
        vm.expectRevert("ended");
        auction.bid{value: 2 ether}();
    }

    function test_RevertWhen_BidNotStrictlyAboveHighest() public {
        _startAuction();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);

        // first bid must beat startingBid (initial highestBid)
        vm.prank(alice);
        vm.expectRevert("value < highest");
        auction.bid{value: START_BID}(); // equal to starting bid

        vm.prank(alice);
        auction.bid{value: START_BID + 1}();

        vm.prank(bob);
        vm.expectRevert("value < highest");
        auction.bid{value: START_BID + 1}(); // equal to current highest
    }

    function test_BidCreditsPriorBidToPriorBidder() public {
        _startAuction();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);

        vm.prank(alice);
        auction.bid{value: 1 ether}();
        vm.prank(bob);
        auction.bid{value: 2 ether}();

        assertEq(auction.bids(alice), 1 ether, "prior bid refundable to alice");
        assertEq(auction.bids(bob), 0, "winner balance untouched");
        assertEq(auction.highestBid(), 2 ether, "highest is bob's");
        assertEq(auction.highestBidder(), bob, "highest bidder is bob");
        assertEq(address(auction).balance, 3 ether, "contract escrows both bids");
    }

    function test_BidSameBidderRebidCreditsOwnOldBid() public {
        _startAuction();
        vm.deal(alice, 10 ether);

        vm.prank(alice);
        auction.bid{value: 1 ether}();
        vm.prank(alice);
        auction.bid{value: 2 ether}();

        assertEq(auction.bids(alice), 1 ether, "own old bid credited, not lost");
        assertEq(auction.highestBid(), 2 ether, "highest is the rebid");
        assertEq(auction.highestBidder(), alice, "still alice");
        assertEq(address(auction).balance, 3 ether, "contract holds 1 + 2");
    }

    function test_BidDoesNotCreditStartingBidToZeroAddress() public {
        _startAuction();
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        auction.bid{value: START_BID + 1}();

        assertEq(
            auction.bids(address(0)), 0, "phantom startingBid must never be credited to address(0)"
        );
    }

    function test_EmitBidOnAcceptedBid() public {
        _startAuction();
        vm.deal(alice, 1 ether);

        vm.expectEmit(true, true, true, true, address(auction));
        emit EnglishAuction.Bid(alice, 1 ether);
        vm.prank(alice);
        auction.bid{value: 1 ether}();
    }

    // ── T039 (US2): start() ─────────────────────────────────────────────────

    function test_RevertWhen_StartByNonSeller() public {
        vm.expectRevert("not seller");
        vm.prank(alice);
        auction.start();
    }

    function test_RevertWhen_DoubleStart() public {
        _startAuction();
        vm.expectRevert("started");
        vm.prank(seller);
        auction.start();
    }

    function test_StartEscrowsNftToAuction() public {
        _startAuction();
        assertEq(nft.ownerOf(TOKEN_ID), address(auction), "NFT escrowed by the auction");
        assertTrue(auction.started(), "phase flips to started");
    }

    function test_StartSetsEndAtToNowPlusDuration() public {
        _startAuction();
        assertEq(auction.endAt(), block.timestamp + DURATION, "endAt = block.timestamp + duration");
    }

    function test_EmitStartOnStart() public {
        vm.startPrank(seller);
        nft.approve(address(auction), TOKEN_ID);
        vm.expectEmit(true, true, true, true, address(auction));
        emit EnglishAuction.Start();
        auction.start();
        vm.stopPrank();
    }

    function test_RevertWhen_StartWithoutNftApproval() public {
        // transferFrom bubbles the ERC-721 approval failure (no approval set).
        vm.expectRevert();
        vm.prank(seller);
        auction.start();
    }
}
