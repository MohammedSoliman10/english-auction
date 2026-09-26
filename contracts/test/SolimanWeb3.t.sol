// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {SolimanWeb3} from "../src/SolimanWeb3.sol";

/// @notice Unit tests — T013 modernization suite (RED before T014 implementation).
/// US5 mint behavior tests append here (tasks T057).
contract SolimanWeb3Test is Test {
    SolimanWeb3 internal token;

    function setUp() public {
        token = new SolimanWeb3();
    }

    function test_ConstructorMetadata() public view {
        assertEq(token.name(), "Soliman Web3", "name trimmed (R5 #7)");
        assertEq(token.symbol(), "SW3", "symbol");
    }

    // ── US5 / T057 — mint behavior (sequential ids, URIs, _safeMint) ────────

    function test_firstMint_returnsZeroAndAssignsOwnership() public {
        address minter = makeAddr("minter");
        vm.prank(minter);
        uint256 id = token.mintNFT("ipfs://bafy-first");
        assertEq(id, 0, "first mint returns id 0");
        assertEq(token.ownerOf(0), minter, "caller owns the fresh token");
    }

    function test_mintsAssignSequentialIds() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        address carol = makeAddr("carol");

        vm.prank(alice);
        assertEq(token.mintNFT("ipfs://0"), 0);
        vm.prank(bob);
        assertEq(token.mintNFT("ipfs://1"), 1);
        vm.prank(carol);
        assertEq(token.mintNFT("ipfs://2"), 2);

        assertEq(token.ownerOf(0), alice, "id 0 to alice");
        assertEq(token.ownerOf(1), bob, "id 1 to bob");
        assertEq(token.ownerOf(2), carol, "id 2 to carol");
        assertEq(token.tokenURI(2), "ipfs://2", "third token fully minted");
    }

    function test_tokenURI_matchesSubmittedUri() public {
        string[3] memory uris = [
            "https://example.com/meta.json",
            "ipfs://bafybeigdyrztzt",
            "data:application/json;base64,eyJ7In0="
        ];
        for (uint256 i = 0; i < uris.length; i++) {
            vm.prank(makeAddr(string(abi.encodePacked("minter", i))));
            uint256 id = token.mintNFT(uris[i]);
            assertEq(token.tokenURI(id), uris[i], "tokenURI equals submitted jsonUri");
        }
    }

    function test_mintToNonReceiverContract_reverts() public {
        NonReceiver target = new NonReceiver();
        vm.prank(address(target));
        vm.expectRevert(
            abi.encodeWithSelector(IERC721Errors.ERC721InvalidReceiver.selector, address(target))
        );
        token.mintNFT("ipfs://rejected");
    }

    function test_mintToReceiverContract_succeeds() public {
        Receiver target = new Receiver();
        vm.prank(address(target));
        uint256 id = token.mintNFT("ipfs://to-receiver");
        assertEq(token.ownerOf(id), address(target), "_safeMint accepts a compliant receiver");
    }

    function test_mintToEoaSucceeds() public {
        address eoa = makeAddr("eoa");
        vm.prank(eoa);
        uint256 id = token.mintNFT("ipfs://eoa-only");
        assertEq(id, 0, "EOA mint works on a fresh collection");
        assertEq(token.ownerOf(0), eoa, "EOA owns its token");
        assertEq(token.tokenURI(0), "ipfs://eoa-only", "URI stored");
    }
}

/// @dev Recipient without `onERC721Received` — `_safeMint` must reject it (R5 #6).
contract NonReceiver {}

/// @dev Recipient that implements `IERC721Receiver` — `_safeMint` accepts it.
contract Receiver is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}
