# Phase 1: Data Model — English Auction Web App

**Feature**: 001-auction-web-ui | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

Derived from spec "Key Entities" + acceptance scenarios + the (modernized) contract
behavior. "Validation rules" cite FRs; state machines drive both tests and UI.

---

## 1. Auction (on-chain — `EnglishAuction.sol`)

**Represents**: one auction instance for exactly one NFT (FR-016: single instance in v1).

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `nft` | address (immutable-by-init) | ERC-721 contract being auctioned |
| `nftId` | uint256 (immutable-by-init) | token being auctioned |
| `seller` | address payable | `msg.sender` at construction; receives highest bid |
| `startingBid` | uint256 (immutable) | **new (R5 #8, approved via /speckit.analyze I-1)**: original starting bid — always readable so FR-002's "starting bid" display works after any number of bids and across reloads |
| `duration` | uint256 | **new** (Q3=C): constructor param, default constant `7 days` |
| `endAt` | uint256 | set at `start()`: `block.timestamp + duration` |
| `started` | bool | true after `start()` |
| `ended` | bool | true after `end()` completes |
| `highestBidder` | address | `address(0)` while no qualifying bid |
| `highestBid` | uint256 | **initialized to `startingBid`** at construction; rises with each qualifying bid (the original starting bid lives in the immutable `startingBid` getter, R5 #8) |
| `bids` | mapping(address ⇒ uint256) | claimable refund per outbid/overbidder |

### Functions consumed (input validation → acceptance scenarios)

| Function | Preconditions (revert string) | Effects |
|----------|-------------------------------|---------|
| `start()` | `!started` ("started"), caller == seller ("not seller") | escrows NFT via `transferFrom(seller→self)`; sets `endAt`; emits `Start()` |
| `bid()` | `started` ("not started"), `block.timestamp < endAt` ("ended"), `msg.value > highestBid` ("value < highest") | credits prior `highestBid` to prior `highestBidder`'s `bids`; raises bar; emits `Bid(sender, amount)` |
| `withdraw()` | — (zero-balance call is a no-op transfer of 0; UI pre-blocks per FR-004) | CEI: zeroes `bids[caller]` then transfers; emits `Withdraw(bidder, amount)` |
| `end()` | `started` ("not started"), `block.timestamp >= endAt` ("not ended"), `!ended` ("ended") | `ended=true`; winner⇄NFT + seller⇄highestBid (or NFT→seller if zero bids); emits `End(winner, amount)` |

### State machine

```text
NOT_STARTED ──start()──▶ LIVE ──time ≥ endAt, end()──▶ ENDED
   │                       │                             │
   │ seller only, once     │ bids: value > highestBid    │ terminal — no transitions
   │ escrows NFT           │ within (start, endAt)       │ NFT: winner or seller (0 bids)
   ▼                       ▼                             ▼
 Start() event         Bid() events…                  End() event
```

Time-derived UI phase: `LIVE` + `now < endAt` = "OPEN FOR BIDS"; `LIVE` + `now ≥ endAt`
= "AWAITING SETTLEMENT"; `ended` = "SETTLED".

### Derived UI values (FR-002)

- `phase` ∈ {NOT_STARTED, OPEN_FOR_BIDS, AWAITING_SETTLEMENT, SETTLED}
- `timeRemaining` = `max(0, endAt − now)` (countdown)
- `displayStartingBid` = `startingBid` (immutable getter — always available, see R5 #8)
- `myRefundable` = `bids[connectedAccount]`
- `isHighestBidder` = `connectedAccount == highestBidder`

**Terminology glossary (I-2 remediation)**: on-chain `bids[address]` → code `myRefundable` →
user-facing copy **"withdrawable balance"** (the term used in spec.md). "Claimable" is an
internal alias only — do not use it in UI strings.

---

## 2. Bid / Refund ledger (on-chain, derived)

| Field | Source | Validation (FRs) |
|-------|--------|------------------|
| `bidder` | tx sender | must be connected account for user actions |
| `amount` | `msg.value` | FR-003: strictly `> highestBid`; UI pre-validates FR-004 before prompting |
| `timestamp` | block/time from event log | drives activity log ordering (FR-009) |
| `claimable` | `bids[address]` | FR-005: withdraw exactly this; UI blocks when 0 (edge case) |

Accounting invariant (fuzz-proven): for a settled account,
`totalSpent = Σ own bids = Σ own withdrawals + (if currently highest: highestBid) + (if
outbid-not-withdrawn: claimable)`.

**Same-bidder rebid rule**: a highest bidder raising their own bid credits the old bid
to their own `bids` — they may withdraw it (contract behavior; documented for UI copy:
"previous bid refundable").

---

## 3. NFT (on-chain — `SolimanWeb3.sol`)

| Field | Type | Notes |
|-------|------|-------|
| `tokenId` | uint256 | sequential counter `_tokenId`, first mint returns `0` (kept as-is, behavior-compatible) |
| `owner` | address | OZ ERC-721 internal ledger; escrowed by Auction while LIVE |
| `tokenURI` | string (`jsonUri`) | off-chain JSON; validity = caller's responsibility (spec assumption) |

Mint flow validation (FR-008, US5): URI non-empty; warn on obviously invalid URI before
gas spend (client-side), surface revert otherwise. Key transitions:
`minted (owner=seller) → [start] escrowed (owner=auction) → [end, bids] winner` /
`[end, 0 bids] seller`.

---

## 4. Wallet session (client-only)

| Field | Values | Notes |
|-------|--------|-------|
| `account` | address \| undefined | FR-001 |
| `status` | DISCONNECTED / CONNECTING / CONNECTED / WRONG_NETWORK | WRONG_NETWORK ⇒ guided `wallet_addEthereumChain` + `wallet_switchEthereumChain` (chainId 2026) |
| `chainId` | expected `2026` vs actual | mismatch blocks all writes with clear message (FR-004) |

---

## 5. Runtime config (backend → SPA, `GET /api/config`)

| Field | Example | Notes |
|-------|---------|-------|
| `chainId` | `2026` | custom hosted chain (R3) |
| `chainName` | `"English Auction Chain"` | shown in wallet prompt |
| `rpcUrl` | `"/rpc"` (same-origin) | never expose node internals |
| `nativeCurrency` | `{ name: "Ether", symbol: "ETH", decimals: 18 }` | wallet_addEthereumChain shape |
| `auctionAddress` | `0x…` | written by `scripts/deploy.sh` |
| `nftAddress` | `0x…` | written by `scripts/deploy.sh` |
| `deployedAt` | ISO timestamp | ops visibility |

No persistence layer — config is env-derived, chain is source of truth (FR-015).

---

## 6. Transaction lifecycle (client state machine — FR-010)

```text
IDLE ──user action (validated)──▶ AWAITING_CONFIRMATION (wallet popup)
        │ reject                    │ sign
        ▼                           ▼
     REJECTED (neutral notice)   PENDING (hash shown) ──▶ SUCCESS (event/log re-read)
                                        │ revert/fail
                                        ▼
                                    REVERTED (surface reason via error catalogue)
```

Every write hook (`usePlaceBid`, `useWithdrawFunds`, `useStartAuction`,
`useSettleAuction`, `useMintNft`) composes `useTxLifecycle`. Failure ⇒ state re-read
(FR-015) so displayed values never diverge from chain (SC-008).

---

## 7. Revert-string → user message catalogue (FR-004, error.ts)

| Contract revert | User-facing message (Caliper voice) |
|-----------------|--------------------------------------|
| `"not started"` | Auction has not started yet |
| `"started"` | Auction already started |
| `"not seller"` | Only the seller can start this auction |
| `"ended"` (start-path) / `"value < highest"` | Bid must exceed current highest / Auction ended — no more bids |
| `"not ended"` | Auction is still in progress |
| `"transfer failed"` / `"trasfer failed"` | Transfer failed — funds remain claimable, retry |
| (client pre-checks) | Nothing to withdraw / bid ≤ highest / wrong network / not connected |

*(Note: source typo `trasfer failed` in `end()` is fixed as a behavior-compatible
string change only if user approves — otherwise catalogue matches both spellings.)*
