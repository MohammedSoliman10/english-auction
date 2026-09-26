// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {EnglishAuction} from "../src/EnglishAuction.sol";
import {MockERC721} from "./utils/MockERC721.sol";

/// @notice Bounded action surface the invariant fuzzer sequences (T052).
/// @dev Every entry point no-ops instead of reverting when the action is not
///      currently legal, so sequences stay productive; cheatcode-driven
///      pranks keep every caller one of the known actors (the only bidders),
///      which makes Σ bids(actor) an exact solvency term.
contract AuctionHandler is Test {
    EnglishAuction public immutable auction;
    MockERC721 public immutable nft;
    address[] public actors;

    // Terminal snapshot (invariant 3) — taken the first time `ended` is seen.
    bool public snapshotTaken;
    uint256 public snapHighestBid;
    address public snapHighestBidder;
    uint256 public snapEndAt;
    address public snapNftOwner;

    constructor(EnglishAuction auction_, MockERC721 nft_, address[] memory actors_) {
        auction = auction_;
        nft = nft_;
        actors = actors_;
    }

    function doBid(uint256 seed, uint256 value) external {
        if (auction.started() && !auction.ended() && block.timestamp < auction.endAt()) {
            address who = actors[seed % actors.length];
            uint256 amount = bound(value, auction.highestBid() + 1, auction.highestBid() + 10 ether);
            vm.deal(who, amount);
            vm.prank(who);
            try auction.bid{value: amount}() {} catch {}
        }
        _takeIfEnded();
    }

    function doWithdraw(uint256 seed) external {
        address who = actors[seed % actors.length];
        vm.prank(who);
        try auction.withdraw() {} catch {}
        _takeIfEnded();
    }

    function doStart() external {
        if (!auction.started()) {
            address tokenOwner = nft.ownerOf(auction.nftId());
            vm.startPrank(tokenOwner);
            try nft.approve(address(auction), auction.nftId()) {} catch {}
            try auction.start() {} catch {}
            vm.stopPrank();
        }
        _takeIfEnded();
    }

    function doEnd() external {
        if (auction.started() && !auction.ended() && block.timestamp >= auction.endAt()) {
            try auction.end() {} catch {}
        }
        _takeIfEnded();
    }

    function doWarp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 30 days));
        _takeIfEnded();
    }

    /// @dev Freeze the auction state the first moment `ended` becomes true. */
    function _takeIfEnded() internal {
        if (!auction.ended() || snapshotTaken) return;
        snapshotTaken = true;
        snapHighestBid = auction.highestBid();
        snapHighestBidder = auction.highestBidder();
        snapEndAt = auction.endAt();
        snapNftOwner = nft.ownerOf(auction.nftId());
    }
}

/// @notice Invariant suite — T052 (US4): property holds across ALL handler
///         sequences (start → bids → warps → withdraws → end, any order).
contract EnglishAuctionInvariantTest is Test {
    EnglishAuction internal auction;
    MockERC721 internal nft;
    AuctionHandler internal handler;
    address[] internal actors;

    address internal seller = makeAddr("seller");
    uint256 internal constant TOKEN_ID = 1;
    uint256 internal constant START_BID = 0.1 ether;

    function setUp() public {
        nft = new MockERC721();
        vm.prank(seller);
        nft.mint(seller, TOKEN_ID);
        vm.prank(seller);
        auction = new EnglishAuction(address(nft), TOKEN_ID, START_BID, 7 days);

        actors.push(makeAddr("alice"));
        actors.push(makeAddr("bob"));
        actors.push(makeAddr("carol"));

        handler = new AuctionHandler(auction, nft, actors);

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = AuctionHandler.doBid.selector;
        selectors[1] = AuctionHandler.doWithdraw.selector;
        selectors[2] = AuctionHandler.doStart.selector;
        selectors[3] = AuctionHandler.doEnd.selector;
        selectors[4] = AuctionHandler.doWarp.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @dev (1) Solvency — the contract always holds every refundable credit
    ///      plus the live highest bid (nothing minted, nothing stranded):
    ///      balance == Σ bids(actor) + (live && has bidder ? highestBid : 0).
    function invariant_Solvency() public {
        uint256 credits;
        for (uint256 i; i < actors.length; i++) {
            credits += auction.bids(actors[i]);
        }
        uint256 expected = credits;
        if (auction.started() && !auction.ended() && auction.highestBidder() != address(0)) {
            expected += auction.highestBid();
        }
        assertEq(address(auction).balance, expected, "solvency: balance == credits + live highest");
    }

    /// @dev (2) Escrow conservation — the auction never holds more than one
    ///      token, and holds exactly the auctioned one while live.
    function invariant_EscrowConservation() public {
        uint256 held = nft.balanceOf(address(auction));
        assertLe(held, 1, "auction never holds more than one token");
        if (auction.started() && !auction.ended()) {
            assertEq(held, 1, "escrow holds the NFT while live");
        }
    }

    /// @dev (3) Terminal immutability — once ended, every auction-state field
    ///      observed at the terminal transition stays frozen forever
    ///      (bids end, withdraw only moves credits — not this state).
    function invariant_TerminalImmutability() public {
        if (!handler.snapshotTaken()) return;
        assertTrue(auction.started(), "started stays true");
        assertTrue(auction.ended(), "ended stays true");
        assertEq(auction.highestBid(), handler.snapHighestBid(), "highestBid frozen");
        assertEq(auction.highestBidder(), handler.snapHighestBidder(), "highestBidder frozen");
        assertEq(auction.endAt(), handler.snapEndAt(), "endAt frozen");
        assertEq(nft.ownerOf(auction.nftId()), handler.snapNftOwner(), "NFT owner frozen");
    }
}
