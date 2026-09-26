# Contract: Chain Interface (Foundry — `contracts/`)

**Feature**: 001-auction-web-ui | **Date**: 2026-09-26 | **Spec**: contracts are the
behavioral source of truth (spec Assumptions). This documents the ABI surface the app
consumes and the approved modernization deltas.

## 1. Consumed ABI surface (stability: **frozen**)

### `EnglishAuction`

```solidity
constructor(address nft_, uint256 nftId_, uint256 startingBid_, uint256 duration_); // duration_ NEW (Q3=C)

event Start();
event Bid(address indexed sender, uint256 amount);        // signature FROZEN
event Withdraw(address indexed bidder, uint256 amount);   // signature FROZEN
event End(address winner, uint256 amount);                // signature FROZEN

function start() external;                       // reverts: "started" | "not seller"
function bid() external payable;                 // reverts: "not started" | "ended" | "value < highest"
function withdraw() external;                    // CEI; emits Withdraw
function end() external;                         // reverts: "not started" | "not ended" | "ended"

// public getters consumed as reads:
nft() → address; nftId() → uint256; seller() → address;
endAt() → uint256; started() → bool; ended() → bool;
highestBidder() → address; highestBid() → uint256; bids(address) → uint256;
duration() → uint256;                              // NEW getter (constructor param)
startingBid() → uint256;                           // NEW immutable getter (R5 #8, additive)
```

Revert **strings** are part of the UI error catalogue (data-model §7) — treat as frozen;
the `trasfer failed` typo in `end()` is **approved for correction** to `transfer failed`
(R5 #5; the catalogue tolerates both spellings regardless).

### `SolimanWeb3`

```solidity
constructor();                                   // ERC721("Soliman Web3 ", "SW3")
function mintNFT(string calldata jsonUri) public returns (uint256 newTokenId);
// + standard ERC-721 view surface used by UI: ownerOf, tokenURI, balanceOf, getApproved/isApprovedForAll
```

## 2. Approved modernization deltas (research R5 — user notified)

| # | Change | Status |
|---|--------|--------|
| 1 | `duration_` constructor param + `DEFAULT_AUCTION_DURATION = 7 days` constant (endAt = now + duration) | Approved via Q3=C |
| 2 | Hand-rolled `IERC721` + GitHub-raw imports → `forge install` OpenZeppelin (tag-pinned), `import {IERC721, ERC721, ERC721URIStorage}` | Build requirement (constitution tooling gate) |
| 3 | Exact `pragma solidity 0.8.31;` both contracts; `foundry.toml` `solc = "0.8.31"` | Constitution tooling gate |
| 4 | Full NatSpec; zero magic numbers; `forge fmt` + `forge lint` clean | Constitution I |
| 5 | Revert-string typo fix in `end()`: `"trasfer failed"` → `"transfer failed"` | Approved 2026-09-26 (user item 5) |
| 6 | `_mint` → `_safeMint` in `mintNFT` | Approved 2026-09-26 (user item 6) |
| 7 | Name `"Soliman Web3 "` trailing-space trim → `"Soliman Web3"` | Approved 2026-09-26 (user item 7) |
| 8 | `uint256 public immutable startingBid` set in constructor — additive getter so FR-002's "starting bid" stays observable after first bid/reloads (non-breaking; additive ABI surface only) | Approved 2026-09-26 via /speckit.analyze I-1 remediation |

Behavior beyond these deltas must remain compatible: same events, same revert strings,
same refund accounting (fuzz/invariant tests prove it).

## 3. Deployment contract (`scripts/deploy.sh` + `script/Deploy.s.sol`)

Inputs (env/args): `DURATION_SECONDS` (default `604800` = 7 days; demo `60`),
`STARTING_BID_WEI` (demo `1000000000000000` = 0.001 ETH).

Sequence:
1. `start-chain.sh` boots Anvil (chainId **2026**, `--state` load on start / dump on stop).
2. `forge script Deploy.s.sol --broadcast` deploys `SolimanWeb3`, mints token `0` to
   deployer, deploys `EnglishAuction(nft, 0, STARTING_BID_WEI, DURATION_SECONDS)`.
3. Writes `AUCTION_ADDRESS`, `NFT_ADDRESS`, `CHAIN_ID` into `backend/.env` → served via
   `GET /api/config`.

**Outputs are the only address source** — frontend never hardcodes addresses (R4).

## 4. Test obligations mapped to invariants (constitution III)

| Suite | Must prove |
|-------|------------|
| `EnglishAuction.t.sol` | every revert string; seller-only start; NFT escrow; zero-bid return; settlement pays seller exactly `highestBid`; double-start/double-end rejected |
| `EnglishAuction.fuzz.t.sol` | bid sequences (incl. same-bidder rebid, many bidders) conserve funds; boundary `endAt−1/endAt/endAt+1`; durations `1…31_536_000` |
| `EnglishAuction.invariant.t.sol` | `address(this).balance == Σ bids + pendingHighest`; auction holds ≤ 1 NFT; `ended ⇒` no further state transitions |
| `SolimanWeb3.t.sol` | sequential ids from 0, URI set, ownership |

Coverage gate: ≥95% lines / ≥90% branches on `contracts/src/` (`forge coverage` in
`scripts/check.sh`).
